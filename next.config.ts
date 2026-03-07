import type { NextConfig } from "next"
import { withSentryConfig } from "@sentry/nextjs"

const nextConfig: NextConfig = {
  reactStrictMode: true,

  experimental: {
    typedRoutes: true,
  },

  // Block server-only modules from being bundled to the client
  serverExternalPackages: ["@prisma/client", "prisma"],
}

export default withSentryConfig(nextConfig, {
  // Sentry org / project (set in CI via env vars — not hardcoded)
  silent: true, // suppress noisy source-map upload output in local builds
  widenClientFileUpload: true,
  sourcemaps: { deleteSourcemapsAfterUpload: true },
  disableLogger: true,
  automaticVercelMonitors: true,
})
