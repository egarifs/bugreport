import { CommentType } from "@prisma/client";
import { prisma } from "./db";
import { hasPermission, type Permission } from "./permissions";
import { STATUS_LABEL } from "@/components/ui/bug-badges";
import type { BugStatus } from "@prisma/client";

export type NotifyType = "assign" | "comment" | "status" | "draft" | "user_pending";
const RETENTION_DAYS = 90;

type Actor = { id?: string | null; name?: string | null; email?: string | null };
type BugEvent =
  | { kind: "assign" }
  | { kind: "comment"; commentType: CommentType; excerpt: string }
  | { kind: "status"; from: BugStatus; to: BugStatus }
  | { kind: "draft"; source: "mcp" | "test_run" | "form" };

const actorLabel = (a: Actor) => a.name || a.email || "Sistem";
const clip = (s: string, n = 140) => (s.length > n ? s.slice(0, n - 1) + "…" : s).replace(/\s+/g, " ").trim();

async function save(userIds: string[], actor: Actor, data: { projectId?: string; type: NotifyType; title: string; body?: string; href: string }) {
  const ids = [...new Set(userIds)].filter((id) => id && id !== actor.id);
  if (!ids.length) return 0;
  const { count } = await prisma.notification.createMany({
    data: ids.map((userId) => ({ userId, actorName: actorLabel(actor), body: "", ...data })),
  });
  // ponytail: prune on write instead of cron; one indexed delete per event. Move to cron if write volume grows.
  await prisma.notification.deleteMany({ where: { createdAt: { lt: new Date(Date.now() - RETENTION_DAYS * 86400_000) } } });
  return count;
}

// Only ACTIVE users who still hold `perm` in this project (or global admin) receive it.
async function allowed(projectId: string, userIds: (string | null | undefined)[], perm: Permission) {
  const ids = [...new Set(userIds.filter(Boolean) as string[])];
  if (!ids.length) return [];
  const users = await prisma.user.findMany({
    where: { id: { in: ids }, status: "ACTIVE" },
    select: { id: true, isAdmin: true, memberships: { where: { projectId }, select: { role: true } } },
  });
  return users.filter((u) => hasPermission(u.memberships[0]?.role, perm, u.isAdmin)).map((u) => u.id);
}

/** Never throws: a failed notification must not fail the bug action that triggered it. */
export async function notifyBug(bugId: string, actor: Actor, ev: BugEvent) {
  try {
    const bug = await prisma.bug.findUniqueOrThrow({
      where: { id: bugId },
      select: { key: true, number: true, title: true, projectId: true, reporterId: true, assigneeId: true, project: { select: { key: true } } },
    });
    const href = `/projects/${bug.project.key}/bugs/${bug.number}`;
    const base = { projectId: bug.projectId, href, body: clip(bug.title) };
    const who = actorLabel(actor);
    const involved = [bug.reporterId, bug.assigneeId];

    switch (ev.kind) {
      case "assign":
        return save(await allowed(bug.projectId, [bug.assigneeId], "project.read"), actor, {
          ...base, type: "assign", title: `${who} menugaskan ${bug.key} ke Anda`,
        });
      case "comment": {
        // Internal notes reach only roles that can read them (never vendor/client).
        const perm = ev.commentType === CommentType.INTERNAL ? "note.internal.read" : "project.read";
        return save(await allowed(bug.projectId, involved, perm), actor, {
          ...base, type: "comment",
          title: `${who} ${ev.commentType === CommentType.INTERNAL ? "menulis catatan internal" : "berkomentar"} di ${bug.key}`,
          body: clip(ev.excerpt),
        });
      }
      case "status":
        return save(await allowed(bug.projectId, involved, "project.read"), actor, {
          ...base, type: "status", title: `${bug.key}: ${STATUS_LABEL[ev.from]} → ${STATUS_LABEL[ev.to]}`,
        });
      case "draft": {
        const members = await prisma.projectMember.findMany({ where: { projectId: bug.projectId }, select: { userId: true } });
        const src = { mcp: "dari agent MCP", test_run: "dari test gagal", form: "baru" }[ev.source];
        return save(await allowed(bug.projectId, members.map((m) => m.userId), "bug.review"), actor, {
          ...base, type: "draft", title: `Draft ${src} perlu review: ${bug.key}`,
        });
      }
    }
  } catch (e) {
    console.error("notify failed:", e instanceof Error ? e.message : "unknown");
    return 0;
  }
}

export async function notifyAdminsPendingUser(user: { name?: string | null; email: string }) {
  try {
    const admins = await prisma.user.findMany({ where: { isAdmin: true, status: "ACTIVE" }, select: { id: true } });
    return save(admins.map((a) => a.id), { name: "Sistem" }, {
      type: "user_pending", title: `${user.name || user.email} menunggu approval`, body: user.email, href: "/admin/users",
    });
  } catch (e) {
    console.error("notify failed:", e instanceof Error ? e.message : "unknown");
    return 0;
  }
}
