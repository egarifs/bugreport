import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { setUserFocusMode } from "@/lib/notification-service";

async function userId() {
  const s = await auth();
  return (s?.user as { id?: string; status?: string } | undefined)?.status === "ACTIVE" ? s?.user?.id : undefined;
}

// POST { hours: number | null } -> sets or clears focus mode
export async function POST(req: NextRequest) {
  const uid = await userId();
  if (!uid) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = (await req.json().catch(() => ({}))) as { hours?: number | null };
  const res = await setUserFocusMode(uid, typeof body.hours === "number" ? body.hours : null);

  return NextResponse.json(res);
}
