"use client";
import Script from "next/script";

export function SwaggerUI() {
  return (
    <>
      <link rel="stylesheet" href="/swagger/swagger-ui.css" />
      <div id="swagger-ui" />
      <Script
        src="/swagger/swagger-ui-bundle.js"
        strategy="afterInteractive"
        onLoad={() => {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const S = (window as any).SwaggerUIBundle;
          if (S) {
            S({
              url: "/api/docs/openapi.json",
              dom_id: "#swagger-ui",
              deepLinking: true,
              presets: [S.presets.apis, S.SwaggerUIStandalonePreset],
              layout: "BaseLayout",
            });
          }
        }}
      />
    </>
  );
}
