import type { Metadata } from "next";
import { Atkinson_Hyperlegible } from "next/font/google";
import "./globals.css";

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
    <html
      lang="id"
      className={`${sans.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">{children}</body>
    </html>
  );
}
