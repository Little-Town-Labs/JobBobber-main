/**
 * Vitest global test setup
 *
 * Mocks packages that enforce server-only constraints so they work in the
 * Vitest test environment (which runs in Node but not Next.js App Router context).
 */
import "@testing-library/jest-dom/vitest"
import { vi } from "vitest"

// server-only enforces that imports only happen in server modules.
// In tests (Node environment) we bypass this constraint by mocking the module.
vi.mock("server-only", () => ({}))

// Vercel Flags SDK makes network calls to resolve flags at runtime.
// Mock it globally so all tests get deterministic default values without network.
vi.mock("@vercel/flags/next", () => ({
  flag: <T>(opts: { defaultValue: T }) => () => opts.defaultValue,
}))
