import { prisma } from "@/lib/db";
import { redactSecrets } from "@/lib/redact";
import { linkBugToItem } from "@/lib/testrun-service";
import { err } from "./shared";
import type { AgentCtx } from "./shared";

// AC-AG-06: link an existing bug and leave one evidence comment instead of a duplicate draft.
export async function linkBug(ctx: AgentCtx, a: { itemId?: string; bugKey?: string; comment?: string }) {
  if (!a.itemId || !a.bugKey) return err("itemId dan bugKey wajib diisi.");
  const r = await linkBugToItem(ctx.projectId, a.itemId, a.bugKey);
  if ("error" in r) return r;
  const bug = await prisma.bug.findFirstOrThrow({ where: { projectId: ctx.projectId, key: a.bugKey.trim().toUpperCase() }, select: { id: true } });
  const body = redactSecrets((a.comment ?? "").trim());
  if (body) await prisma.bugComment.create({ data: { bugId: bug.id, authorId: ctx.actorId, body: `[Agent Comment]\n${body}`, type: "PUBLIC" } });
  return { ok: true as const };
}
