import type { Metadata } from "next";
import { Atkinson_Hyperlegible } from "next/font/google";
// Same family as the UI font, made for code: IDs and keys like CRM-101 or br_live_c2b8 read cleanly.
// Self-hosted from @fontsource because next/font/google does not list the Mono cut yet.
import "@fontsource/atkinson-hyperlegible-mono/400.css";
import "@fontsource/atkinson-hyperlegible-mono/700.css";
import "./globals.css";
import { THEME_INIT_SCRIPT } from "@/lib/theme";

// Designed so 1/l/I and 0/O never collide: bug IDs like CRM-101 stay legible in dense rows.
const sans = Atkinson_Hyperlegible({ variable: "--font-sans", subsets: ["latin"], weight: ["400", "700"] });

export const metadata: Metadata = {
  title: "BugReport by egarifs",
  description: "Bug tracking QA multi-project dengan kolaborasi vendor",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    // data-theme is set by the inline script before React hydrates, so the server markup cannot know it.
    <html lang="id" className={`${sans.variable} h-full antialiased`} suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: THEME_INIT_SCRIPT }} />
      </head>
      <body className="min-h-full flex flex-col">{children}</body>
    </html>
  );
}
