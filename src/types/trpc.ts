/**
 * Shared tRPC output types — mirrors contracts/trpc-api.ts for use in
 * the implementation layer. Kept minimal; full contracts live in the spec.
 *
 * @see .specify/specs/1-foundation-infrastructure/contracts/trpc-api.ts
 */

export interface HealthPingOutput {
  status: "ok"
  timestamp: string
}

export interface HealthDeepCheckOutput {
  healthy: boolean
  checks: Array<{
    name: "database" | "clerk"
    status: "ok" | "degraded" | "unreachable"
    latencyMs: number
  }>
  timestamp: string
}
