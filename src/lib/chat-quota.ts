import { prisma } from "./db";

export const CHAT_MESSAGE_MAX = 2000;
// Daily token budget per project. Override via env without rebuild.
export const dailyTokenQuota = () => Number(process.env.CHAT_DAILY_TOKENS_PER_PROJECT) || 1_000_000;

// Quota resets 00:00 WIB (UTC+7, no DST).
export function startOfDayWib(now = new Date()) {
  const d = new Date(now.getTime() + 7 * 3600_000);
  d.setUTCHours(0, 0, 0, 0);
  return new Date(d.getTime() - 7 * 3600_000);
}

// Cache reads count 1/10, matching how Anthropic bills them.
export async function projectTokensToday(projectId: string) {
  const [row] = await prisma.$queryRaw<{ used: number }[]>`
    select coalesce(sum(
      coalesce(("tokenUsage"->>'inputTokens')::int, 0)
      + coalesce(("tokenUsage"->>'cacheWriteTokens')::int, 0)
      + coalesce(("tokenUsage"->>'outputTokens')::int, 0)
      + coalesce(("tokenUsage"->>'cacheReadTokens')::int, 0) / 10
    ), 0)::int as used
    from "ChatMessage"
    where "projectId" = ${projectId} and role = 'ASSISTANT' and "createdAt" >= ${startOfDayWib()}`;
  return row.used;
}
