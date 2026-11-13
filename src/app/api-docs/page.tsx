import { AppShell } from "@/components/layout/app-shell";
import { SwaggerUI } from "@/components/docs/swagger-ui";

export default function SwaggerDocsPage() {
  return (
    <AppShell>
      <div className="min-h-full flex flex-col bg-surface">
        <header className="border-b border-slate-200 px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <span className="font-semibold text-slate-900 text-sm">
              API Documentation & Swagger UI
            </span>
            <span className="text-xs font-mono px-2 py-0.5 rounded bg-ok-bg text-ok">
              OpenAPI 3.0
            </span>
          </div>
          <a
            href="/api/docs/openapi.json"
            target="_blank"
            className="text-xs text-link hover:underline"
          >
            Raw OpenAPI Spec JSON ↗
          </a>
        </header>

        <main className="flex-1 p-2">
          <SwaggerUI />
        </main>
      </div>
    </AppShell>
  );
}
