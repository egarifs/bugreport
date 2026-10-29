import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";

async function userId() {
  const s = await auth();
  return (s?.user as { id?: string; status?: string } | undefined)?.status === "ACTIVE" ? s?.user?.id : undefined;
}

// GET ?count=1 -> unread count only (cheap poll); otherwise latest 30.
export async function GET(req: NextRequest) {
  const uid = await userId();
  if (!uid) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const unread = await prisma.notification.count({ where: { userId: uid, readAt: null } });
  if (req.nextUrl.searchParams.get("count")) return NextResponse.json({ unread });
  const items = await prisma.notification.findMany({
    where: { userId: uid },
    orderBy: { createdAt: "desc" },
    take: 30,
    select: { id: true, type: true, title: true, body: true, href: true, actorName: true, readAt: true, createdAt: true },
  });
  return NextResponse.json({ unread, items });
}

// POST { id } marks one read; { all: true } marks all read. Always scoped to the caller.
export async function POST(req: NextRequest) {
  const uid = await userId();
  if (!uid) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const body = (await req.json().catch(() => ({}))) as { id?: unknown; all?: unknown };
  if (body.all !== true && typeof body.id !== "string") return NextResponse.json({ error: "id atau all wajib" }, { status: 400 });
  await prisma.notification.updateMany({
    where: { userId: uid, readAt: null, ...(body.all === true ? {} : { id: body.id as string }) },
    data: { readAt: new Date() },
  });
  return NextResponse.json({ ok: true });
}
