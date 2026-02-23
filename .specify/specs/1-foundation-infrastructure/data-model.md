# Data Model: 1-foundation-infrastructure

**Feature Branch**: `1-foundation-infrastructure`
**Date**: 2026-02-22
**ORM**: Prisma 5
**Database**: NeonDB (PostgreSQL 16 + pgvector extension)

---

## Prisma Schema

```prisma
// =============================================================================
// prisma/schema.prisma
// JobBobber — AI-Powered Talent Matching Platform
//
// Stack:   Prisma 5 · NeonDB (PostgreSQL) · pgvector extension
// Auth:    Clerk (clerkUserId / clerkOrgId are external String identifiers, not FKs)
// Privacy: SeekerSettings and JobSettings are SEPARATE models — never joined
//          in standard queries by convention (tRPC middleware enforces this).
// Vectors: profileEmbedding / jobEmbedding use pgvector Unsupported type.
//          Queried via db.$queryRaw — not through Prisma's typed API.
//          Dimension: 1536 (openai text-embedding-3-large).
// =============================================================================

generator client {
  provider        = "prisma-client-js"
  previewFeatures = ["postgresqlExtensions"]
}

datasource db {
  provider   = "postgresql"
  url        = env("DATABASE_URL")
  extensions = [pgvector(map: "vector", schema: "public")]
}

// =============================================================================
// ENUMS
// =============================================================================

enum EmployerMemberRole {
  ADMIN
  JOB_POSTER
  VIEWER
}

enum ExperienceLevel {
  ENTRY
  MID
  SENIOR
  EXECUTIVE
}

enum EmploymentType {
  FULL_TIME
  PART_TIME
  CONTRACT
}

enum LocationType {
  REMOTE
  HYBRID
  ONSITE
}

enum JobPostingStatus {
  DRAFT
  ACTIVE
  PAUSED
  CLOSED
  FILLED
}

enum JobUrgency {
  LOW
  MEDIUM
  HIGH
  CRITICAL
}

enum ConversationStatus {
  IN_PROGRESS
  COMPLETED_MATCH
  COMPLETED_NO_MATCH
  TERMINATED
}

enum MatchConfidence {
  STRONG
  GOOD
  POTENTIAL
}

enum MatchPartyStatus {
  PENDING
  ACCEPTED
  DECLINED
  EXPIRED
}

enum FeedbackUserType {
  JOB_SEEKER
  EMPLOYER
}

enum TrendDirection {
  IMPROVING
  STABLE
  DECLINING
}

// =============================================================================
// PUBLIC ENTITIES
// =============================================================================

/// Public profile for an individual job seeker.
/// clerkUserId links to Clerk's user identity — stored as a plain String,
/// not a foreign key, because Clerk manages auth state externally.
model JobSeeker {
  id                   String   @id @default(cuid())
  clerkUserId          String   @unique
  name                 String
  headline             String?
  bio                  String?
  resumeUrl            String?
  parsedResume         Json?
  experience           Json[]   @default([])
  education            Json[]   @default([])
  skills               String[]
  urls                 String[]
  location             String?
  relocationPreference String?
  profileCompleteness  Float    @default(0)
  isActive             Boolean  @default(true)
  createdAt            DateTime @default(now())
  updatedAt            DateTime @updatedAt

  // pgvector field — used exclusively via db.$queryRaw for similarity search.
  // Declared Unsupported so Prisma does not attempt typed access.
  // Dimension 1536 matches openai/text-embedding-3-large output.
  profileEmbedding Unsupported("vector(1536)")?

  // Relations
  settings      SeekerSettings?
  conversations AgentConversation[]
  matches       Match[]
  feedback      FeedbackInsights[]

  @@index([clerkUserId])
  @@index([isActive])
  @@index([location])
  @@map("job_seekers")
}

/// PRIVATE — negotiation parameters for a JobSeeker.
/// One-to-one with JobSeeker. Never returned in any public tRPC procedure.
/// Accessed only by the seeker's AI agent via a dedicated private server action.
model SeekerSettings {
  id                   String   @id @default(cuid())
  seekerId             String   @unique
  minSalary            Int?
  salaryRules          Json     @default("{}")
  dealBreakers         String[]
  priorities           String[]
  exclusions           String[]
  customPrompt         String?
  notifPrefs           Json     @default("{}")
  byokApiKeyEncrypted  String?
  byokProvider         String?
  createdAt            DateTime @default(now())
  updatedAt            DateTime @updatedAt

  seeker JobSeeker @relation(fields: [seekerId], references: [id], onDelete: Cascade)

  @@map("seeker_settings")
}

/// Public profile for an employer organisation.
/// clerkOrgId links to Clerk's Organization — stored as a plain String.
model Employer {
  id           String   @id @default(cuid())
  clerkOrgId   String   @unique
  name         String
  industry     String?
  size         String?
  description  String?
  culture      String?
  headquarters String?
  locations    String[]
  websiteUrl   String?
  urls         Json     @default("{}")
  benefits     String[]
  logoUrl      String?
  createdAt    DateTime @default(now())
  updatedAt    DateTime @updatedAt

  members     EmployerMember[]
  jobPostings JobPosting[]
  matches     Match[]
  feedback    FeedbackInsights[]

  @@index([clerkOrgId])
  @@index([industry])
  @@map("employers")
}

/// Join table linking a Clerk user to an Employer with a role.
model EmployerMember {
  id          String             @id @default(cuid())
  employerId  String
  clerkUserId String
  role        EmployerMemberRole @default(VIEWER)
  invitedBy   String?
  joinedAt    DateTime           @default(now())

  employer Employer @relation(fields: [employerId], references: [id], onDelete: Cascade)

  @@unique([employerId, clerkUserId])
  @@index([clerkUserId])
  @@index([employerId])
  @@map("employer_members")
}

/// Public job posting created by an Employer.
model JobPosting {
  id               String           @id @default(cuid())
  employerId       String
  title            String
  department       String?
  description      String
  responsibilities String?
  requiredSkills   String[]
  preferredSkills  String[]
  experienceLevel  ExperienceLevel
  employmentType   EmploymentType
  locationType     LocationType
  locationReq      String?
  salaryMin        Int?
  salaryMax        Int?
  benefits         String[]
  whyApply         String?
  status           JobPostingStatus @default(DRAFT)
  createdAt        DateTime         @default(now())
  updatedAt        DateTime         @updatedAt

  // pgvector field for semantic job-to-seeker matching (Feature 11).
  jobEmbedding Unsupported("vector(1536)")?

  employer      Employer            @relation(fields: [employerId], references: [id], onDelete: Cascade)
  settings      JobSettings?
  conversations AgentConversation[]
  matches       Match[]

  @@index([employerId])
  @@index([status])
  @@index([experienceLevel])
  @@index([employmentType])
  @@index([locationType])
  @@index([status, employerId])
  @@map("job_postings")
}

/// PRIVATE — hidden hiring parameters for a JobPosting.
/// One-to-one with JobPosting. Never returned in any public tRPC procedure.
model JobSettings {
  id                  String     @id @default(cuid())
  jobPostingId        String     @unique
  trueMaxSalary       Int?
  minQualOverride     Json?
  willingToTrain      String[]
  urgency             JobUrgency @default(MEDIUM)
  priorityAttrs       String[]
  customPrompt        String?
  byokApiKeyEncrypted String?
  byokProvider        String?
  createdAt           DateTime   @default(now())
  updatedAt           DateTime   @updatedAt

  jobPosting JobPosting @relation(fields: [jobPostingId], references: [id], onDelete: Cascade)

  @@map("job_settings")
}

// =============================================================================
// AGENT / MATCHING ENTITIES
// =============================================================================

/// An agent-to-agent conversation thread.
/// inngestRunId links to the Inngest workflow run for O(1) bidirectional lookup.
model AgentConversation {
  id           String             @id @default(cuid())
  jobPostingId String
  seekerId     String
  status       ConversationStatus @default(IN_PROGRESS)
  messages     Json[]             @default([])
  startedAt    DateTime           @default(now())
  completedAt  DateTime?
  outcome      String?
  inngestRunId String?

  jobPosting JobPosting @relation(fields: [jobPostingId], references: [id], onDelete: Restrict)
  seeker     JobSeeker  @relation(fields: [seekerId], references: [id], onDelete: Restrict)
  match      Match?

  @@index([seekerId])
  @@index([jobPostingId])
  @@index([status])
  @@index([seekerId, jobPostingId])
  @@index([inngestRunId])
  @@map("agent_conversations")
}

/// Platform-generated recommendation to interview.
/// seekerContactInfo and seekerAvailability revealed only after mutual acceptance.
model Match {
  id                 String           @id @default(cuid())
  conversationId     String           @unique
  jobPostingId       String
  seekerId           String
  employerId         String
  confidenceScore    MatchConfidence
  matchSummary       String
  seekerStatus       MatchPartyStatus @default(PENDING)
  employerStatus     MatchPartyStatus @default(PENDING)
  seekerContactInfo  Json?
  seekerAvailability Json?
  createdAt          DateTime         @default(now())
  updatedAt          DateTime         @updatedAt

  conversation AgentConversation @relation(fields: [conversationId], references: [id], onDelete: Restrict)
  jobPosting   JobPosting        @relation(fields: [jobPostingId], references: [id], onDelete: Restrict)
  seeker       JobSeeker         @relation(fields: [seekerId], references: [id], onDelete: Restrict)
  employer     Employer          @relation(fields: [employerId], references: [id], onDelete: Restrict)

  @@index([seekerId])
  @@index([employerId])
  @@index([jobPostingId])
  @@index([seekerStatus])
  @@index([employerStatus])
  @@index([seekerId, seekerStatus])
  @@index([employerId, employerStatus])
  @@index([jobPostingId, employerId])
  @@map("matches")
}

/// Aggregate AI-generated feedback for a user (seeker or employer).
/// Never contains raw conversation data — computed aggregate insights only.
model FeedbackInsights {
  id                      String           @id @default(cuid())
  userId                  String
  userType                FeedbackUserType
  strengths               String[]
  weaknesses              String[]
  recommendations         String[]
  totalConversations      Int              @default(0)
  inProgressCount         Int              @default(0)
  matchRate               Float            @default(0)
  interviewConversionRate Float            @default(0)
  trendDirection          TrendDirection   @default(STABLE)
  generatedAt             DateTime         @default(now())
  updatedAt               DateTime         @updatedAt

  // Polymorphic back-references for cascade safety
  jobSeeker JobSeeker? @relation(fields: [userId], references: [id], onDelete: Cascade)
  employer  Employer?  @relation(fields: [userId], references: [id], onDelete: Cascade)

  @@unique([userId, userType])
  @@index([userId])
  @@index([userType])
  @@index([trendDirection])
  @@map("feedback_insights")
}
```

---

## Entity Relationships

```
JobSeeker (1) ──────── (1) SeekerSettings       [private, cascade delete]
JobSeeker (1) ──────── (N) AgentConversation
JobSeeker (1) ──────── (N) Match
JobSeeker (1) ──────── (1) FeedbackInsights

Employer  (1) ──────── (N) EmployerMember        [cascade delete]
Employer  (1) ──────── (N) JobPosting            [cascade delete]
Employer  (1) ──────── (N) Match
Employer  (1) ──────── (1) FeedbackInsights

JobPosting (1) ─────── (1) JobSettings           [private, cascade delete]
JobPosting (1) ─────── (N) AgentConversation
JobPosting (1) ─────── (N) Match

AgentConversation (1) ─ (1) Match
```

---

## `onDelete` Strategy Reference

| Relation | Strategy | Reason |
|---|---|---|
| SeekerSettings → JobSeeker | `Cascade` | Private settings are meaningless without the profile |
| JobSettings → JobPosting | `Cascade` | Same reasoning |
| EmployerMember → Employer | `Cascade` | Member records are worthless without the employer |
| JobPosting → Employer | `Cascade` | Orphaned postings are unusable |
| AgentConversation → JobSeeker/JobPosting | `Restrict` | Conversations are audit records |
| Match → all parents | `Restrict` | Match is a business/legal artifact; require explicit deletion |
| FeedbackInsights → JobSeeker/Employer | `Cascade` | Insights are derived data |

---

## Index Strategy

### Rationale: Four core query shapes

1. **Seeker dashboard**: "All conversations and matches for seeker X, filtered by status"
2. **Employer dashboard**: "All active postings for org Y, with pending match counts"
3. **Agent trigger**: "Find ACTIVE postings compatible with seeker X" (vector → row filter)
4. **Ops/admin**: "All IN_PROGRESS conversations older than N hours"

Composite indexes are added where the cardinality of the leading column would cause the
planner to scan too many rows: `(status, employerId)` on `job_postings`, `(seekerId, seekerStatus)`
and `(employerId, employerStatus)` on `matches`.

### Indexes NOT in schema (intentionally)

- `SeekerSettings.seekerId` — the `@unique` constraint creates an implicit B-tree index.
- `JobSettings.jobPostingId` — same.
- `Match.conversationId` — `@unique` provides the index.
- `JobSeeker.profileEmbedding` / `JobPosting.jobEmbedding` — vector indexes (HNSW/IVFFlat)
  are created as raw SQL migrations in **Feature 11**, after initial data load. The optimal
  `lists` (IVFFlat) or `m` / `ef_construction` (HNSW) parameters depend on row count at
  index creation time.

---

## Seed Data Design

`prisma/seed.ts` creates the following records for local and preview environments:

| Entity | Count | Notes |
|--------|-------|-------|
| JobSeeker | 5 | Varied experience levels, skills, locations |
| SeekerSettings | 5 | One per seeker; salary and deal-breaker variety |
| Employer | 3 | Small startup, mid-size tech co, enterprise |
| EmployerMember | 6 | 2 per employer: 1 ADMIN + 1 JOB_POSTER |
| JobPosting | 6 | 2 per employer (1 DRAFT, 1 ACTIVE); varied skills |
| JobSettings | 6 | One per posting; urgency and salary variety |
| AgentConversation | 4 | 3 COMPLETED_MATCH, 1 IN_PROGRESS |
| Match | 3 | 1 MUTUALLY_ACCEPTED, 1 PENDING, 1 EMPLOYER_ACCEPTED |
| FeedbackInsights | 4 | 3 seeker + 1 employer; varied trend directions |

**Clerk IDs in seed**: seed uses placeholder Clerk IDs (`user_seed_01`, `org_seed_01`, etc.)
that correspond to hardcoded test accounts created in the Clerk development instance.
Production seed is never run (guarded by `process.env.NODE_ENV !== 'production'` check).

---

## Environment Variables

### Server-only (private — never `NEXT_PUBLIC_` prefix)

| Variable | Purpose | Required |
|----------|---------|----------|
| `DATABASE_URL` | NeonDB pooled connection (Prisma app queries) | Always |
| `DATABASE_URL_UNPOOLED` | NeonDB direct connection (Prisma migrations only) | CI/deploy |
| `CLERK_SECRET_KEY` | Clerk server SDK | Always |
| `CLERK_WEBHOOK_SECRET` | Validates Clerk webhook events | Auth webhooks |
| `INNGEST_SIGNING_KEY` | Inngest webhook signature verification | Always |
| `INNGEST_EVENT_KEY` | Inngest SDK event sending | Always |
| `ENCRYPTION_KEY` | AES-256-GCM key for BYOK key storage (64 hex chars = 32 bytes) | BYOK |
| `ENCRYPTION_IV_SALT` | Per-user IV generation salt | BYOK |
| `VERCEL_AI_GATEWAY_URL` | Vercel AI Gateway base URL | AI features |
| `SENTRY_DSN` | Sentry error capture | Observability |
| `SENTRY_AUTH_TOKEN` | Sentry source map upload (CI only) | CI/build |

### Client-accessible (`NEXT_PUBLIC_` prefix required)

| Variable | Purpose |
|----------|---------|
| `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY` | Clerk frontend SDK |
| `NEXT_PUBLIC_CLERK_SIGN_IN_URL` | `/sign-in` |
| `NEXT_PUBLIC_CLERK_SIGN_UP_URL` | `/sign-up` |
| `NEXT_PUBLIC_CLERK_AFTER_SIGN_IN_URL` | Post-login redirect |
| `NEXT_PUBLIC_CLERK_AFTER_SIGN_UP_URL` | Post-signup → `/onboarding/role` |
| `NEXT_PUBLIC_POSTHOG_KEY` | PostHog analytics (optional MVP) |
| `NEXT_PUBLIC_POSTHOG_HOST` | PostHog endpoint |

### Development-only

| Variable | Purpose |
|----------|---------|
| `INNGEST_DEV_SERVER_URL` | Points Inngest SDK at local `inngest dev` server |

**BYOK security note**: No `OPENAI_API_KEY` or `ANTHROPIC_API_KEY` appears in the server
env vars — intentional enforcement of the BYOK constitutional principle. The platform holds
no LLM keys. All LLM clients are constructed at request time using the user's decrypted
key from `SeekerSettings.byokApiKeyEncrypted`.
