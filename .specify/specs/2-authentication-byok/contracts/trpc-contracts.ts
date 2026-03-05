/**
 * JobBobber tRPC API Contracts — Authentication & BYOK
 *
 * This file is a DESIGN ARTIFACT, not a runnable implementation.
 * It defines the type-level contract that the two new routers must satisfy.
 *
 * Feature Branch : 2-authentication-byok
 * Spec Reference : .specify/specs/2-authentication-byok/spec.md
 * Date           : 2026-02-23
 *
 * Implementation targets:
 *   src/server/api/routers/onboarding.ts   ← onboardingRouter
 *   src/server/api/routers/byok.ts         ← byokRouter
 *   src/server/api/root.ts                 ← add both routers to appRouter
 *   src/server/api/trpc.ts                 ← add onboardingProcedure (see §MIDDLEWARE NOTE)
 *   prisma/schema.prisma                   ← add fields to Employer (see §SCHEMA DELTA)
 */

import { z } from "zod"

// =============================================================================
// MIDDLEWARE NOTE — onboardingProcedure (new middleware tier required)
// =============================================================================
//
// PROBLEM: The existing `protectedProcedure` uses `enforceAuthenticated`, which
// requires BOTH `ctx.userId` AND `ctx.userRole` to be non-null:
//
//   if (!ctx.userId || !ctx.userRole) throw new TRPCError({ code: "UNAUTHORIZED" })
//
// A user who has just completed Clerk sign-up has a valid session (userId is set)
// but has NOT yet been assigned a role (userRole === null). `setRole` is the
// procedure that CREATES the role — it therefore cannot be gated by a middleware
// that REQUIRES the role to already exist.
//
// SOLUTION: Add a new `onboardingProcedure` tier to src/server/api/trpc.ts:
//
//   const enforceSession = t.middleware(({ ctx, next }) => {
//     if (!ctx.userId) {
//       throw new TRPCError({ code: "UNAUTHORIZED" })
//     }
//     return next({ ctx: { ...ctx, userId: ctx.userId } })
//   })
//   export const onboardingProcedure = t.procedure.use(enforceSession)
//
// Hierarchy after this addition:
//
//   publicProcedure
//     └─ onboardingProcedure   → userId required; userRole may be null
//           └─ protectedProcedure → userId + userRole required
//                 ├─ seekerProcedure
//                 └─ employerProcedure
//                       └─ adminProcedure
//
// `onboardingProcedure` is used exclusively by onboardingRouter.setRole.
// No other router should use it.

// =============================================================================
// SCHEMA DELTA — Prisma additions required (prisma/schema.prisma)
// =============================================================================
//
// The current Employer model (line ~168 of schema.prisma) does NOT have BYOK
// fields. SeekerSettings and JobSettings have them. The BYOK design calls for
// per-user key storage: job seekers store in SeekerSettings, employers store
// on the Employer model directly (org-level key, not job-level).
//
// Add the following two fields to the Employer model:
//
//   model Employer {
//     ...existing fields...
//     byokApiKeyEncrypted  String?   // AES-256-GCM, base64. See src/lib/encryption.ts
//     byokProvider         String?   // "openai" | "anthropic"
//   }
//
// This requires a Prisma migration. Migration name suggestion:
//   add_byok_fields_to_employer
//
// NOTE: JobSettings already has byokApiKeyEncrypted + byokProvider (line ~261).
// That model is for per-job-posting private settings and is NOT used by the
// byokRouter. Employer.byok* is the correct target for the employer BYOK flow.

// =============================================================================
// SHARED VALIDATION PRIMITIVES
// =============================================================================

/**
 * Provider discriminant.
 * Used in both input schemas and DB storage (`byokProvider` column).
 */
export const ProviderSchema = z.enum(["openai", "anthropic"])
export type Provider = z.infer<typeof ProviderSchema>

/**
 * Raw API key validator.
 *
 * Format rules (pre-validation before the live provider call):
 *
 *   OpenAI keys    — start with "sk-"     (includes new "sk-proj-..." format)
 *                    example: sk-abc123...
 *                    example: sk-proj-abc123...
 *                    NOT starting with "sk-ant-" (that is Anthropic's prefix)
 *
 *   Anthropic keys — start with "sk-ant-"
 *                    example: sk-ant-api03-abc123...
 *
 * The `provider` field in the parent input is used together with this schema
 * via `.superRefine()` to cross-validate the prefix. See ByokStoreKeyInputSchema.
 *
 * Length bounds: 20 chars minimum (shortest realistic key), 256 chars maximum
 * (generous upper bound; current OpenAI keys are ~51 chars, Anthropic ~108 chars).
 *
 * SECURITY: The raw key must NEVER be logged, stored unencrypted, or returned
 * in any response. It is consumed once — validated, encrypted, then discarded
 * from application memory.
 */
export const RawApiKeySchema = z
  .string()
  .min(20, "API key is too short")
  .max(256, "API key is too long")
  .refine((v) => v.startsWith("sk-"), {
    message: "API key must start with 'sk-'",
  })

/**
 * Provider-aware API key validator.
 * Applies prefix cross-validation based on the selected provider.
 *
 * Usage: call `.superRefine()` on the parent object schema, as shown in
 * ByokStoreKeyInputSchema below — the key string alone cannot be validated
 * without knowing which provider was selected.
 *
 * Rules:
 *   provider === "openai"    → key must NOT start with "sk-ant-"
 *   provider === "anthropic" → key must start with "sk-ant-"
 *
 * These checks are soft guards only — the authoritative validation is the
 * live provider call in the procedure handler. Prefix checks prevent
 * obviously-wrong submissions from reaching the network.
 */
function refineApiKeyForProvider(
  data: { provider: Provider; apiKey: string },
  ctx: z.RefinementCtx,
) {
  const { provider, apiKey } = data

  if (provider === "openai" && apiKey.startsWith("sk-ant-")) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ["apiKey"],
      message: "This looks like an Anthropic key. Select 'anthropic' as the provider.",
    })
    return
  }

  if (provider === "anthropic" && !apiKey.startsWith("sk-ant-")) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ["apiKey"],
      message: "Anthropic keys must start with 'sk-ant-'. Check the key or select 'openai'.",
    })
  }
}

// =============================================================================
// onboardingRouter — CONTRACTS
// =============================================================================

// -----------------------------------------------------------------------------
// onboarding.setRole
// -----------------------------------------------------------------------------

/**
 * Input schema for the setRole mutation.
 *
 * When role === "EMPLOYER", companyName is required (min 2, max 100 chars).
 * When role === "JOB_SEEKER", companyName must be absent or undefined.
 *
 * The `.superRefine()` enforces the conditional requirement so the Zod
 * error is attached to the `companyName` field (not the root object),
 * giving front-end form libraries a usable field-level error path.
 */
export const SetRoleInputSchema = z
  .object({
    role: z.enum(["JOB_SEEKER", "EMPLOYER"]),
    companyName: z
      .string()
      .min(2, "Company name must be at least 2 characters")
      .max(100)
      .optional(),
  })
  .superRefine((data, ctx) => {
    if (data.role === "EMPLOYER" && !data.companyName?.trim()) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["companyName"],
        message: "Company name is required for employer accounts",
      })
    }
  })

export type SetRoleInput = z.infer<typeof SetRoleInputSchema>

/**
 * Output of the setRole mutation.
 *
 * `redirectTo` is a relative URL the client MUST navigate to after success.
 * Always '/setup/api-key' — hard-coded so the middleware gate and the API
 * response stay in sync. Clients must not hard-code this path independently.
 */
export const SetRoleOutputSchema = z.object({
  success: z.literal(true),
  redirectTo: z.literal("/setup/api-key"),
})

export type SetRoleOutput = z.infer<typeof SetRoleOutputSchema>

/**
 * onboarding.setRole
 *
 * Procedure tier : onboardingProcedure (userId required; userRole may be null)
 * HTTP method    : mutation (POST)
 * Route key      : trpc.onboarding.setRole
 *
 * PURPOSE
 * -------
 * Called from the /onboarding/role page. An authenticated user with no role
 * selects JOB_SEEKER or EMPLOYER. The mutation creates all required DB rows
 * and writes the role to Clerk publicMetadata.
 *
 * IDEMPOTENCY
 * -----------
 * If ctx.userRole is already set (non-null), the mutation short-circuits and
 * returns { success: true, redirectTo: '/setup/api-key' } immediately without
 * re-running any side effects. This prevents double-creation on browser
 * back/forward or duplicate submissions.
 *
 * SEQUENTIAL SIDE EFFECTS — JOB_SEEKER path
 * ------------------------------------------
 * 1. Write { role: 'JOB_SEEKER' } to Clerk user publicMetadata
 *    via clerkClient.users.updateUserMetadata(ctx.userId, { publicMetadata: { role: 'JOB_SEEKER' } })
 * 2. Create JobSeeker DB row:
 *    { clerkUserId: ctx.userId, name: <displayName from Clerk user object> }
 *    displayName = user.firstName + ' ' + user.lastName, or user.username,
 *    or user.emailAddresses[0].emailAddress as final fallback.
 * 3. Create SeekerSettings DB row:
 *    { seekerId: <JobSeeker.id from step 2> }
 *    All other fields take schema defaults.
 *
 * SEQUENTIAL SIDE EFFECTS — EMPLOYER path
 * ----------------------------------------
 * 1. Create Clerk Organization:
 *    clerkClient.organizations.createOrganization({ name: input.companyName, createdBy: ctx.userId })
 *    → capture returned org.id as clerkOrgId
 * 2. Write { role: 'EMPLOYER' } to Clerk user publicMetadata
 *    via clerkClient.users.updateUserMetadata(ctx.userId, { publicMetadata: { role: 'EMPLOYER' } })
 * 3. Create Employer DB row:
 *    { clerkOrgId: <org.id from step 1>, name: input.companyName }
 * 4. Create EmployerMember DB row:
 *    { employerId: <Employer.id from step 3>, clerkUserId: ctx.userId, role: 'ADMIN' }
 *
 * ATOMICITY
 * ---------
 * Steps 2–4 (EMPLOYER) and steps 2–3 (JOB_SEEKER) should be wrapped in a
 * Prisma $transaction so that a partial DB failure does not leave orphaned
 * records. The Clerk API call in step 1 cannot participate in the DB
 * transaction — if it fails, throw and do not proceed to DB writes.
 *
 * ERROR CODES
 * -----------
 * UNAUTHORIZED        — ctx.userId is null (no active Clerk session)
 * BAD_REQUEST         — Zod validation failure (invalid role, missing companyName,
 *                       companyName too short/long)
 * INTERNAL_SERVER_ERROR — Clerk API call failed; DB transaction failed.
 *                         Log full error to Sentry. Return generic message to client.
 *                         Never expose Clerk error details or DB error messages.
 *
 * NOTE: CONFLICT is intentionally NOT thrown for already-role-set users.
 * Idempotent success is the contract. See IDEMPOTENCY section above.
 */

// =============================================================================
// byokRouter — CONTRACTS
// =============================================================================

// -----------------------------------------------------------------------------
// byok.storeKey
// -----------------------------------------------------------------------------

/**
 * Input schema for the storeKey mutation.
 * Cross-validates provider ↔ key format prefix via superRefine.
 */
export const ByokStoreKeyInputSchema = z
  .object({
    provider: ProviderSchema,
    apiKey: RawApiKeySchema,
  })
  .superRefine(refineApiKeyForProvider)

export type ByokStoreKeyInput = z.infer<typeof ByokStoreKeyInputSchema>

/**
 * Output of the storeKey mutation.
 *
 * `maskedKey` format: "sk-...XXXX" where XXXX is the last 4 characters of
 * the plaintext key. No more than 4 characters of the key are ever revealed.
 * This is the same format shown to the user in getKeyStatus.
 *
 * SECURITY: The raw key is NEVER returned. The maskedKey is computed from
 * the plaintext before encryption and returned once here; it is also stored
 * so getKeyStatus can return the same value without decrypting.
 * Implementation note: store maskedKey as a separate non-sensitive column,
 * OR recompute it from the last 4 chars of the decrypted key — the former is
 * preferred to avoid unnecessary decryption on read.
 */
export const ByokStoreKeyOutputSchema = z.object({
  success: z.literal(true),
  provider: ProviderSchema,
  maskedKey: z.string().regex(/^sk-\.\.\.[A-Za-z0-9]{4}$/, "Unexpected masked key format"),
})

export type ByokStoreKeyOutput = z.infer<typeof ByokStoreKeyOutputSchema>

/**
 * byok.storeKey
 *
 * Procedure tier : protectedProcedure (userId + userRole required)
 *                  NOTE: does NOT use seekerProcedure or employerProcedure —
 *                  both roles are handled inside the same handler via ctx.userRole.
 * HTTP method    : mutation (POST)
 * Route key      : trpc.byok.storeKey
 *
 * PURPOSE
 * -------
 * Validates a user-provided API key against the live provider, encrypts it,
 * and stores it. Idempotent: a second call with a new key REPLACES the old
 * key (key rotation). No separate "rotate" endpoint is needed.
 *
 * SEQUENTIAL SIDE EFFECTS
 * -----------------------
 * 1. VALIDATE: Issue a live API call to the provider to confirm the key is
 *    active. Use the minimum-privilege endpoint for each provider:
 *
 *    OpenAI:    GET https://api.openai.com/v1/models
 *               Authorization: Bearer <apiKey>
 *               Expect: HTTP 200. Any non-200 → key invalid.
 *
 *    Anthropic: GET https://api.anthropic.com/v1/models
 *               x-api-key: <apiKey>
 *               anthropic-version: 2023-06-01
 *               Expect: HTTP 200. Any non-200 → key invalid.
 *
 *    Timeout: 10 seconds (per spec NFR). If the provider does not respond
 *    within 10 seconds, throw INTERNAL_SERVER_ERROR with message
 *    "Provider validation timed out. Please try again."
 *
 *    Rate limit (HTTP 429 from provider): throw BAD_REQUEST with message
 *    "The provider is temporarily rate-limiting validation requests. Please
 *    wait a moment and try again."
 *
 *    On any validation failure: throw BAD_REQUEST immediately. Do NOT
 *    proceed to encryption or storage. The stored key must never be in a
 *    partially-valid state.
 *
 * 2. ENCRYPT: Call encrypt(apiKey, ctx.userId) from src/lib/encryption.ts.
 *    This returns a base64 ciphertext string.
 *
 * 3. STORE (branch by role):
 *    JOB_SEEKER:
 *      UPDATE SeekerSettings SET
 *        byokApiKeyEncrypted = <ciphertext>,
 *        byokProvider        = <provider>
 *      WHERE seekerId = (SELECT id FROM job_seekers WHERE clerkUserId = ctx.userId)
 *
 *    EMPLOYER:
 *      UPDATE employers SET
 *        byokApiKeyEncrypted = <ciphertext>,
 *        byokProvider        = <provider>
 *      WHERE clerkOrgId = ctx.orgId
 *
 *    Both must be a single Prisma upsert/update wrapped such that a write
 *    failure is atomic — no partial key material is persisted.
 *
 * 4. UPDATE CLERK METADATA:
 *    clerkClient.users.updateUserMetadata(ctx.userId, {
 *      publicMetadata: { hasByokKey: true }
 *    })
 *    This is a best-effort call. If it fails, log the error but do NOT roll
 *    back the DB write — the DB is the authoritative BYOK state. The
 *    middleware gate re-checks Clerk metadata on next sign-in refresh.
 *
 * ERROR CODES
 * -----------
 * UNAUTHORIZED        — ctx.userId is null (no session)
 * FORBIDDEN           — ctx.userRole is null (role not yet assigned;
 *                       user skipped onboarding — redirect to /onboarding/role)
 * BAD_REQUEST         — Zod validation failure (key too short/long, wrong prefix,
 *                       provider/key mismatch)
 *                     — Live validation rejected the key (not active on provider)
 *                     — Provider returned HTTP 429 (rate limit)
 * PRECONDITION_FAILED — JOB_SEEKER: SeekerSettings row does not exist
 *                       (JobSeeker row was not created — onboarding incomplete)
 *                       EMPLOYER: Employer row does not exist for ctx.orgId
 * INTERNAL_SERVER_ERROR — Provider validation timeout (>10 s)
 *                       — Encryption module error
 *                       — DB write failure
 *                       Log all cases to Sentry before rethrowing sanitized message.
 *
 * SECURITY INVARIANTS
 * -------------------
 * - The plaintext apiKey MUST NOT appear in any log line, Sentry breadcrumb,
 *   or error message at any point after this procedure receives it.
 * - The plaintext apiKey MUST NOT be stored in any variable that outlives
 *   this procedure's execution scope (no caching, no session state).
 * - The maskedKey (last 4 chars) is the ONLY form of the key that may appear
 *   in responses, logs, or UI state.
 */

// -----------------------------------------------------------------------------
// byok.deleteKey
// -----------------------------------------------------------------------------

/**
 * byok.deleteKey takes no input.
 * Using z.void() here documents that the procedure handler receives no input
 * object — tRPC v11 allows .mutation() without .input() for void cases.
 */
export const ByokDeleteKeyInputSchema = z.void()

export const ByokDeleteKeyOutputSchema = z.object({
  success: z.literal(true),
})

export type ByokDeleteKeyOutput = z.infer<typeof ByokDeleteKeyOutputSchema>

/**
 * byok.deleteKey
 *
 * Procedure tier : protectedProcedure (userId + userRole required)
 * HTTP method    : mutation (POST)
 * Route key      : trpc.byok.deleteKey
 *
 * PURPOSE
 * -------
 * Removes the stored encrypted key and updates Clerk metadata so that the
 * middleware gate redirects the user back to /setup/api-key on next navigation.
 *
 * If no key is currently stored, the procedure is a no-op and still returns
 * { success: true }. Deleting a non-existent key is not an error.
 *
 * SEQUENTIAL SIDE EFFECTS
 * -----------------------
 * 1. CLEAR DB (branch by role):
 *    JOB_SEEKER:
 *      UPDATE SeekerSettings SET
 *        byokApiKeyEncrypted = NULL,
 *        byokProvider        = NULL
 *      WHERE seekerId = (SELECT id FROM job_seekers WHERE clerkUserId = ctx.userId)
 *
 *    EMPLOYER:
 *      UPDATE employers SET
 *        byokApiKeyEncrypted = NULL,
 *        byokProvider        = NULL
 *      WHERE clerkOrgId = ctx.orgId
 *
 * 2. UPDATE CLERK METADATA:
 *    clerkClient.users.updateUserMetadata(ctx.userId, {
 *      publicMetadata: { hasByokKey: false }
 *    })
 *    Same best-effort policy as storeKey — log failures, do not roll back DB.
 *
 * ERROR CODES
 * -----------
 * UNAUTHORIZED        — no session
 * FORBIDDEN           — userRole is null
 * PRECONDITION_FAILED — DB row does not exist (profile not created)
 * INTERNAL_SERVER_ERROR — DB write failure
 */

// -----------------------------------------------------------------------------
// byok.getKeyStatus
// -----------------------------------------------------------------------------

/**
 * Output of the getKeyStatus query.
 *
 * `hasKey`     — true if an encrypted key is currently stored; false otherwise.
 * `provider`   — which provider the key is for, if a key exists; null otherwise.
 *                The provider is NOT sensitive and may be shown in the UI.
 * `maskedKey`  — "sk-...XXXX" format if key exists; null otherwise.
 *                Contains the last 4 chars of the original plaintext key.
 *
 * SECURITY: This query NEVER returns the full plaintext key or the ciphertext.
 * The maskedKey is derived from the last 4 characters of the plaintext and
 * stored separately (or recomputed without full decryption — see note in
 * storeKey contract). Under no circumstances is the ciphertext decrypted and
 * returned, even partially.
 */
export const ByokGetKeyStatusOutputSchema = z.object({
  hasKey: z.boolean(),
  provider: ProviderSchema.nullable(),
  maskedKey: z
    .string()
    .regex(/^sk-\.\.\.[A-Za-z0-9]{4}$/)
    .nullable(),
})

export type ByokGetKeyStatusOutput = z.infer<typeof ByokGetKeyStatusOutputSchema>

/**
 * byok.getKeyStatus
 *
 * Procedure tier : protectedProcedure (userId + userRole required)
 * HTTP method    : query (GET)
 * Route key      : trpc.byok.getKeyStatus
 *
 * PURPOSE
 * -------
 * Returns a presence indicator for the stored BYOK key. Used by:
 *   - The /setup/api-key page to show "key already configured" state.
 *   - The account settings page to show the masked key.
 *   - The middleware gate (indirectly, via hasByokKey in Clerk metadata).
 *
 * IMPLEMENTATION NOTE
 * -------------------
 * Read from the appropriate table branch by ctx.userRole:
 *
 *   JOB_SEEKER:
 *     SELECT byokApiKeyEncrypted, byokProvider FROM seeker_settings
 *     WHERE seekerId = (SELECT id FROM job_seekers WHERE clerkUserId = ctx.userId)
 *
 *   EMPLOYER:
 *     SELECT byokApiKeyEncrypted, byokProvider FROM employers
 *     WHERE clerkOrgId = ctx.orgId
 *
 * If byokApiKeyEncrypted IS NULL:
 *   return { hasKey: false, provider: null, maskedKey: null }
 *
 * If byokApiKeyEncrypted IS NOT NULL:
 *   Derive maskedKey from the last 4 chars of the ciphertext's original
 *   plaintext. Preferred approach: store the maskedKey as a separate
 *   plain-text column (byokMaskedKey: String?) alongside byokApiKeyEncrypted
 *   so this query never needs to decrypt. This avoids loading the encryption
 *   key and performing GCM decryption on every key status check.
 *
 *   If maskedKey column is not added to the schema, fall back to decrypting
 *   in-memory and taking the last 4 chars — but this is suboptimal and should
 *   be avoided.
 *
 * SCHEMA RECOMMENDATION (optional but strongly preferred)
 * --------------------------------------------------------
 * Add byokMaskedKey String? to both SeekerSettings and Employer models.
 * Populate it in storeKey and clear it in deleteKey alongside the ciphertext.
 * This makes getKeyStatus a pure read with no crypto operations.
 *
 * ERROR CODES
 * -----------
 * UNAUTHORIZED        — no session
 * FORBIDDEN           — userRole is null
 * PRECONDITION_FAILED — DB row not found for ctx.userId / ctx.orgId
 * INTERNAL_SERVER_ERROR — DB read failure
 */

// =============================================================================
// ROUTER SHAPE DECLARATIONS
// =============================================================================

/**
 * Canonical router structure declaration.
 *
 * These types describe the shape of the two routers as they will appear
 * in the tRPC AppRouter. Implementers use these as the authoritative reference
 * when writing the actual createTRPCRouter({ ... }) calls.
 *
 * Route key format: trpc.<routerName>.<procedureName>
 */

export interface OnboardingRouterShape {
  /**
   * trpc.onboarding.setRole
   * tier   : onboardingProcedure
   * type   : mutation
   * input  : SetRoleInput
   * output : SetRoleOutput
   * errors : UNAUTHORIZED | BAD_REQUEST | INTERNAL_SERVER_ERROR
   */
  setRole: {
    input: SetRoleInput
    output: SetRoleOutput
    procedure: "onboardingProcedure"
    type: "mutation"
  }
}

export interface ByokRouterShape {
  /**
   * trpc.byok.storeKey
   * tier   : protectedProcedure
   * type   : mutation
   * input  : ByokStoreKeyInput
   * output : ByokStoreKeyOutput
   * errors : UNAUTHORIZED | FORBIDDEN | BAD_REQUEST | PRECONDITION_FAILED | INTERNAL_SERVER_ERROR
   */
  storeKey: {
    input: ByokStoreKeyInput
    output: ByokStoreKeyOutput
    procedure: "protectedProcedure"
    type: "mutation"
  }

  /**
   * trpc.byok.deleteKey
   * tier   : protectedProcedure
   * type   : mutation
   * input  : void
   * output : ByokDeleteKeyOutput
   * errors : UNAUTHORIZED | FORBIDDEN | PRECONDITION_FAILED | INTERNAL_SERVER_ERROR
   */
  deleteKey: {
    input: void
    output: ByokDeleteKeyOutput
    procedure: "protectedProcedure"
    type: "mutation"
  }

  /**
   * trpc.byok.getKeyStatus
   * tier   : protectedProcedure
   * type   : query
   * input  : void
   * output : ByokGetKeyStatusOutput
   * errors : UNAUTHORIZED | FORBIDDEN | PRECONDITION_FAILED | INTERNAL_SERVER_ERROR
   */
  getKeyStatus: {
    input: void
    output: ByokGetKeyStatusOutput
    procedure: "protectedProcedure"
    type: "query"
  }
}

// =============================================================================
// ROOT ROUTER REGISTRATION
// =============================================================================

/**
 * Required additions to src/server/api/root.ts:
 *
 *   import { onboardingRouter } from "@/server/api/routers/onboarding"
 *   import { byokRouter }       from "@/server/api/routers/byok"
 *
 *   export const appRouter = createTRPCRouter({
 *     // ...existing routers...
 *     onboarding: onboardingRouter,   // ← add
 *     byok:       byokRouter,         // ← add
 *   })
 *
 * Client usage examples (Next.js App Router, server component):
 *
 *   // Set role during onboarding
 *   const result = await trpc.onboarding.setRole.mutate({
 *     role: "JOB_SEEKER",
 *   })
 *   router.push(result.redirectTo) // "/setup/api-key"
 *
 *   // Store an OpenAI key
 *   const result = await trpc.byok.storeKey.mutate({
 *     provider: "openai",
 *     apiKey: "sk-proj-abc123...",
 *   })
 *   // result.maskedKey === "sk-...c123"
 *
 *   // Check key status (for settings page)
 *   const status = await trpc.byok.getKeyStatus.query()
 *   // { hasKey: true, provider: "openai", maskedKey: "sk-...c123" }
 *
 *   // Delete key
 *   await trpc.byok.deleteKey.mutate()
 */

// =============================================================================
// ERROR CODE REFERENCE (this feature)
// =============================================================================

/**
 * Error code usage for onboardingRouter and byokRouter.
 * Follows the conventions established in:
 *   .specify/specs/1-foundation-infrastructure/contracts/trpc-api.ts §ERROR CODE CONVENTIONS
 *
 * Code                  HTTP  When to throw
 * ─────────────────────────────────────────────────────────────────────────
 * UNAUTHORIZED          401   ctx.userId is null (no Clerk session at all)
 *
 * FORBIDDEN             403   ctx.userRole is null when a role is required
 *                             (user has a session but skipped /onboarding/role)
 *
 * BAD_REQUEST           400   Zod validation failure on any input field
 *                             Live API key validation rejected by provider
 *                             Provider returned 429 rate-limit response
 *
 * PRECONDITION_FAILED   412   Required DB row not found before a write:
 *                               - SeekerSettings not found for ctx.userId
 *                               - Employer not found for ctx.orgId
 *                             Indicates incomplete prior onboarding step.
 *                             Client should redirect to the relevant setup step.
 *
 * INTERNAL_SERVER_ERROR 500   Clerk API call failure (org creation, metadata write)
 *                             DB transaction failure
 *                             Encryption module error
 *                             Provider validation timeout (>10 s)
 *                             → ALWAYS log to Sentry with full error context
 *                             → NEVER expose raw error details to the client
 *
 * SECURITY RULES (same as spec §Non-Functional Requirements)
 * ─────────────────────────────────────────────────────────────────────────
 * - Error messages MUST NOT contain: key material (even partial), Clerk user
 *   internal IDs, raw SQL, stack traces, or provider-returned error bodies.
 * - Use generic messages for INTERNAL_SERVER_ERROR:
 *     "An unexpected error occurred. Please try again."
 * - Use provider-friendly messages for key validation failures:
 *     "This API key was not recognized by OpenAI. Please check the key and try again."
 *     "This API key was not recognized by Anthropic. Please check the key and try again."
 */

// =============================================================================
// PROVIDER VALIDATION DETAILS
// =============================================================================

/**
 * Live validation endpoint specifications.
 *
 * Both endpoints are read-only (GET), require no request body, and consume
 * the minimum permission scope to confirm key validity. They are not used for
 * any functional purpose beyond confirming the key is active.
 *
 * OpenAI
 * ──────
 * Endpoint  : GET https://api.openai.com/v1/models
 * Headers   : Authorization: Bearer <apiKey>
 *             Content-Type: application/json
 * Success   : HTTP 200 with { object: "list", data: [...] }
 * Failure   : HTTP 401 — key invalid / revoked
 *             HTTP 429 — rate limited
 *             HTTP 403 — key valid but org restrictions (treat as valid key, note restriction)
 * Timeout   : 10 000 ms
 *
 * Anthropic
 * ─────────
 * Endpoint  : GET https://api.anthropic.com/v1/models
 * Headers   : x-api-key: <apiKey>
 *             anthropic-version: 2023-06-01
 *             Content-Type: application/json
 * Success   : HTTP 200 with { data: [...], has_more: boolean }
 * Failure   : HTTP 401 — key invalid / revoked
 *             HTTP 403 — key valid but insufficient permissions
 *             HTTP 429 — rate limited
 * Timeout   : 10 000 ms
 *
 * Implementation note: use Node's native fetch (available in Next.js 15 /
 * Node 18+) with AbortController and a 10-second timeout. Do not import a
 * third-party HTTP client for this validation.
 *
 *   const controller = new AbortController()
 *   const timeoutId  = setTimeout(() => controller.abort(), 10_000)
 *   try {
 *     const res = await fetch(url, { headers, signal: controller.signal })
 *     ...
 *   } finally {
 *     clearTimeout(timeoutId)
 *   }
 */

// =============================================================================
// NEXT.JS MIDDLEWARE GATE (informational — not a tRPC contract)
// =============================================================================

/**
 * The tRPC contracts above must be paired with a Next.js middleware update
 * (src/middleware.ts or middleware.ts at project root) that enforces the
 * sequential onboarding gates on every navigation:
 *
 *   Gate 1: authenticated, userRole === null
 *           → redirect to /onboarding/role
 *
 *   Gate 2: authenticated, userRole !== null, hasByokKey === false
 *           → redirect to /setup/api-key
 *
 *   Gate 3: authenticated, userRole !== null, hasByokKey === true
 *           → allow through to dashboard routes
 *
 * Both `userRole` and `hasByokKey` are read from Clerk sessionClaims
 * (publicMetadata) — they are available in the middleware without a DB call.
 *
 * The /onboarding/role and /setup/api-key pages themselves must be excluded
 * from their own gate redirects to prevent infinite loops:
 *
 *   /onboarding/role  — accessible to Gate 1 users; Gate 2/3 users redirect away
 *   /setup/api-key    — accessible to Gate 2 users; Gate 1 users redirect to Gate 1,
 *                       Gate 3 users redirect to dashboard
 *
 * This contract does not define the middleware implementation, but the tRPC
 * procedures above are designed to keep Clerk metadata (`role`, `hasByokKey`)
 * in sync so that the middleware gate is always accurate.
 */
