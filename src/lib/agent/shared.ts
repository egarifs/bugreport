import path from "node:path";
import { prisma } from "@/lib/db";

export const MAX_EVIDENCE_BYTES = 10 * 1024 * 1024; // decision: >10 MB via MCP base64 -> agent sends a link instead
export const evidencePath = (projectKey: string, storedName: string) => path.join(process.cwd(), "uploads", projectKey, "evidence", path.basename(storedName));

// F9: tools for a QA's local agent. Every write is done as the key owner (actor), labelled "via agent".
export const LEASE_MS = 90_000; // AC-AG-04: no heartbeat for >90s = lease expired ("Terputus")

export type AgentCtx = { projectId: string; projectKey: string; apiKeyId: string; actorId: string; actorEmail: string };
export type AgentResult<T = object> = ({ ok: true } & T) | { error: string };
export const err = (error: string) => ({ error });
export const isUrl = (u: string) => /^https?:\/\/\S+$/i.test(u);
export const countSteps = (steps: string) => Math.max(1, steps.match(/(?:^|\s)\d+\)/g)?.length ?? 1);

export async function ownSession(ctx: AgentCtx, sessionId?: unknown) {
  if (!sessionId) return null;
  return prisma.agentRun.findFirst({ where: { id: String(sessionId), projectId: ctx.projectId, apiKeyId: ctx.apiKeyId } });
}
