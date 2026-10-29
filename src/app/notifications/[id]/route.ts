import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";

// Mark read then go to target. Scoped to owner; href is server-generated (always a local path).
export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const uid = (await auth())?.user?.id;
  if (!uid) return NextResponse.redirect(new URL("/login", req.url));
  const { id } = await params;
  const n = await prisma.notification.findFirst({ where: { id, userId: uid } });
  if (!n) return NextResponse.redirect(new URL("/notifications", req.url));
  if (!n.readAt) await prisma.notification.update({ where: { id }, data: { readAt: new Date() } });
  return NextResponse.redirect(new URL(n.href.startsWith("/") && !n.href.startsWith("//") ? n.href : "/notifications", req.url));
}
