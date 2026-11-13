"use client";
import Script from "next/script";

export function SwaggerUI() {
  return (
    <>
      <link rel="stylesheet" href="https://unpkg.com/swagger-ui-dist@5.18.2/swagger-ui.css" />
      <div id="swagger-ui" />
      <Script
        src="https://unpkg.com/swagger-ui-dist@5.18.2/swagger-ui-bundle.js"
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
