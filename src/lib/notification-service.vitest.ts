import { describe, it, expect, beforeEach } from "vitest";
import { prisma } from "./db";
import {
  getUserNotificationPreferences,
  updateUserNotificationPreferences,
  setUserFocusMode,
  notifyAgentSessionSummary,
  flushDailyDraftDigest,
  getUnreadBadgeFilter,
} from "./notification-service";
import { notifyBug } from "./notify";
import { NotificationDeliveryMode } from "@prisma/client";

describe("Notification Preferences & Delivery Engine", () => {
  let userA: { id: string; email: string };
  let userB: { id: string; email: string };
  let testProj: { id: string; key: string };

  beforeEach(async () => {
    // Bersihkan notifikasi dan user test
    const suffix = Math.random().toString(36).slice(2, 7);
    testProj = await prisma.project.create({
      data: {
        key: `NOTIF_${suffix}`.toUpperCase(),
        name: `Notif Test ${suffix}`,
        isTest: true,
      },
    });

    userA = await prisma.user.create({
      data: {
        email: `notif_a_${suffix}@example.test`,
        name: "User Notif A",
        status: "ACTIVE",
        memberships: {
          create: { projectId: testProj.id, role: "QA" },
        },
      },
    });

    userB = await prisma.user.create({
      data: {
        email: `notif_b_${suffix}@example.test`,
        name: "User Notif B",
        status: "ACTIVE",
        memberships: {
          create: { projectId: testProj.id, role: "DEVELOPER" },
        },
      },
    });
  });

  it("AC-NOTIF-01: Ringkasan per sesi agent mengirim tepat 1 notifikasi ringkasan", async () => {
    // userA set agent_session = PER_SESSION (default)
    const count = await notifyAgentSessionSummary([userA.id], {
      sessionId: "session-agent-pi-1",
      sessionTitle: "Regresi hak akses",
      agentName: "pi (Ega)",
      totalResults: 8,
      passed: 5,
      failed: 2,
      blocked: 1,
      newBugsCount: 1,
      href: `/projects/${testProj.key}`,
    });

    expect(count).toBe(1);

    const notif = await prisma.notification.findFirstOrThrow({
      where: { userId: userA.id, sessionId: "session-agent-pi-1" },
    });

    expect(notif.title).toContain("Agent pi (Ega) selesai");
    expect(notif.body).toBe("Regresi hak akses · 8 hasil: 5 lolos, 2 gagal, 1 terblokir · 1 bug baru");

    // Jika user set mode OFF untuk agent_session, tidak boleh menerima notifikasi
    await updateUserNotificationPreferences(userB.id, {
      scope: "INVOLVED_ONLY",
      preferences: [{ type: "agent_session", mode: NotificationDeliveryMode.OFF }],
    });

    const countB = await notifyAgentSessionSummary([userB.id], {
      sessionId: "session-agent-pi-2",
      sessionTitle: "Regresi hak akses",
      agentName: "pi (Ega)",
      totalResults: 8,
      passed: 5,
      failed: 2,
      blocked: 1,
      href: `/projects/${testProj.key}`,
    });

    expect(countB).toBe(0);
  });

  it("AC-NOTIF-02: Ringkasan harian draf bug", async () => {
    // Buat draf bug di testProj
    await prisma.bug.create({
      data: {
        key: `${testProj.key}-1`,
        number: 1,
        title: "Draft Bug 1",
        status: "DRAFT",
        severity: "MEDIUM",
        projectId: testProj.id,
        reporterId: userA.id,
      },
    });

    await prisma.bug.create({
      data: {
        key: `${testProj.key}-2`,
        number: 2,
        title: "Draft Bug 2",
        status: "DRAFT",
        severity: "MEDIUM",
        projectId: testProj.id,
        reporterId: userA.id,
      },
    });

    // Jalankan flush daily digest
    const sent = await flushDailyDraftDigest(testProj.id);
    expect(sent).toBeGreaterThanOrEqual(1);

    const digest = await prisma.notification.findFirst({
      where: { userId: userA.id, type: "draft", title: { contains: "Ringkasan Harian" } },
    });
    expect(digest).not.toBeNull();
    expect(digest?.title).toContain("2 draft bug menunggu triase");
  });

  it("AC-NOTIF-03: Cakupan 'Hanya yang melibatkan saya'", async () => {
    // userA: INVOLVED_ONLY (default)
    // Buat bug di mana userA BUKAN reporter/assignee/co-reporter
    const bug = await prisma.bug.create({
      data: {
        key: `${testProj.key}-3`,
        number: 3,
        title: "Vendor Bug 3",
        status: "OPEN",
        severity: "MEDIUM",
        projectId: testProj.id,
        reporterId: userB.id,
        assigneeId: userB.id,
      },
    });

    // Trigger status change event
    await notifyBug(bug.id, { id: userB.id, name: "User B" }, {
      kind: "status",
      from: "OPEN",
      to: "IN_PROGRESS",
    });

    // userA tidak terlibat, sehingga tidak menerima notifikasi
    const notifA = await prisma.notification.findFirst({
      where: { userId: userA.id, href: { contains: `${bug.number}` } },
    });
    expect(notifA).toBeNull();

    // Mention tetap diterima meskipun cakupan INVOLVED_ONLY
    await notifyBug(bug.id, { id: userB.id, name: "User B" }, {
      kind: "comment",
      commentType: "PUBLIC",
      excerpt: "Halo @UserNotifA tolong cek",
      mentions: [userA.id],
    });

    const mentionA = await prisma.notification.findFirst({
      where: { userId: userA.id, type: "mention" },
    });
    expect(mentionA).not.toBeNull();
  });

  it("AC-NOTIF-04: Mode fokus menahan badge unread lonceng, tapi sebutan @nama tetap masuk", async () => {
    // Aktifkan mode fokus 2 jam untuk userA
    await setUserFocusMode(userA.id, 2);

    const bug = await prisma.bug.create({
      data: {
        key: `${testProj.key}-4`,
        number: 4,
        title: "Bug Fokus Test",
        status: "OPEN",
        severity: "MEDIUM",
        projectId: testProj.id,
        reporterId: userA.id,
        assigneeId: userA.id,
      },
    });

    // Kirim notifikasi status (bukan mention)
    await notifyBug(bug.id, { id: userB.id, name: "User B" }, {
      kind: "status",
      from: "OPEN",
      to: "IN_PROGRESS",
    });

    // Kirim notifikasi mention
    await notifyBug(bug.id, { id: userB.id, name: "User B" }, {
      kind: "comment",
      commentType: "PUBLIC",
      excerpt: "Hai @UserA penting nih",
      mentions: [userA.id],
    });

    // Ambil preferensi dan filter unread count
    const prefs = await getUserNotificationPreferences(userA.id);
    expect(prefs.isFocusActive).toBe(true);

    const filter = getUnreadBadgeFilter(userA.id, prefs.focusUntil);
    const unreadCount = await prisma.notification.count({ where: filter });

    // Saat fokus: status dan comment ditahan, mention tetap masuk -> unreadCount tepat 1
    expect(unreadCount).toBe(1);

    // Matikan mode fokus
    await setUserFocusMode(userA.id, null);
    const prefsAfter = await getUserNotificationPreferences(userA.id);
    expect(prefsAfter.isFocusActive).toBe(false);

    const filterAfter = getUnreadBadgeFilter(userA.id, prefsAfter.focusUntil);
    const unreadCountAfter = await prisma.notification.count({ where: filterAfter });

    // Sekarang ketiga notifikasi (status, mention, comment) terhitung di badge!
    expect(unreadCountAfter).toBe(3);
  });
});
