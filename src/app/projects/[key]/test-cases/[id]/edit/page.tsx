import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { activeModules } from "@/lib/modules";
import { AppShell } from "@/components/layout/app-shell";
import { ForbiddenState } from "@/components/ui/forbidden-state";
import { hasPermission } from "@/lib/permissions";
import { notFound, redirect } from "next/navigation";
import { TestCaseForm } from "../../test-case-form";

export default async function EditTestCasePage({
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
  if (!hasPermission(role, "testcase.manage", user.isAdmin)) {
    return <ForbiddenState projectKey={project.key} />;
  }

  const testCase = await prisma.testCase.findFirst({
    where: { id, projectId: project.id },
    include: {
      versions: {
        orderBy: { version: "desc" },
        take: 1,
      },
    },
  });

  if (!testCase) notFound();

  const modules = await activeModules(project.id);
  const currentVersion = testCase.versions[0]?.version || 1;

  return (
    <AppShell activeProjectKey={project.key}>
      <TestCaseForm
        projectId={project.id}
        projectKey={project.key}
        modules={modules.map((m) => ({ id: m.id, name: m.name }))}
        initialData={{
          id: testCase.id,
          code: testCase.code,
          title: testCase.title,
          moduleId: testCase.moduleId,
          priority: testCase.priority,
          status: testCase.status,
          testType: testCase.testType,
          targetRole: testCase.targetRole,
          precondition: testCase.precondition,
          steps: testCase.steps,
          expectedResult: testCase.expectedResult,
          referenceUrl: testCase.referenceUrl,
          version: currentVersion,
        }}
      />
    </AppShell>
  );
}
