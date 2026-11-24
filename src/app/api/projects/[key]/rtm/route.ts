import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { checkProjectPermission } from "@/lib/authz";
import { loadRtm } from "@/lib/requirement-service";
import { COVERAGE_LABEL, REQ_STATUS_LABEL } from "@/lib/requirement-labels";

const cell = (v: string | number) => `"${String(v).replace(/"/g, '""').replace(/^([=+\-@])/, "'$1")}"`;

export async function GET(req: Request, { params }: { params: Promise<{ key: string }> }) {
  const userId = (await auth())?.user?.id;
  if (!userId) return new Response("Unauthorized", { status: 401 });
  const { key } = await params;
  const project = await prisma.project.findUnique({ where: { key: key.toUpperCase() }, select: { id: true, key: true } });
  if (!project) return new Response("Not found", { status: 404 });
  try { await checkProjectPermission(userId, project.id, "doc.read"); } catch { return new Response("Forbidden", { status: 403 }); }
  const slug = new URL(req.url).searchParams.get("doc");
  const doc = await prisma.businessDoc.findFirst({ where: { projectId: project.id, ...(slug ? { slug } : {}) }, select: { id: true } });
  const rtm = doc ? await loadRtm(project.id, project.key, doc.id) : null;
  if (!rtm) return new Response("Not found", { status: 404 });
  const lines = [
    `# ${rtm.doc.title} v${rtm.version.versionNum} - dicetak ${new Date().toISOString()}`,
    ["Bagian", "Status requirement", "Test case", "Lolos", "Bug terbuka", "Status cakupan"].map(cell).join(","),
    ...rtm.rows.map((r) => [r.title, REQ_STATUS_LABEL[r.status], r.cases.map((c) => c.code).join(" "), `${r.passed}/${r.cases.length}`, r.openBugs.map((b) => b.key).join(" "), COVERAGE_LABEL[r.coverage]].map(cell).join(",")),
  ];
  return new Response(lines.join("\n"), { headers: { "content-type": "text/csv; charset=utf-8", "content-disposition": `attachment; filename="rtm-${project.key}.csv"` } });
}
