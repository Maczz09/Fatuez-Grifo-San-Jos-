import { defineConfig } from "vitest/config";
import { fileURLToPath } from "node:url";
export default defineConfig({
  // Next.js conserva JSX para su compilador; las pruebas SSR sí lo transforman.
  oxc: { jsx: { runtime: "automatic" } },
  resolve: { alias: { "@factuez/service-access": fileURLToPath(new URL("./packages/service-access/src/index.ts", import.meta.url)) } },
  test: {
    include: ["tests/**/*.spec.ts", "src/**/*.{test,spec}.ts", "packages/*/src/**/*.{test,spec}.ts"],
    environment: "node",
  },
});
