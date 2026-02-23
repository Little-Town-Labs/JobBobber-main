/**
 * JobBobber tRPC API Contracts — Foundation Infrastructure
 *
 * This file defines the TYPE-LEVEL contracts for all tRPC routers.
 * It is a design artifact — NOT a runnable implementation file.
 *
 * Implementation location: src/server/api/routers/
 * Root router:             src/server/api/root.ts
 * Context + middleware:    src/server/api/trpc.ts
 *
 * Feature Branch: 1-foundation-infrastructure
 * Date: 2026-02-22
 */

// =============================================================================
// CONTEXT HIERARCHY
// =============================================================================

/**
 * Base context — created for every request, regardless of auth state.
 * publicProcedure receives this shape.
 */
export interface TRPCContext {
  /** Prisma client singleton */
  db: unknown; // PrismaClient — typed in implementation
  /** Clerk userId: non-null when a valid session exists */
  userId: string | null;
  /** Clerk orgId: non-null when user is acting in an organization context (Employer) */
  orgId: string | null;
  /** Clerk organization role: "org:admin" | "org:member" | null */
  orgRole: "org:admin" | "org:member" | null;
  /** Platform role from Clerk publicMetadata — set at onboarding */
  userRole: "JOB_SEEKER" | "EMPLOYER" | null;
}

/** Context after protectedProcedure middleware — session guaranteed */
export interface AuthenticatedContext extends TRPCContext {
  userId: string;
  userRole: "JOB_SEEKER" | "EMPLOYER";
}

/** Context after seekerProcedure middleware */
export interface SeekerContext extends AuthenticatedContext {
  userRole: "JOB_SEEKER";
}

/** Context after employerProcedure middleware — org context guaranteed */
export interface EmployerContext extends AuthenticatedContext {
  userRole: "EMPLOYER";
  orgId: string;
  orgRole: "org:admin" | "org:member";
}

/** Context after adminProcedure middleware — org admin role guaranteed */
export interface AdminContext extends EmployerContext {
  orgRole: "org:admin";
}

// =============================================================================
// MIDDLEWARE CHAIN
// =============================================================================

/**
 * PROCEDURE HIERARCHY (extends downward):
 *
 * publicProcedure          → TRPCContext       (no auth)
 *   └─ protectedProcedure  → AuthenticatedContext (requires Clerk session)
 *         ├─ seekerProcedure    → SeekerContext    (requires JOB_SEEKER role)
 *         └─ employerProcedure  → EmployerContext  (requires EMPLOYER + orgId)
 *               └─ adminProcedure → AdminContext   (requires org:admin role)
 *
 * Feature-flag gating: applied per-handler via assertFlagEnabled(flagKey, ctx).
 * Not a middleware level — flags are procedure-specific, not role-specific.
 */

// =============================================================================
// SHARED TYPES
// =============================================================================

export interface PaginationInput {
  cursor?: string; // cuid of last seen record
  limit?: number;  // default 20, max 100
}

export interface PaginationMeta {
  nextCursor: string | null;
  hasMore: boolean;
  total?: number; // expensive COUNT — opt-in only
}

export type SortDirection = "asc" | "desc";
export type ExperienceLevel = "ENTRY" | "MID" | "SENIOR" | "EXECUTIVE";
export type EmploymentType = "FULL_TIME" | "PART_TIME" | "CONTRACT";
export type WorkLocationType = "REMOTE" | "HYBRID" | "ONSITE";
export type JobPostingStatus = "DRAFT" | "ACTIVE" | "PAUSED" | "CLOSED" | "FILLED";
export type MatchConfidence = "STRONG" | "GOOD" | "POTENTIAL";
export type MatchStatus =
  | "PENDING"
  | "SEEKER_ACCEPTED"
  | "SEEKER_DECLINED"
  | "EMPLOYER_ACCEPTED"
  | "EMPLOYER_DECLINED"
  | "MUTUALLY_ACCEPTED"
  | "EXPIRED";

export interface PublicSalaryRange {
  min: number;       // cents, integer
  max: number;       // cents, integer; must be >= min
  currency: string;  // ISO 4217, default "USD"
  period: "ANNUAL" | "HOURLY"; // default "ANNUAL"
}

// =============================================================================
// ROUTER CONTRACTS
// =============================================================================

// -----------------------------------------------------------------------------
// health router
// -----------------------------------------------------------------------------

export interface HealthPingOutput {
  status: "ok";
  timestamp: string; // ISO 8601
}

export interface HealthDeepCheckOutput {
  healthy: boolean;
  checks: Array<{
    name: "database" | "clerk";
    status: "ok" | "degraded" | "unreachable";
    latencyMs: number;
  }>;
  timestamp: string;
}

/**
 * health.ping      → publicProcedure (query)  → HealthPingOutput
 * health.deepCheck → publicProcedure (query)  → HealthDeepCheckOutput
 */

// -----------------------------------------------------------------------------
// jobSeekers router
// -----------------------------------------------------------------------------

export interface PublicJobSeekerProfile {
  id: string;
  displayName: string;
  headline: string;
  bio: string;
  skills: string[];
  experienceLevel: ExperienceLevel;
  yearsOfExperience: number;
  preferredWorkTypes: WorkLocationType[];
  preferredEmploymentTypes: EmploymentType[];
  location: {
    city?: string;
    state?: string;
    country: string; // ISO 3166-1 alpha-2
    openToRelocation: boolean;
  };
  portfolioUrls: string[];
  resumeUrl: string | null;
  completenessScore: number; // 0–100
  isActivelyLooking: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface UpdateJobSeekerProfileInput {
  displayName?: string;
  headline?: string;
  bio?: string;
  skills?: string[];
  experienceLevel?: ExperienceLevel;
  yearsOfExperience?: number;
  preferredWorkTypes?: WorkLocationType[];
  preferredEmploymentTypes?: EmploymentType[];
  location?: {
    city?: string;
    state?: string;
    country: string;
    openToRelocation: boolean;
  };
  portfolioUrls?: string[];
  isActivelyLooking?: boolean;
}

/**
 * jobSeekers.getProfile     → publicProcedure   input: { id: string }
 *                                                output: PublicJobSeekerProfile
 *                                                throws NOT_FOUND if not exists
 *
 * jobSeekers.getMyProfile   → seekerProcedure   input: void
 *                                                output: PublicJobSeekerProfile
 *
 * jobSeekers.updateProfile  → seekerProcedure   input: UpdateJobSeekerProfileInput
 *                                                output: PublicJobSeekerProfile
 *                                                identity from ctx.userId (not input)
 *
 * jobSeekers.deleteProfile  → seekerProcedure   input: void
 *                                                output: { deleted: true }
 */

// -----------------------------------------------------------------------------
// employers router
// -----------------------------------------------------------------------------

export interface PublicEmployerProfile {
  id: string;
  clerkOrgId: string;
  name: string;
  description: string | null;
  industry: string | null;
  size: "1_TO_10" | "11_TO_50" | "51_TO_200" | "201_TO_500" | "501_TO_2000" | "2000_PLUS" | null;
  websiteUrl: string | null;
  logoUrl: string | null;
  linkedinUrl: string | null;
  headquarters: { city?: string; country: string } | null;
  benefits: string[];
  cultureHighlights: string[];
  activeJobPostingCount: number;
  createdAt: string;
  updatedAt: string;
}

export interface EmployerMemberEntry {
  id: string;
  clerkUserId: string;
  email: string;
  displayName: string;
  orgRole: "org:admin" | "org:member";
  joinedAt: string;
}

/**
 * employers.getProfile     → publicProcedure     input: { id: string }
 *                                                 output: PublicEmployerProfile
 *
 * employers.getMyProfile   → employerProcedure   input: void
 *                                                 output: PublicEmployerProfile
 *
 * employers.updateProfile  → employerProcedure   input: Partial<...>
 *                                                 output: PublicEmployerProfile
 *
 * employers.listMembers    → employerProcedure   input: PaginationInput
 *                                                 output: { items: EmployerMemberEntry[]; pagination: PaginationMeta }
 *
 * employers.inviteMember   → adminProcedure      input: { email: string; orgRole: "org:admin" | "org:member" }
 *                                                 output: { invitationId: string; email: string }
 *
 * employers.removeMember   → adminProcedure      input: { memberClerkUserId: string }
 *                                                 output: { removed: true }
 *                                                 throws FORBIDDEN if targeting self
 */

// -----------------------------------------------------------------------------
// jobPostings router
// -----------------------------------------------------------------------------

export interface PublicJobPosting {
  id: string;
  employerId: string;
  employerName: string;
  employerLogoUrl: string | null;
  title: string;
  description: string;
  requiredSkills: string[];
  preferredSkills: string[];
  experienceLevel: ExperienceLevel;
  employmentType: EmploymentType;
  workLocationType: WorkLocationType;
  location: { city?: string; state?: string; country: string };
  publicSalaryRange: PublicSalaryRange | null;
  whyApply: string | null;
  status: JobPostingStatus;
  createdAt: string;
  updatedAt: string;
  publishedAt: string | null;
  closedAt: string | null;
}

export interface JobPostingsListFilter {
  query?: string;                       // free-text search
  skills?: string[];
  experienceLevels?: ExperienceLevel[];
  employmentTypes?: EmploymentType[];
  workLocationTypes?: WorkLocationType[];
  countries?: string[];
  minSalary?: number;                   // cents
  status?: JobPostingStatus;            // default "ACTIVE"
}

export interface CreateJobPostingInput {
  title: string;
  description: string;
  requiredSkills: string[];
  preferredSkills?: string[];
  experienceLevel: ExperienceLevel;
  employmentType: EmploymentType;
  workLocationType: WorkLocationType;
  location: { city?: string; state?: string; country: string };
  publicSalaryRange?: PublicSalaryRange;
  whyApply?: string;
  initialStatus?: "DRAFT" | "ACTIVE"; // default "DRAFT"
}

/**
 * jobPostings.list       → publicProcedure      input: PaginationInput & JobPostingsListFilter & sort
 *                                                output: { items: PublicJobPosting[]; pagination: PaginationMeta }
 *                                                only returns ACTIVE postings to anonymous callers
 *
 * jobPostings.getById    → publicProcedure      input: { id: string }
 *                                                output: PublicJobPosting
 *                                                throws NOT_FOUND if not ACTIVE
 *
 * jobPostings.listMine   → employerProcedure    input: PaginationInput & { status?: JobPostingStatus }
 *                                                output: { items: PublicJobPosting[]; pagination: PaginationMeta }
 *                                                returns all statuses for the caller's org
 *
 * jobPostings.create     → employerProcedure    input: CreateJobPostingInput
 *                                                output: PublicJobPosting
 *                                                orgId from ctx (not input)
 *                                                side-effect: if ACTIVE → inngest.send("job/posting.activated")
 *
 * jobPostings.update     → employerProcedure    input: Partial<CreateJobPostingInput> & { id: string }
 *                                                output: PublicJobPosting
 *                                                throws FORBIDDEN if posting.employerId !== ctx.orgId
 *
 * jobPostings.setStatus  → employerProcedure    input: { id: string; status: JobPostingStatus }
 *                                                output: PublicJobPosting
 *                                                throws CONFLICT for invalid transitions
 *
 * jobPostings.delete     → adminProcedure       input: { id: string }
 *                                                output: { deleted: true }
 *                                                only allowed on DRAFT or CLOSED postings
 */

// -----------------------------------------------------------------------------
// matches router
// -----------------------------------------------------------------------------

export interface MatchSummary {
  id: string;
  jobPostingId: string;
  jobTitle: string;
  employerName: string;
  seekerId: string;
  seekerDisplayName: string;
  confidence: MatchConfidence;
  matchScore: number;       // 0–100
  matchReasoning: string;
  status: MatchStatus;
  seekerAcceptedAt: string | null;
  employerAcceptedAt: string | null;
  createdAt: string;
  updatedAt: string;
  /**
   * Populated ONLY when status === "MUTUALLY_ACCEPTED".
   * Null in all other states — contact info withheld until both accept.
   */
  seekerContactInfo: {
    email: string;
    availability: string | null;
  } | null;
}

/**
 * matches.listForSeeker    → seekerProcedure      input: PaginationInput & { status?: MatchStatus }
 *                                                  output: { items: MatchSummary[]; pagination: PaginationMeta }
 *
 * matches.listForEmployer  → employerProcedure    input: PaginationInput & { status?: MatchStatus; jobPostingId?: string }
 *                                                  output: { items: MatchSummary[]; pagination: PaginationMeta }
 *
 * matches.accept           → protectedProcedure   input: { matchId: string }
 *                                                  output: MatchSummary
 *                                                  handler detects caller is seeker or employer
 *                                                  if both accepted → status becomes MUTUALLY_ACCEPTED
 *                                                  throws FORBIDDEN if caller is not a party
 *                                                  throws CONFLICT if already in terminal state
 *
 * matches.decline          → protectedProcedure   input: { matchId: string; reason?: string }
 *                                                  output: MatchSummary
 *                                                  throws CONFLICT if match already in terminal state
 */

// -----------------------------------------------------------------------------
// settings router
// -----------------------------------------------------------------------------

export interface SeekerSettingsOutput {
  id: string;
  seekerId: string;
  minSalarycents: number | null;
  salaryFlexibilityPercent: number | null; // 0–100
  dealBreakers: string[];
  priorities: Array<{ label: string; rank: number }>;
  exclusions: string[];
  preferredLlmProvider: "openai" | "anthropic" | null;
  hasValidApiKey: boolean;              // true/false — never returns the key itself
  updatedAt: string;
}

export interface JobSettingsOutput {
  id: string;
  jobPostingId: string;
  orgId: string;
  truMaxSalarycents: number | null;     // never in public API
  willingToTrain: boolean;
  trainableSkills: string[];
  urgency: "LOW" | "MEDIUM" | "HIGH" | "CRITICAL";
  priorityAttributes: string[];
  minimumQualificationOverride: string | null;
  updatedAt: string;
}

/**
 * settings.getSeekerSettings      → seekerProcedure    input: void
 *                                                        output: SeekerSettingsOutput
 *                                                        OWNERSHIP: ctx.userId is the ONLY key — no input id
 *                                                        structural guarantee: caller cannot read another user's settings
 *
 * settings.updateSeekerSettings   → seekerProcedure    input: Partial<SeekerSettingsOutput minus readonly fields>
 *                                                        output: SeekerSettingsOutput
 *                                                        feature flag: PRIVATE_PARAMS (OFF until Phase 2)
 *
 * settings.getJobSettings         → employerProcedure  input: { jobPostingId: string }
 *                                                        output: JobSettingsOutput
 *                                                        throws FORBIDDEN if posting.employerId !== ctx.orgId
 *
 * settings.updateJobSettings      → employerProcedure  input: { jobPostingId: string } & Partial<...>
 *                                                        output: JobSettingsOutput
 *                                                        feature flag: PRIVATE_PARAMS (OFF until Phase 2)
 */

// -----------------------------------------------------------------------------
// insights router  (Feature 14, Phase 3 — behind FEEDBACK_INSIGHTS flag)
// -----------------------------------------------------------------------------

/**
 * insights.getSeekerInsights   → seekerProcedure    input: void
 *                                                     feature flag: FEEDBACK_INSIGHTS (OFF until Phase 3)
 *
 * insights.getEmployerInsights → employerProcedure  input: { jobPostingId?: string }
 *                                                     feature flag: FEEDBACK_INSIGHTS (OFF until Phase 3)
 */

// =============================================================================
// FEATURE FLAGS
// =============================================================================

/**
 * All flags default to false (OFF) — constitutional requirement FR-019.
 * Flags are evaluated per-request at the Edge via Vercel Flags SDK.
 *
 * Flag key           │ Phase │ Feature
 * ───────────────────┼───────┼─────────────────────────────────
 * private-params     │  2    │ Feature 8  — Private negotiation parameters
 * agent-to-agent     │  2    │ Feature 9  — Agent-to-agent conversations
 * conversation-logs  │  2    │ Feature 12 — Conversation log visibility
 * feedback-insights  │  3    │ Feature 14 — Aggregate feedback insights
 * custom-agent-prompts│ 3   │ Feature 15 — Custom agent prompting
 *
 * Usage in procedure handlers:
 *   await assertFlagEnabled("PRIVATE_PARAMS", ctx)
 *   // throws TRPCError({ code: "FORBIDDEN" }) if flag is OFF
 */

// =============================================================================
// ERROR CODE CONVENTIONS
// =============================================================================

/**
 * BAD_REQUEST (400)         — input fails Zod validation or business-rule validation
 * UNAUTHORIZED (401)        — no Clerk session / expired session
 * FORBIDDEN (403)           — wrong role, wrong ownership, or feature flag OFF
 * NOT_FOUND (404)           — record doesn't exist (also used for cross-org access to prevent enumeration)
 * CONFLICT (409)            — invalid state machine transition, uniqueness violation
 * PRECONDITION_FAILED (412) — prerequisite missing (no orgId, no BYOK key)
 * INTERNAL_SERVER_ERROR (500)— unexpected error (log to Sentry, return generic message)
 *
 * Security rules:
 * - Cross-org resource access → NOT_FOUND (not FORBIDDEN) to prevent enumeration
 * - Error messages MUST NOT include: stack traces, SQL text, raw values, internal IDs
 * - Sensitive values (keys, salaries, private params) MUST NOT appear in error messages
 * - Log original error to Sentry BEFORE rethrowing a sanitized TRPCError
 */

// =============================================================================
// PAGINATION PATTERN
// =============================================================================

/**
 * All list procedures use CURSOR-BASED pagination on the `id` field (CUID).
 *
 * Rationale over offset pagination:
 *   - Stable results when rows are inserted between pages (no drift)
 *   - No expensive OFFSET N table scan — O(log N) via index seek
 *
 * Pattern:
 *   Page 1: { limit: 20 }  → returns items + nextCursor
 *   Page 2: { limit: 20, cursor: nextCursor }  → next page
 *   End:    response.pagination.hasMore === false, nextCursor === null
 *
 * Sort stability: always include `id` as secondary sort field to guarantee
 * deterministic ordering when two records share the primary sort field value.
 */
