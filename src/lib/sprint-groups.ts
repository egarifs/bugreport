export type SprintGroupKey = "running" | "upcoming" | "done";

export const SPRINT_GROUP_LABELS: Record<SprintGroupKey, string> = { running: "Berjalan", upcoming: "Berikutnya", done: "Selesai" };

interface SprintLike { status: string; startsAt: Date }

export function sprintGroupOf(s: SprintLike, now: Date): SprintGroupKey {
  if (s.status !== "ACTIVE") return "done";
  return s.startsAt > now ? "upcoming" : "running";
}

/** Kelompokkan sprint: Berjalan (terbaru dulu), Berikutnya (terdekat dulu), Selesai (terbaru dulu). Grup kosong dibuang. */
export function groupSprints<T extends SprintLike>(sprints: T[], now: Date): { key: SprintGroupKey; label: string; items: T[] }[] {
  const by = (k: SprintGroupKey) => sprints.filter((s) => sprintGroupOf(s, now) === k);
  const desc = (a: T, b: T) => +b.startsAt - +a.startsAt;
  const groups: [SprintGroupKey, T[]][] = [
    ["running", by("running").sort(desc)],
    ["upcoming", by("upcoming").sort((a, b) => +a.startsAt - +b.startsAt)],
    ["done", by("done").sort(desc)],
  ];
  return groups.filter(([, items]) => items.length).map(([key, items]) => ({ key, label: SPRINT_GROUP_LABELS[key], items }));
}
