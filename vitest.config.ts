import { defineConfig } from "vitest/config"
import react from "@vitejs/plugin-react"
import path from "path"

export default defineConfig({
  plugins: [react()],
  test: {
    environment: "node",
    globals: true,
    setupFiles: [],
    exclude: ["**/node_modules/**", "**/.next/**", "**/tests/e2e/**"],
    coverage: {
      provider: "v8",
      reporter: ["text", "json", "html"],
      exclude: [
        "node_modules/**",
        ".next/**",
        "prisma/**",
        "*.config.*",
        "src/app/api/**", // Next.js route handlers (framework boilerplate)
        "src/app/layout.tsx", // Root layout (no logic)
        "src/app/page.tsx", // Placeholder page
        "src/app/globals.css",
        "src/types/**",
        "tests/**",
      ],
      thresholds: {
        global: {
          lines: 80,
          functions: 80,
          branches: 80,
          statements: 80,
        },
      },
    },
  },
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
})
