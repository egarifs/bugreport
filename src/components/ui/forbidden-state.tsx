import { AppShell } from "@/components/layout/app-shell";
import { StatePanel } from "./state-panel";

export function ForbiddenState({ projectKey }: { projectKey: string }) {
  return (
    <AppShell activeProjectKey={projectKey}>
      <div className="max-w-lg mx-auto p-8 mt-16 w-full">
        <StatePanel kind="forbidden" action={{ label: "Kembali ke daftar bug", href: `/projects/${projectKey}` }}>
          Peran Anda di project ini tidak mencakup halaman ini.
        </StatePanel>
      </div>
    </AppShell>
  );
}
