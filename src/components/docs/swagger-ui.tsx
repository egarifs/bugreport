"use client";
import Script from "next/script";
import { useEffect } from "react";

export function SwaggerUI() {
  useEffect(() => {
    const href = "/swagger/swagger-ui.css";
    if (document.querySelector(`link[href="${href}"]`)) return;
    const link = document.createElement("link");
    link.rel = "stylesheet";
    link.href = href;
    document.head.appendChild(link);
  }, []);

  return (
    <>
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
