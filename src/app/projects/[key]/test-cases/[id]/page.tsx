import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { AppShell } from "@/components/layout/app-shell";
import { ForbiddenState } from "@/components/ui/forbidden-state";
import { hasPermission } from "@/lib/permissions";
import { notFound, redirect } from "next/navigation";
import { getTestCaseDetail } from "@/lib/testcase-service";
import { TestCaseDetailView } from "./test-case-detail-view";

export default async function TestCaseDetailPage({
  params,
}: {
  params: Promise<{ key: string; id: string }>;
}) {
  const session = await auth();
  const user = session?.user as { id?: string; email?: string; isAdmin?: boolean } | undefined;
  if (!user?.id || !user.email) redirect("/login");

  const { key, id } = await params;
  const project = await prisma.project.findUnique({
    where: { key: key.toUpperCase() },
    include: {
      members: { where: { userId: user.id } },
    },
  });

  if (!project) notFound();
  if (!project.members[0] && !user.isAdmin) redirect("/projects");

  const role = project.members[0]?.role ?? (user.isAdmin ? "ADMIN" : "VIEWER");
  if (!hasPermission(role, "testcase.read", user.isAdmin)) {
    return <ForbiddenState projectKey={project.key} />;
  }
  const canManage = hasPermission(role, "testcase.manage", user.isAdmin);

  const testCase = await getTestCaseDetail(project.id, id);
  if (!testCase) notFound();

  return (
    <AppShell activeProjectKey={project.key}>
      <TestCaseDetailView
        projectId={project.id}
        projectKey={project.key}
        canManage={canManage}
        testCase={testCase as unknown as React.ComponentProps<typeof TestCaseDetailView>["testCase"]}
      />
    </AppShell>
  );
}
