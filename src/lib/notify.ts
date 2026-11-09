import { CommentType, NotificationDeliveryMode } from "@prisma/client";
import { prisma } from "./db";
import { hasPermission, type Permission } from "./permissions";
import { STATUS_LABEL } from "@/components/ui/bug-badges";
import type { BugStatus } from "@prisma/client";

export type NotifyType =
  | "assign"
  | "comment"
  | "status"
  | "draft"
  | "rerun"
  | "agent_session"
  | "doc_approval"
  | "mention"
  | "user_pending";

const RETENTION_DAYS = 90;

type Actor = { id?: string | null; name?: string | null; email?: string | null };
type BugEvent =
  | { kind: "assign" }
  | { kind: "comment"; commentType: CommentType; excerpt: string; mentions?: string[] }
  | { kind: "status"; from: BugStatus; to: BugStatus }
  | { kind: "draft"; source: "mcp" | "test_run" | "form" };

const actorLabel = (a: Actor) => a.name || a.email || "Sistem";
const clip = (s: string, n = 140) => (s.length > n ? s.slice(0, n - 1) + "…" : s).replace(/\s+/g, " ").trim();

const DEFAULT_MODES: Record<string, NotificationDeliveryMode> = {
  assign: NotificationDeliveryMode.IMMEDIATE,
  comment: NotificationDeliveryMode.IMMEDIATE,
  status: NotificationDeliveryMode.IMMEDIATE,
  draft: NotificationDeliveryMode.IMMEDIATE,
  rerun: NotificationDeliveryMode.IMMEDIATE,
  agent_session: NotificationDeliveryMode.IMMEDIATE,
  doc_approval: NotificationDeliveryMode.IMMEDIATE,
  mention: NotificationDeliveryMode.IMMEDIATE,
  user_pending: NotificationDeliveryMode.IMMEDIATE,
};

async function save(
  userIds: string[],
  actor: Actor,
  data: {
    projectId?: string;
    type: NotifyType;
    title: string;
    body?: string;
    href: string;
    sessionId?: string;
    involvedIds?: string[];
  }
) {
  const ids = [...new Set(userIds)].filter((id) => id && id !== actor.id);
  if (!ids.length) return 0;

  // Fetch preferences, scope, and focusUntil for target users
  const users = await prisma.user.findMany({
    where: { id: { in: ids }, status: "ACTIVE" },
    select: {
      id: true,
      focusUntil: true,
      notificationScope: true,
      notificationPreferences: {
        where: {
          type: data.type,
          OR: [{ projectId: data.projectId ?? null }, { projectId: null }],
        },
      },
    },
  });

  const now = new Date();
  const records = [];

  for (const u of users) {
    // 1. Check scope: If INVOLVED_ONLY, user must be in involvedIds (unless mention, assign, or draft/pending review)
    const isDirectlyInvolved = data.involvedIds ? data.involvedIds.includes(u.id) : true;
    if (u.notificationScope === "INVOLVED_ONLY" && !isDirectlyInvolved && data.type !== "mention" && data.type !== "assign") {
      continue;
    }

    // 2. Check delivery mode preference
    const pref = u.notificationPreferences[0];
    const mode = pref?.mode ?? DEFAULT_MODES[data.type] ?? NotificationDeliveryMode.IMMEDIATE;

    if (mode === NotificationDeliveryMode.OFF) {
      continue;
    }

    // If DAILY or PER_SESSION mode, do not send immediate notifications (they will be digested)
    if (mode === NotificationDeliveryMode.DAILY && data.type !== "mention") {
      continue;
    }
    if (mode === NotificationDeliveryMode.PER_SESSION && data.type !== "agent_session") {
      continue;
    }

    // 3. Focus mode check: If in focus, hold non-mention notifications
    const isFocused = u.focusUntil && u.focusUntil > now;
    const heldUntil = isFocused && data.type !== "mention" ? u.focusUntil : null;

    records.push({
      userId: u.id,
      projectId: data.projectId ?? null,
      type: data.type,
      title: data.title,
      body: data.body ?? "",
      href: data.href,
      actorName: actorLabel(actor),
      sessionId: data.sessionId ?? null,
      heldUntil,
    });
  }

  if (!records.length) return 0;

  const { count } = await prisma.notification.createMany({
    data: records,
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
      select: { id: true, key: true, number: true, title: true, projectId: true, reporterId: true, assigneeId: true, project: { select: { key: true } } },
    });
    const href = `/projects/${bug.project.key}/bugs/${bug.number}`;
    const base = { projectId: bug.projectId, href, body: clip(bug.title) };
    const who = actorLabel(actor);

    const coReporters = await prisma.bugCoReporter.findMany({
      where: { bugId: bug.id },
      select: { userId: true },
    });
    const involved = [bug.reporterId, bug.assigneeId, ...coReporters.map((c) => c.userId)].filter(Boolean) as string[];

    switch (ev.kind) {
      case "assign":
        return save(await allowed(bug.projectId, [bug.assigneeId], "project.read"), actor, {
          ...base, type: "assign", title: `${who} menugaskan ${bug.key} ke Anda`, involvedIds: [bug.assigneeId!],
        });
      case "comment": {
        // Send mention notifications if any
        if (ev.mentions && ev.mentions.length > 0) {
          const mentionedUsers = await allowed(bug.projectId, ev.mentions, "project.read");
          if (mentionedUsers.length > 0) {
            await save(mentionedUsers, actor, {
              ...base,
              type: "mention",
              title: `${who} menyebut Anda di ${bug.key}`,
              body: clip(ev.excerpt),
              involvedIds: mentionedUsers,
            });
          }
        }

        // Internal notes reach only roles that can read them (never vendor/client).
        const perm = ev.commentType === CommentType.INTERNAL ? "note.internal.read" : "project.read";
        const targets = await allowed(bug.projectId, involved, perm);
        return save(targets, actor, {
          ...base,
          type: "comment",
          title: `${who} ${ev.commentType === CommentType.INTERNAL ? "menulis catatan internal" : "berkomentar"} di ${bug.key}`,
          body: clip(ev.excerpt),
          involvedIds: involved,
        });
      }
      case "status":
        return save(await allowed(bug.projectId, involved, "project.read"), actor, {
          ...base, type: "status", title: `${bug.key}: ${STATUS_LABEL[ev.from]} → ${STATUS_LABEL[ev.to]}`, involvedIds: involved,
        });
      case "draft": {
        const members = await prisma.projectMember.findMany({ where: { projectId: bug.projectId }, select: { userId: true } });
        const src = { mcp: "dari agent MCP", test_run: "dari test gagal", form: "baru" }[ev.source];
        return save(await allowed(bug.projectId, members.map((m) => m.userId), "bug.review"), actor, {
          ...base, type: "draft", title: `Draft ${src} perlu review: ${bug.key}`, involvedIds: members.map((m) => m.userId),
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

export async function notifyRerunRequired(params: {
  testRunId: string;
  testRunTitle: string;
  itemTitle: string;
  projectId: string;
  projectKey: string;
  targetUserIds: string[];
  actor: Actor;
}) {
  try {
    const targets = await allowed(params.projectId, params.targetUserIds, "testrun.execute");
    return save(targets, params.actor, {
      projectId: params.projectId,
      type: "rerun",
      title: `Test run "${params.testRunTitle}" perlu re-run`,
      body: clip(params.itemTitle),
      href: `/projects/${params.projectKey}/test-runs/${params.testRunId}`,
      involvedIds: targets,
    });
  } catch (e) {
    console.error("notify rerun failed:", e instanceof Error ? e.message : "unknown");
    return 0;
  }
}

export async function notifyDocApproval(params: {
  docId: string;
  docTitle: string;
  projectId: string;
  projectKey: string;
  targetUserIds: string[];
  actor: Actor;
}) {
  try {
    const targets = await allowed(params.projectId, params.targetUserIds, "doc.manage");
    const who = actorLabel(params.actor);
    return save(targets, params.actor, {
      projectId: params.projectId,
      type: "doc_approval",
      title: `${who} mengajukan revisi dokumen "${params.docTitle}"`,
      body: "Menunggu peninjauan dan persetujuan.",
      href: `/projects/${params.projectKey}/docs`,
      involvedIds: targets,
    });
  } catch (e) {
    console.error("notify doc approval failed:", e instanceof Error ? e.message : "unknown");
    return 0;
  }
}
