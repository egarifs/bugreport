"use server";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { isGuideRole, TOUR_ID } from "@/lib/onboarding";
import { ensureSandbox, setGuideRole } from "@/lib/onboarding-service";
import { resetSandbox } from "@/lib/sandbox-service";

// Status dibaca dari DB (bukan JWT): PENDING dan ACTIVE boleh; REJECTED/SUSPENDED tidak.
async function currentUserId(): Promise<string> {
  const id = (await auth())?.user?.id;
  if (!id) redirect("/login");
  const u = await prisma.user.findUnique({ where: { id }, select: { status: true } });
  if (!u || (u.status !== "PENDING" && u.status !== "ACTIVE")) redirect("/pending");
  return id;
}

export async function chooseGuideRole(formData: FormData): Promise<void> {
  const userId = await currentUserId();
  const role = formData.get("role");
  if (isGuideRole(role)) await setGuideRole(userId, role);
  revalidatePath("/onboarding");
}

export async function openSandbox(): Promise<void> {
  const userId = await currentUserId();
  const p = await ensureSandbox(userId);
  redirect(`/projects/${p.key}`);
}

export async function resetMySandbox(): Promise<void> {
  const userId = await currentUserId();
  const p = await resetSandbox(userId);
  redirect(`/projects/${p.key}`);
}

/** Tandai tur sudah ditutup (selesai atau dilewati); tidak muncul lagi. Hanya id tur yang dikenal. */
export async function dismissTour(tourId: string): Promise<void> {
  const userId = await currentUserId();
  if (tourId !== TOUR_ID) return;
  const cur = await prisma.onboardingProgress.findUnique({ where: { userId }, select: { dismissedTours: true } });
  if (cur?.dismissedTours.includes(tourId)) return;
  await prisma.onboardingProgress.upsert({ where: { userId }, update: { dismissedTours: { push: tourId } }, create: { userId, dismissedTours: [tourId] } });
}
