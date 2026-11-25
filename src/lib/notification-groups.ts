export type NotificationGroupKey = "today" | "yesterday" | "week" | "older";

export const GROUP_LABELS: Record<NotificationGroupKey, string> = {
  today: "Hari ini",
  yesterday: "Kemarin",
  week: "Minggu ini",
  older: "Lebih lama",
};

const ORDER: NotificationGroupKey[] = ["today", "yesterday", "week", "older"];
const DAY = 24 * 60 * 60 * 1000;

function startOfDay(d: Date): number {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
}

export function groupKeyFor(createdAt: Date, now: Date): NotificationGroupKey {
  const diff = startOfDay(now) - startOfDay(createdAt);
  if (diff <= 0) return "today";
  if (diff <= DAY) return "yesterday";
  if (diff <= 6 * DAY) return "week";
  return "older";
}

/** Kelompokkan item (sudah terurut terbaru) per hari; grup kosong dibuang. */
export function groupNotifications<T extends { createdAt: Date }>(items: T[], now: Date): { key: NotificationGroupKey; label: string; items: T[] }[] {
  const buckets = new Map<NotificationGroupKey, T[]>();
  for (const it of items) {
    const k = groupKeyFor(it.createdAt, now);
    buckets.set(k, [...(buckets.get(k) ?? []), it]);
  }
  return ORDER.filter((k) => buckets.has(k)).map((k) => ({ key: k, label: GROUP_LABELS[k], items: buckets.get(k)! }));
}
