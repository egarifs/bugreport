import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { checkProjectPermission } from "@/lib/authz";
import { hasPermission } from "@/lib/permissions";
import { getProjectReport } from "@/lib/report";
import { renderReleasePdf } from "@/lib/report-pdf";
import { parseAudience, releasePdfFilename } from "@/lib/report-share";

// @react-pdf needs Node APIs (Buffer, fs for fonts); never run this on the edge runtime.
export const runtime = "nodejs";

export async function GET(req: Request, { params }: { params: Promise<{ key: string }> }) {
  const sessionUser = (await auth())?.user as { id?: string } | undefined;
  if (!sessionUser?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { key } = await params;
  const project = await prisma.project.findUnique({ where: { key: key.toUpperCase() } });
  if (!project) return NextResponse.json({ error: "Not found" }, { status: 404 });

  let viewer: Awaited<ReturnType<typeof checkProjectPermission>>;
  try {
    viewer = await checkProjectPermission(sessionUser?.id, project.id, "project.read");
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Forbidden";
    return NextResponse.json({ error: msg }, { status: msg === "Unauthorized" ? 401 : 403 });
  }

  const url = new URL(req.url);
  // Clients, vendors and viewers can never get the internal variant, whatever the query string says.
  const audience = parseAudience(url.searchParams.get("audience"), hasPermission(viewer.role, "note.internal.read", viewer.isAdmin));
  const version = url.searchParams.get("version")?.trim() || undefined;
  const includeLink = url.searchParams.get("link") !== "0";

  const me = await prisma.user.findUnique({ where: { id: viewer.id }, select: { name: true, email: true } });
  const generatedAt = new Date();
  // Behind a proxy or Docker req.url carries the internal host; NEXTAUTH_URL is the address people actually use.
  const origin = (process.env.NEXTAUTH_URL || process.env.AUTH_URL || url.origin).replace(/\/+$/, "");
  const liveUrl = includeLink
    ? `${origin}/projects/${project.key}/reports${version ? `?version=${encodeURIComponent(version)}` : ""}`
    : undefined;

  const pdf = await renderReleasePdf({
    projectName: project.name,
    audience,
    version,
    generatedAt,
    generatedBy: me?.name || me?.email || "BugBoard",
    liveUrl,
    report: await getProjectReport(project.id, version),
  });

  return new NextResponse(new Uint8Array(pdf), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="${releasePdfFilename(project.key, audience, generatedAt)}"`,
      "Cache-Control": "private, no-store",
    },
  });
}
