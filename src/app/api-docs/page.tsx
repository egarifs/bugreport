import { AppShell } from "@/components/layout/app-shell";
import Script from "next/script";

export default function SwaggerDocsPage() {
  return (
    <AppShell>
      <div className="min-h-full flex flex-col bg-white">
        <header className="border-b border-slate-200 px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <span className="font-semibold text-slate-900 text-sm">
              API Documentation & Swagger UI
            </span>
            <span className="text-xs font-mono px-2 py-0.5 rounded bg-emerald-100 text-emerald-800">
              OpenAPI 3.0
            </span>
          </div>
          <a
            href="/api/docs/openapi.json"
            target="_blank"
            className="text-xs text-blue-600 hover:underline"
          >
            Raw OpenAPI Spec JSON ↗
          </a>
        </header>

        <main className="flex-1 p-2">
          {/* Native Swagger UI bundle via unpkg without extra npm packages */}
          <link
            rel="stylesheet"
            href="https://unpkg.com/swagger-ui-dist@5.18.2/swagger-ui.css"
          />
          <div id="swagger-ui" />
          <Script
            src="https://unpkg.com/swagger-ui-dist@5.18.2/swagger-ui-bundle.js"
            strategy="afterInteractive"
            onLoad={() => {
              // @ts-expect-error SwaggerUIBundle injected globally
              if (window.SwaggerUIBundle) {
                // @ts-expect-error SwaggerUIBundle injected globally
                window.SwaggerUIBundle({
                  url: "/api/docs/openapi.json",
                  dom_id: "#swagger-ui",
                  deepLinking: true,
                  presets: [
                    // @ts-expect-error presets
                    window.SwaggerUIBundle.presets.apis,
                    // @ts-expect-error presets
                    window.SwaggerUIBundle.SwaggerUIStandalonePreset,
                  ],
                  layout: "BaseLayout",
                });
              }
            }}
          />
        </main>
      </div>
    </AppShell>
  );
}
