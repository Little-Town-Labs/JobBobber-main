# Data Model

## Existing Entity: FeedbackInsights

The `FeedbackInsights` model already exists in the Prisma schema (created in Feature 1). No schema migration needed for the core entity.

| Field                   | Type             | Constraints     | Description                             |
| ----------------------- | ---------------- | --------------- | --------------------------------------- |
| id                      | String (CUID)    | Primary Key     | Unique identifier                       |
| userId                  | String           | Not Null        | Polymorphic FK to JobSeeker or Employer |
| userType                | FeedbackUserType | Not Null        | JOB_SEEKER or EMPLOYER                  |
| strengths               | String[]         |                 | AI-generated strength items             |
| weaknesses              | String[]         |                 | AI-generated improvement areas          |
| recommendations         | String[]         |                 | AI-generated actionable suggestions     |
| totalConversations      | Int              | Default: 0      | Lifetime conversation count             |
| inProgressCount         | Int              | Default: 0      | Currently active conversations          |
| matchRate               | Float            | Default: 0      | Match success percentage                |
| interviewConversionRate | Float            | Default: 0      | Accepted match rate                     |
| trendDirection          | TrendDirection   | Default: STABLE | IMPROVING, STABLE, DECLINING            |
| generatedAt             | DateTime         | Default: now()  | Last generation timestamp               |
| updatedAt               | DateTime         | Auto-updated    | Last update timestamp                   |

### Existing Relationships

- `jobSeeker` — optional FK to JobSeeker (cascade delete)
- `employer` — optional FK to Employer (cascade delete)
- Unique constraint on `[userId, userType]`

### Existing Enums

- `FeedbackUserType`: JOB_SEEKER, EMPLOYER
- `TrendDirection`: IMPROVING, STABLE, DECLINING

## Schema Addition: lastInsightConversationCount

One field addition needed to track when to trigger regeneration:

| Field                        | Type | Constraints | Description                           |
| ---------------------------- | ---- | ----------- | ------------------------------------- |
| lastInsightConversationCount | Int  | Default: 0  | Conversation count at last generation |

This field tracks how many completed conversations existed when insights were last generated. When `currentCount - lastInsightConversationCount >= threshold`, regeneration is triggered.

## Data Sources (Read-Only)

### AgentConversation (existing)

Used to compute aggregate statistics:

- `status` — COMPLETED_MATCH, COMPLETED_NO_MATCH, IN_PROGRESS, TERMINATED
- `seekerId` — links conversations to seeker
- `jobPostingId` — links to posting (for employer aggregation)
- `completedAt` — for trend windowing

### Match (existing)

Used for acceptance/conversion metrics:

- `confidenceScore` — STRONG, GOOD, POTENTIAL distribution
- `seekerStatus`, `employerStatus` — acceptance rates
- `evaluationData` — structured evaluation (anonymized pattern extraction)

### JobPosting (existing, employer only)

- `employerId` — scope conversations to this employer's postings

## Indexes

No new indexes needed. Existing indexes on `AgentConversation(seekerId)`, `AgentConversation(jobPostingId)`, `Match(seekerId)`, `Match(employerId)` are sufficient for aggregation queries.

## Privacy Boundary

The insight generation function receives **only** these computed aggregates:

- Conversation counts by outcome (match/no-match/terminated)
- Match confidence distribution (Strong/Good/Potential percentages)
- Acceptance rates (by the user and by counterparties)
- Recent trend data (last 5 vs overall)
- Anonymized pattern counts from evaluationData (e.g., "skills gap cited in 3/5 conversations")

**Never passed to LLM:**

- Raw conversation messages
- Counterparty names or identifiers
- Exact salary figures or private parameters
- Individual conversation details
