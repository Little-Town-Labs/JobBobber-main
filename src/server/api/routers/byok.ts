// Not part of the public REST API — internal BYOK key management, UI-only router.
import { z } from "zod"
import { TRPCError } from "@trpc/server"
import { clerkClient } from "@clerk/nextjs/server"
import { createTRPCRouter, onboardingProcedure } from "@/server/api/trpc"
import { encrypt } from "@/lib/encryption"
import { logAudit } from "@/lib/audit"

/**
 * BYOK (Bring Your Own Key) router — API key management.
 *
 * Uses `onboardingProcedure` (requires userId only) then manually enforces
 * userRole !== null with FORBIDDEN. This intentionally separates UNAUTHORIZED
 * (no session) from FORBIDDEN (session but onboarding incomplete).
 *
 * Key format validation is enforced by Zod before any fetch occurs.
 *
 * @see .specify/specs/2-authentication-byok/contracts/trpc-contracts.ts
 */

// ---------------------------------------------------------------------------
// Provider config
// ---------------------------------------------------------------------------

const PROVIDER_CONFIG = {
  openai: {
    prefix: "sk-",
    excludePrefix: "sk-ant-",
    validationUrl: "https://api.openai.com/v1/models",
    authHeader: (key: string) => ({ Authorization: `Bearer ${key}` }),
  },
  anthropic: {
    prefix: "sk-ant-",
    excludePrefix: null,
    validationUrl: "https://api.anthropic.com/v1/models",
    authHeader: (key: string) => ({ "x-api-key": key, "anthropic-version": "2023-06-01" }),
  },
} as const

type Provider = keyof typeof PROVIDER_CONFIG

// ---------------------------------------------------------------------------
// Input schemas
// ---------------------------------------------------------------------------

const StoreKeyInput = z.object({
  provider: z.enum(["openai", "anthropic"]),
  // trim() strips accidental whitespace; min(1) rejects empty; max(512) prevents DoS via huge payloads to encrypt/fetch
  apiKey: z.string().trim().min(1).max(512),
})

// ---------------------------------------------------------------------------
// Key format validation
// ---------------------------------------------------------------------------

function validateKeyFormat(provider: Provider, apiKey: string): void {
  const config = PROVIDER_CONFIG[provider]
  if (!apiKey.startsWith(config.prefix)) {
    throw new TRPCError({
      code: "BAD_REQUEST",
      message: `Invalid key format for ${provider}. Keys must start with "${config.prefix}".`,
    })
  }
  if (config.excludePrefix && apiKey.startsWith(config.excludePrefix)) {
    throw new TRPCError({
      code: "BAD_REQUEST",
      message: `Invalid key format for ${provider}. Keys must start with "${config.prefix}".`,
    })
  }
}

// ---------------------------------------------------------------------------
// Provider API validation (live check)
// ---------------------------------------------------------------------------

async function validateWithProvider(provider: Provider, apiKey: string): Promise<void> {
  const config = PROVIDER_CONFIG[provider]
  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), 10_000)

  let response: Response
  try {
    response = await fetch(config.validationUrl, {
      method: "GET",
      headers: config.authHeader(apiKey) as Record<string, string>,
      signal: controller.signal,
    })
  } catch (err) {
    if (err instanceof Error && err.name === "AbortError") {
      throw new TRPCError({
        code: "INTERNAL_SERVER_ERROR",
        message: "API provider validation timed out. Please try again.",
        cause: err,
      })
    }
    throw new TRPCError({
      code: "INTERNAL_SERVER_ERROR",
      message: "Failed to reach API provider. Please check your connection.",
      cause: err,
    })
  } finally {
    clearTimeout(timeout)
  }

  if (response.status === 429) {
    throw new TRPCError({
      code: "BAD_REQUEST",
      message: "Rate limit reached on the API provider. Please try again later.",
    })
  }

  if (!response.ok) {
    throw new TRPCError({
      code: "BAD_REQUEST",
      message: "Invalid API key. The key was rejected by the provider.",
    })
  }
}

// ---------------------------------------------------------------------------
// Masking
// ---------------------------------------------------------------------------

function maskKey(apiKey: string): string {
  if (apiKey.length <= 8) return "***"
  return `${apiKey.slice(0, 7)}...${apiKey.slice(-4)}`
}

// ---------------------------------------------------------------------------
// Router
// ---------------------------------------------------------------------------

export const byokRouter = createTRPCRouter({
  /**
   * Store a validated, encrypted API key for the authenticated user.
   *
   * Flow:
   *  1. Validate key format (Zod + prefix check)
   *  2. Validate key against the provider's live API
   *  3. Encrypt the key
   *  4. Store in role-appropriate DB record
   *  5. Update Clerk publicMetadata: { hasByokKey: true }
   */
  storeKey: onboardingProcedure.input(StoreKeyInput).mutation(async ({ ctx, input }) => {
    if (!ctx.userRole) {
      throw new TRPCError({ code: "FORBIDDEN", message: "Role required to store API key." })
    }

    const { provider, apiKey } = input

    // Step 1: Format validation
    validateKeyFormat(provider, apiKey)

    // Step 2: Live provider validation
    await validateWithProvider(provider, apiKey)

    // Step 3: Encrypt
    const encrypted = await encrypt(apiKey, ctx.userId)
    const maskedKey = maskKey(apiKey)

    // Step 4: Store in DB (role-appropriate table)
    if (ctx.userRole === "JOB_SEEKER") {
      const settings = await ctx.db.seekerSettings.findFirst({
        where: { seeker: { clerkUserId: ctx.userId } },
      })
      if (!settings) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Seeker settings not found." })
      }
      await ctx.db.seekerSettings.update({
        where: { id: settings.id },
        data: {
          byokApiKeyEncrypted: encrypted,
          byokProvider: provider,
          byokKeyValidatedAt: new Date(),
          byokMaskedKey: maskedKey,
        },
      })
    } else {
      // EMPLOYER
      const employer = await ctx.db.employer.findFirst({
        where: { clerkOrgId: ctx.orgId ?? "" },
      })
      if (!employer) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Employer not found." })
      }
      await ctx.db.employer.update({
        where: { id: employer.id },
        data: {
          byokApiKeyEncrypted: encrypted,
          byokProvider: provider,
          byokKeyValidatedAt: new Date(),
          byokMaskedKey: maskedKey,
        },
      })
    }

    // Step 5: Update Clerk metadata
    const clerk = await clerkClient()
    await clerk.users.updateUserMetadata(ctx.userId, {
      publicMetadata: { hasByokKey: true },
    })

    void logAudit({
      actorId: ctx.userId,
      actorType: ctx.userRole === "JOB_SEEKER" ? "JOB_SEEKER" : "EMPLOYER",
      action: "byok.store_key",
      entityType: "ApiKey",
      metadata: { provider },
      result: "SUCCESS",
    })

    return { success: true as const, provider, maskedKey }
  }),

  /**
   * Delete the stored API key for the authenticated user.
   * No-op if no key is stored.
   */
  deleteKey: onboardingProcedure.mutation(async ({ ctx }) => {
    if (!ctx.userRole) {
      throw new TRPCError({ code: "FORBIDDEN", message: "Role required." })
    }

    if (ctx.userRole === "JOB_SEEKER") {
      const settings = await ctx.db.seekerSettings.findFirst({
        where: { seeker: { clerkUserId: ctx.userId } },
      })
      if (!settings?.byokApiKeyEncrypted) {
        return { success: true as const }
      }
      await ctx.db.seekerSettings.update({
        where: { id: settings.id },
        data: { byokApiKeyEncrypted: null, byokMaskedKey: null },
      })
    } else {
      // EMPLOYER
      const employer = await ctx.db.employer.findFirst({
        where: { clerkOrgId: ctx.orgId ?? "" },
      })
      if (!employer?.byokApiKeyEncrypted) {
        return { success: true as const }
      }
      await ctx.db.employer.update({
        where: { id: employer.id },
        data: { byokApiKeyEncrypted: null, byokMaskedKey: null },
      })
    }

    const clerk = await clerkClient()
    await clerk.users.updateUserMetadata(ctx.userId, {
      publicMetadata: { hasByokKey: false },
    })

    void logAudit({
      actorId: ctx.userId,
      actorType: ctx.userRole === "JOB_SEEKER" ? "JOB_SEEKER" : "EMPLOYER",
      action: "byok.delete_key",
      entityType: "ApiKey",
      result: "SUCCESS",
    })

    return { success: true as const }
  }),

  /**
   * Get the current BYOK key status for the authenticated user.
   * Self-heals: re-syncs Clerk metadata if DB has a key but JWT claims hasByokKey=false.
   */
  getKeyStatus: onboardingProcedure.query(async ({ ctx }) => {
    if (!ctx.userRole) {
      throw new TRPCError({ code: "FORBIDDEN", message: "Role required." })
    }

    let hasKey = false
    let provider: string | null = null
    let maskedKey: string | null = null

    if (ctx.userRole === "JOB_SEEKER") {
      const settings = await ctx.db.seekerSettings.findFirst({
        where: { seeker: { clerkUserId: ctx.userId } },
      })
      hasKey = !!settings?.byokApiKeyEncrypted
      provider = settings?.byokProvider ?? null
      maskedKey = settings?.byokMaskedKey ?? null
    } else {
      const employer = await ctx.db.employer.findFirst({
        where: { clerkOrgId: ctx.orgId ?? "" },
      })
      hasKey = !!employer?.byokApiKeyEncrypted
      provider = employer?.byokProvider ?? null
      maskedKey = employer?.byokMaskedKey ?? null
    }

    // Self-heal: re-sync Clerk if DB says key exists but JWT doesn't reflect it.
    // Best-effort: failure to sync Clerk metadata doesn't block the read response.
    if (hasKey && !ctx.hasByokKey) {
      try {
        const clerk = await clerkClient()
        await clerk.users.updateUserMetadata(ctx.userId, {
          publicMetadata: { hasByokKey: true },
        })
      } catch {
        // Non-critical — next key write/delete will re-sync
      }
    }

    return { hasKey, provider, maskedKey }
  }),
})
