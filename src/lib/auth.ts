import "server-only"
import { auth, clerkClient } from "@clerk/nextjs/server"

/**
 * Typed result from Clerk's auth() function.
 *
 * Clerk's exported types don't always match the runtime shape (especially
 * sessionClaims.metadata). This interface defines the actual runtime contract
 * so we cast once here instead of at every call site.
 */
export interface AuthResult {
  userId: string | null
  orgId: string | null
  orgRole: "org:admin" | "org:member" | null
  sessionClaims?: {
    metadata?: {
      role?: "JOB_SEEKER" | "EMPLOYER"
      hasByokKey?: boolean
    }
  }
}

/**
 * Get the current Clerk auth session with correct types.
 * Single cast boundary — all consumers use this instead of raw auth().
 */
export async function getAuth(): Promise<AuthResult> {
  const result = await (auth() as unknown as Promise<AuthResult>)
  return {
    userId: result.userId ?? null,
    orgId: result.orgId ?? null,
    orgRole: result.orgRole ?? null,
    sessionClaims: result.sessionClaims,
  }
}

/**
 * Get an initialized Clerk client instance.
 * Clerk v5+ changed clerkClient from a direct export to a factory function.
 * This helper handles the cast once.
 */
export async function getClerkInstance() {
  return (clerkClient as unknown as () => Promise<unknown>)() as Promise<{
    users: {
      getUser: (userId: string) => Promise<{
        emailAddresses: Array<{ emailAddress: string }>
        primaryEmailAddressId: string | null
      }>
    }
  }>
}
