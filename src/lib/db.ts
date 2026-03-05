import "server-only"
import { PrismaClient } from "@prisma/client"

/**
 * Prisma client singleton.
 *
 * In development, Next.js hot-reloads modules on each request.
 * Without this pattern, each reload creates a new PrismaClient connection,
 * quickly exhausting the NeonDB connection pool.
 *
 * The global variable persists across HMR cycles; production builds only
 * ever run this module once, so the singleton branch is never hit there.
 *
 * @see https://www.prisma.io/docs/guides/nextjs
 * @see data-model.md → Database Connection
 */

const globalForPrisma = globalThis as unknown as { prisma: PrismaClient | undefined }

export const db: PrismaClient =
  globalForPrisma.prisma ??
  new PrismaClient({
    log: process.env["NODE_ENV"] === "development" ? ["query", "error", "warn"] : ["error"],
  })

if (process.env["NODE_ENV"] !== "production") {
  globalForPrisma.prisma = db
}
