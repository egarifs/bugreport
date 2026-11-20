import { defineConfig } from "vitest/config";
import { resolve } from "node:path";

export default defineConfig({
  oxc: { jsx: { runtime: "automatic" } }, // tsconfig uses jsx:preserve (Next.js); tests need real JSX transform
  resolve: {
    alias: { "@": resolve(import.meta.dirname, "src") },
  },
  test: {
    include: ["prisma/**/*.vitest.ts", "src/**/*.vitest.ts"],
  },
});
