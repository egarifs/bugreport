import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import {
  getUserNotificationPreferences,
  updateUserNotificationPreferences,
  type UserPreferencesPayload,
} from "@/lib/notification-service";

async function userId() {
  const s = await auth();
  return (s?.user as { id?: string; status?: string } | undefined)?.status === "ACTIVE" ? s?.user?.id : undefined;
}

// GET: ambil preferensi notifikasi user
export async function GET(req: NextRequest) {
  const uid = await userId();
  if (!uid) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const projectId = req.nextUrl.searchParams.get("projectId") || undefined;
  try {
    const data = await getUserNotificationPreferences(uid, projectId);
    return NextResponse.json(data);
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : "Gagal mengambil preferensi" }, { status: 500 });
  }
}

// PUT: simpan perubahan preferensi notifikasi user
export async function PUT(req: NextRequest) {
  const uid = await userId();
  if (!uid) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = (await req.json().catch(() => null)) as UserPreferencesPayload | null;
  if (!body || !body.preferences || !Array.isArray(body.preferences)) {
    return NextResponse.json({ error: "Payload tidak valid" }, { status: 400 });
  }

  const projectId = req.nextUrl.searchParams.get("projectId") || undefined;
  try {
    await updateUserNotificationPreferences(uid, body, projectId);
    return NextResponse.json({ ok: true });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : "Gagal memperbarui preferensi" }, { status: 500 });
  }
}
