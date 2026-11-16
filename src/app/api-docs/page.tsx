import { AppShell } from "@/components/layout/app-shell";
import { SwaggerUI } from "@/components/docs/swagger-ui";

export default function SwaggerDocsPage() {
  return (
    <AppShell>
      <div className="min-h-full flex flex-col bg-surface">
        <header className="border-b border-slate-200 px-6 py-4 flex flex-wrap items-start justify-between gap-3">
          <div>
            <div className="text-xs text-slate-500">Pengembang</div>
            <h1 className="text-xl font-bold text-slate-900">API &amp; Swagger</h1>
            <p className="text-sm text-slate-500">
              Autentikasi dengan API key di header <code className="font-mono">Authorization: Bearer &lt;kunci&gt;</code>. Kunci dibuat di Pengaturan project.
            </p>
          </div>
          <div className="flex items-center gap-3">
            <span className="text-xs font-mono px-2 py-0.5 rounded bg-ok-bg text-ok">OpenAPI 3.0</span>
            <a href="/api/docs/openapi.json" target="_blank" rel="noreferrer" className="text-sm text-link hover:underline min-h-[44px] flex items-center">
              Spec JSON ↗
            </a>
          </div>
        </header>

        <main className="flex-1 p-2">
          <SwaggerUI />
        </main>
      </div>
    </AppShell>
  );
}
