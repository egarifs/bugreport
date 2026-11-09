import { prisma } from "./db";
import { NotificationDeliveryMode } from "@prisma/client";

export const NOTIFICATION_TYPES = [
  { type: "assign", label: "Ditugaskan kepada saya", defaultMode: NotificationDeliveryMode.IMMEDIATE },
  { type: "comment", label: "Komentar di bug saya", defaultMode: NotificationDeliveryMode.IMMEDIATE },
  { type: "status", label: "Status bug yang saya ikuti berubah", defaultMode: NotificationDeliveryMode.IMMEDIATE },
  { type: "draft", label: "Draft baru menunggu triase", defaultMode: NotificationDeliveryMode.DAILY },
  { type: "rerun", label: "Item test run perlu re-run", defaultMode: NotificationDeliveryMode.IMMEDIATE },
  { type: "agent_session", label: "Hasil dari agent / impor", defaultMode: NotificationDeliveryMode.PER_SESSION },
  { type: "doc_approval", label: "Revisi dokumen menunggu persetujuan", defaultMode: NotificationDeliveryMode.IMMEDIATE },
  { type: "mention", label: "Sebutan @nama", defaultMode: NotificationDeliveryMode.IMMEDIATE },
] as const;

export type NotificationTypeKey = (typeof NOTIFICATION_TYPES)[number]["type"];

export interface UserPreferencesPayload {
  scope: "ALL_IN_PROJECT" | "INVOLVED_ONLY";
  preferences: {
    type: string;
    mode: NotificationDeliveryMode;
  }[];
}

export interface SessionSummaryInput {
  sessionId: string;
  projectId?: string;
  sessionTitle: string; // e.g. "Regresi hak akses"
  agentName?: string; // e.g. "pi (Ega)"
  totalResults: number;
  passed: number;
  failed: number;
  blocked: number;
  newBugsCount?: number;
  href: string;
}

/**
 * Mendapatkan preferensi notifikasi user. Jika belum tersimpan di DB, gunakan nilai default.
 */
export async function getUserNotificationPreferences(userId: string, projectId?: string) {
  const [user, customPrefs] = await Promise.all([
    prisma.user.findUnique({
      where: { id: userId },
      select: { id: true, name: true, email: true, focusUntil: true, notificationScope: true },
    }),
    prisma.notificationPreference.findMany({
      where: {
        userId,
        projectId: projectId ?? null,
      },
    }),
  ]);

  if (!user) {
    throw new Error("Pengguna tidak ditemukan");
  }

  const prefMap = new Map(customPrefs.map((p) => [p.type, p.mode]));

  const preferences = NOTIFICATION_TYPES.map((t) => ({
    type: t.type,
    label: t.label,
    mode: prefMap.get(t.type) ?? t.defaultMode,
  }));

  const now = new Date();
  const isFocusActive = user.focusUntil ? user.focusUntil > now : false;

  return {
    userId: user.id,
    scope: (user.notificationScope as "ALL_IN_PROJECT" | "INVOLVED_ONLY") || "INVOLVED_ONLY",
    focusUntil: user.focusUntil,
    isFocusActive,
    preferences,
  };
}

/**
 * Menyimpan pembaruan preferensi notifikasi dan cakupan user.
 */
export async function updateUserNotificationPreferences(userId: string, payload: UserPreferencesPayload, projectId?: string) {
  return prisma.$transaction(async (tx) => {
    // Update scope
    await tx.user.update({
      where: { id: userId },
      data: { notificationScope: payload.scope },
    });

    // Upsert preferences
    for (const pref of payload.preferences) {
      const existing = await tx.notificationPreference.findFirst({
        where: {
          userId,
          projectId: projectId ?? null,
          type: pref.type,
        },
      });

      if (existing) {
        await tx.notificationPreference.update({
          where: { id: existing.id },
          data: { mode: pref.mode },
        });
      } else {
        await tx.notificationPreference.create({
          data: {
            userId,
            projectId: projectId ?? null,
            type: pref.type,
            mode: pref.mode,
          },
        });
      }
    }

    return true;
  });
}

/**
 * Mengatur atau membatalkan Mode Fokus (1-4 jam).
 */
export async function setUserFocusMode(userId: string, hours: number | null) {
  const focusUntil = hours && hours > 0 ? new Date(Date.now() + hours * 3600_000) : null;
  await prisma.user.update({
    where: { id: userId },
    data: { focusUntil },
  });
  return { focusUntil, isFocusActive: Boolean(focusUntil && focusUntil > new Date()) };
}

/**
 * Mengirim 1 notifikasi ringkasan sesi agent/impor (AC-NOTIF-01).
 * Mengirim ke user yang memiliki akses/tertarik dengan sesi tersebut dan preferensi agent_session != OFF.
 */
export async function notifyAgentSessionSummary(targetUserIds: string[], input: SessionSummaryInput) {
  const validIds = [...new Set(targetUserIds.filter(Boolean))];
  if (!validIds.length) return 0;

  // Cek preferensi per user
  const users = await prisma.user.findMany({
    where: { id: { in: validIds }, status: "ACTIVE" },
    select: {
      id: true,
      focusUntil: true,
      notificationPreferences: {
        where: { type: "agent_session" },
      },
    },
  });

  const now = new Date();
  const notifData = [];

  const agentLabel = input.agentName ? `Agent ${input.agentName} selesai` : "Sesi agent selesai";
  const parts = [];
  if (input.passed > 0) parts.push(`${input.passed} lolos`);
  if (input.failed > 0) parts.push(`${input.failed} gagal`);
  if (input.blocked > 0) parts.push(`${input.blocked} terblokir`);
  const resultsText = parts.length > 0 ? parts.join(", ") : `${input.totalResults} selesai`;

  const newBugText = input.newBugsCount ? ` · ${input.newBugsCount} bug baru` : "";
  const bodyText = `${input.sessionTitle} · ${input.totalResults} hasil: ${resultsText}${newBugText}`;

  for (const u of users) {
    const customMode = u.notificationPreferences[0]?.mode;
    const mode = customMode ?? NotificationDeliveryMode.PER_SESSION;

    if (mode === NotificationDeliveryMode.OFF) {
      continue;
    }

    const isFocused = u.focusUntil && u.focusUntil > now;
    const heldUntil = isFocused ? u.focusUntil : null;

    notifData.push({
      userId: u.id,
      projectId: input.projectId ?? null,
      type: "agent_session",
      title: agentLabel,
      body: bodyText,
      href: input.href,
      actorName: input.agentName ?? "Agent",
      sessionId: input.sessionId,
      heldUntil,
    });
  }

  if (!notifData.length) return 0;

  const { count } = await prisma.notification.createMany({
    data: notifData,
  });

  return count;
}

/**
 * Mengirim ringkasan harian untuk draf menunggu triase (AC-NOTIF-02).
 */
export async function flushDailyDraftDigest(projectId?: string) {
  const whereProject = projectId ? { projectId } : {};
  // Draf yang berstatus DRAFT dan dibuat dalam 24 jam terakhir
  const draftBugs = await prisma.bug.findMany({
    where: {
      status: "DRAFT",
      ...whereProject,
      createdAt: { gte: new Date(Date.now() - 24 * 3600_000) },
    },
    select: { id: true, projectId: true, project: { select: { key: true, name: true } } },
  });

  if (!draftBugs.length) return 0;

  // Group per project
  const byProject = new Map<string, { count: number; projectKey: string }>();
  for (const b of draftBugs) {
    const prev = byProject.get(b.projectId) || { count: 0, projectKey: b.project.key };
    prev.count += 1;
    byProject.set(b.projectId, prev);
  }

  let totalSent = 0;
  for (const [projId, info] of byProject.entries()) {
    // Temukan member yang punya hak bug.review dan mode draft = DAILY
    const members = await prisma.projectMember.findMany({
      where: { projectId: projId, role: { in: ["ADMIN", "QA"] } },
      select: {
        userId: true,
        user: {
          select: {
            id: true,
            focusUntil: true,
            notificationPreferences: {
              where: { type: "draft" },
            },
          },
        },
      },
    });

    const now = new Date();
    const notifs = [];
    for (const m of members) {
      const customMode = m.user.notificationPreferences[0]?.mode;
      const mode = customMode ?? NotificationDeliveryMode.DAILY;
      if (mode !== NotificationDeliveryMode.DAILY) continue;

      const isFocused = m.user.focusUntil && m.user.focusUntil > now;
      notifs.push({
        userId: m.user.id,
        projectId: projId,
        type: "draft",
        title: `Ringkasan Harian: ${info.count} draft bug menunggu triase`,
        body: `Ada ${info.count} bug draft baru di project ${info.projectKey} yang perlu ditinjau.`,
        href: `/projects/${info.projectKey}?tab=review`,
        actorName: "Sistem",
        heldUntil: isFocused ? m.user.focusUntil : null,
      });
    }

    if (notifs.length > 0) {
      const res = await prisma.notification.createMany({ data: notifs });
      totalSent += res.count;
    }
  }

  return totalSent;
}

/**
 * Filter unread badge count yang memperhitungkan Mode Fokus (AC-NOTIF-04).
 * Selama fokus aktif, notifikasi yang masuk tidak menambah unread count badge, kecuali type == "mention".
 */
export function getUnreadBadgeFilter(userId: string, userFocusUntil?: Date | null) {
  const now = new Date();
  const isFocusActive = userFocusUntil && userFocusUntil > now;

  return {
    userId,
    readAt: null,
    ...(isFocusActive
      ? {
          OR: [
            { type: "mention" },
            { heldUntil: null },
            { heldUntil: { lte: now } },
          ],
        }
      : {}),
  };
}
