# Data Model: Agent-to-Agent Conversations

**Feature:** 9-agent-to-agent-conversations
**Migration Required:** No — existing schema supports all requirements

---

## Existing Entities (Used As-Is)

### AgentConversation

Already defined in `prisma/schema.prisma`. No changes needed.

| Field        | Type                        | Feature 9 Usage                                                                            |
| ------------ | --------------------------- | ------------------------------------------------------------------------------------------ |
| id           | String @id @default(cuid()) | Primary key                                                                                |
| jobPostingId | String                      | FK to the job posting being discussed                                                      |
| seekerId     | String                      | FK to the job seeker                                                                       |
| status       | ConversationStatus          | IN_PROGRESS during conversation; COMPLETED_MATCH, COMPLETED_NO_MATCH, or TERMINATED on end |
| messages     | Json[] @default([])         | Array of ConversationMessage objects (see schema below)                                    |
| startedAt    | DateTime                    | When conversation began                                                                    |
| completedAt  | DateTime?                   | When conversation ended (null while IN_PROGRESS)                                           |
| outcome      | String?                     | Brief summary: "Mutual match at turn 6" or "No match: salary misalignment"                 |
| inngestRunId | String?                     | Links to the Inngest `run-agent-conversation` workflow run                                 |

**Indexes:** seekerId, jobPostingId, status, (seekerId + jobPostingId), inngestRunId

### Match

Existing model, unchanged. Created only when both agents signal MATCH.

| Field           | Feature 9 Relevance                                     |
| --------------- | ------------------------------------------------------- |
| conversationId  | Links to the AgentConversation that produced the match  |
| confidenceScore | STRONG/GOOD/POTENTIAL — derived from conversation depth |
| matchSummary    | AI-generated from final conversation state              |

### SeekerSettings (Read-Only Access)

Private params read server-side by the Job Seeker Agent:

- `minSalary`, `salaryRules`, `dealBreakers`, `priorities`, `exclusions`, `customPrompt`
- BYOK fields: `byokApiKeyEncrypted`, `byokProvider`

### JobSettings (Read-Only Access)

Private params read server-side by the Employer Agent:

- `trueMaxSalary`, `urgency`, `willingToTrain`, `priorityAttrs`, `customPrompt`
- BYOK fields: `byokApiKeyEncrypted`, `byokProvider` (falls back to employer-level BYOK)

---

## ConversationMessage Schema (Zod-Validated Json)

Stored in `AgentConversation.messages[]`:

```typescript
const conversationMessageSchema = z.object({
  role: z.enum(["employer_agent", "seeker_agent"]),
  content: z.string().max(2000),
  phase: z.enum(["discovery", "screening", "deep_evaluation", "negotiation", "decision"]),
  timestamp: z.string().datetime(),
  turnNumber: z.number().int().min(0),
  decision: z.enum(["MATCH", "NO_MATCH", "CONTINUE"]).optional(),
})
```

---

## ConversationStatus Enum (Existing)

```prisma
enum ConversationStatus {
  IN_PROGRESS
  COMPLETED_MATCH
  COMPLETED_NO_MATCH
  TERMINATED
}
```

No changes needed — covers all Feature 9 states.

---

## Relationships

```
JobPosting 1──N AgentConversation N──1 JobSeeker
                     │
                     1
                     │
                     0..1 Match
```

Each conversation can produce at most one Match (enforced by `conversationId @unique` on Match).

---

## Duplicate Prevention

The compound index `@@index([seekerId, jobPostingId])` on AgentConversation enables efficient lookup for the duplicate check: only one IN_PROGRESS conversation per seeker-posting pair.
