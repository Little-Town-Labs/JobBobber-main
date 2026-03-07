# Data Model — 5-basic-ai-matching

**Spec:** .specify/specs/5-basic-ai-matching/spec.md
**Date:** 2026-03-05

---

## Existing Entities (No Schema Changes)

The Prisma schema already contains the entities needed for basic matching. No new models or migrations are required.

### Match (existing in schema.prisma)

| Field              | Type             | Constraints      | Description                    |
| ------------------ | ---------------- | ---------------- | ------------------------------ |
| id                 | String (CUID)    | PK               | Unique identifier              |
| conversationId     | String           | FK, Unique       | Link to AgentConversation      |
| jobPostingId       | String           | FK               | Link to JobPosting             |
| seekerId           | String           | FK               | Link to JobSeeker              |
| employerId         | String           | FK               | Link to Employer               |
| confidenceScore    | MatchConfidence  | Enum             | STRONG / GOOD / POTENTIAL      |
| matchSummary       | String           | Not Null         | AI-generated match explanation |
| seekerStatus       | MatchPartyStatus | Default: PENDING | Seeker's accept/decline        |
| employerStatus     | MatchPartyStatus | Default: PENDING | Employer's accept/decline      |
| seekerContactInfo  | Json?            | Nullable         | Revealed after mutual accept   |
| seekerAvailability | Json?            | Nullable         | Revealed after mutual accept   |
| createdAt          | DateTime         | Auto             | Record creation                |
| updatedAt          | DateTime         | Auto             | Last update                    |

**Enums:**

- `MatchConfidence`: STRONG, GOOD, POTENTIAL
- `MatchPartyStatus`: PENDING, ACCEPTED, DECLINED, EXPIRED

### AgentConversation (existing in schema.prisma)

Used in MVP as a minimal wrapper around the evaluation — no multi-turn conversation yet.

| Field        | Type               | Constraints          | Description                       |
| ------------ | ------------------ | -------------------- | --------------------------------- |
| id           | String (CUID)      | PK                   | Unique identifier                 |
| jobPostingId | String             | FK                   | Link to JobPosting                |
| seekerId     | String             | FK                   | Link to JobSeeker                 |
| status       | ConversationStatus | Default: IN_PROGRESS | Lifecycle state                   |
| messages     | Json[]             | Default: []          | In MVP: single evaluation message |
| startedAt    | DateTime           | Auto                 | When evaluation began             |
| completedAt  | DateTime?          | Nullable             | When evaluation finished          |
| outcome      | String?            | Nullable             | Result summary                    |
| inngestRunId | String?            | Nullable             | Link to Inngest workflow run      |

**Enums:**

- `ConversationStatus`: IN_PROGRESS, COMPLETED_MATCH, COMPLETED_NO_MATCH, TERMINATED

### Key Relationships

```
JobPosting (ACTIVE) --< AgentConversation >-- JobSeeker (active)
                            |
                       Match (1:1)
                            |
                       Employer (via JobPosting)
```

### BYOK Key Access Path

```
Employer
  └─ byokApiKeyEncrypted  (AES-256-GCM encrypted)
  └─ byokProvider          ("openai" | "anthropic")

Decrypted at workflow execution time via src/lib/encryption.ts decrypt()
```

---

## New Application-Level Types (Not DB Models)

### AgentEvaluationInput

Input assembled for each candidate evaluation:

```
{
  posting: { title, description, requiredSkills, preferredSkills, experienceLevel, employmentType, locationType, locationReq, salaryMin, salaryMax, benefits, whyApply }
  candidate: { name, headline, skills, experience, education, location, profileCompleteness }
}
```

### AgentEvaluationOutput (Zod-validated)

Structured output from the LLM:

```
{
  score: integer 0-100
  confidence: "STRONG" | "GOOD" | "POTENTIAL"
  matchSummary: string (2-4 sentences)
  strengthAreas: string[]
  gapAreas: string[]
}
```

### WorkflowState

Inngest workflow metadata:

```
{
  jobPostingId: string
  employerId: string
  totalCandidates: number
  evaluatedCount: number
  matchesCreated: number
  skippedCount: number
  status: "QUEUED" | "RUNNING" | "COMPLETED" | "FAILED"
  error?: string
}
```

---

## Indexes (Already Defined)

The following indexes already exist in the Prisma schema and support matching queries:

- `Match`: seekerId, employerId, jobPostingId, seekerStatus, employerStatus, composite indexes
- `AgentConversation`: seekerId, jobPostingId, status, inngestRunId, composite [seekerId, jobPostingId]
- `JobPosting`: status, employerId, composite [status, employerId]
- `JobSeeker`: isActive, clerkUserId

---

## Query Patterns

| Operation                 | Access Pattern                                                       | Index Used                 |
| ------------------------- | -------------------------------------------------------------------- | -------------------------- |
| Find eligible candidates  | `jobSeeker.findMany({ where: { isActive: true } })`                  | isActive                   |
| Find matches for employer | `match.findMany({ where: { employerId, jobPostingId } })`            | [jobPostingId, employerId] |
| Find matches for seeker   | `match.findMany({ where: { seekerId } })`                            | seekerId                   |
| Check duplicate match     | `agentConversation.findFirst({ where: { seekerId, jobPostingId } })` | [seekerId, jobPostingId]   |
| Get employer BYOK key     | `employer.findUnique({ where: { id } })`                             | PK                         |
