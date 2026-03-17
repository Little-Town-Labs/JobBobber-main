# Implementation Plan — 20-agent-tool-calling

**Specification:** `.specify/specs/20-agent-tool-calling/spec.md`
**Created:** 2026-03-17
**Dependencies:** Feature 19 (complete)

---

## Executive Summary

Add callable tools to the existing chat agent so the LLM can query live data during
conversations. Uses Vercel AI SDK's `tool()` helper with Zod schemas, passed to the
existing `streamText()` call. Tools wrap existing tRPC procedures as direct Prisma
queries within the Route Handler (no tRPC caller overhead).

**Key decisions:**

- Tools defined via `import { tool } from "ai"` with Zod input schemas
- Tools passed to `streamText({ tools })` — the AI SDK handles tool call/result flow
- Tools query the database directly (same `db` instance as the route handler)
- Role-scoped: seeker and employer get different tool sets
- Result limits enforced per tool (max 10 results)
- `toTextStreamResponse()` already supports tool calling — no streaming changes needed

---

## Architecture

```
User message → POST /api/chat
                  │
                  ├─ Auth, rate limit, BYOK decrypt (existing)
                  ├─ Assemble context (existing)
                  ├─ Define role-scoped tools
                  │
                  ▼
            streamText({
              model, system, messages,
              tools: seekerTools | employerTools  ← NEW
            })
                  │
                  ├─ LLM decides to call a tool
                  │    ├─ Tool input validated by Zod
                  │    ├─ Tool executes (DB query)
                  │    ├─ Result returned to LLM
                  │    └─ LLM generates natural language response
                  │
                  └─ Stream response to client
```

No new API routes, no new Prisma models, no new tRPC procedures.

---

## Technology Stack

| Component            | Choice                                | Rationale                                                        |
| -------------------- | ------------------------------------- | ---------------------------------------------------------------- |
| **Tool definition**  | `tool()` from `ai` package            | Already installed, integrates with `streamText`                  |
| **Input validation** | Zod schemas in tool definition        | AI SDK uses Zod natively for tool params                         |
| **Data access**      | Direct Prisma queries via `db`        | Same pattern as context assembly — avoids tRPC caller complexity |
| **Feature flag**     | `AGENT_TOOL_CALLING` via Vercel Flags | Existing flag infrastructure                                     |

---

## Implementation Phases

### Phase 1: Tool Definitions

**File to create:** `src/server/agents/chat-tools.ts`

**Seeker tools (4):**

1. `searchJobs` — query active postings by keywords/skills/location. Returns top 10.
2. `getMyMatches` — list seeker's matches with status, confidence, job title, company.
3. `getMyProfile` — return seeker's current profile data.
4. `getConversationSummary` — retrieve conversation outcome by posting title or company.

**Employer tools (4):** 5. `getCandidates` — list candidates for a specific posting with scores and statuses. 6. `getMyPostings` — list all employer postings with status and match counts. 7. `getPostingDetails` — retrieve full details of a specific posting. 8. `getConversationSummary` — same as seeker, scoped to employer's postings.

**Pattern for each tool:**

```typescript
import { tool } from "ai"
import { z } from "zod"

const searchJobs = tool({
  description: "Search active job postings by keywords, skills, or location",
  parameters: z.object({
    query: z.string().describe("Search query — skills, job title, or keywords"),
    location: z.string().optional().describe("Location filter"),
    employmentType: z.enum(["FULL_TIME", "PART_TIME", "CONTRACT"]).optional(),
  }),
  execute: async ({ query, location, employmentType }) => {
    // Direct Prisma query, max 10 results
  },
})
```

### Phase 2: Route Handler Integration

**File to modify:** `src/app/api/chat/route.ts`

1. Import tool factory functions from `chat-tools.ts`
2. Create role-scoped tool sets:
   - `buildSeekerTools(db, seekerId)` → returns seeker tool object
   - `buildEmployerTools(db, employerId)` → returns employer tool object
3. Pass tools to `streamText()`:

   ```typescript
   const tools = userRole === "EMPLOYER"
     ? buildEmployerTools(db, employerId)
     : buildSeekerTools(db, seekerId)

   const result = streamText({
     model: model(getChatModel(provider)),
     system: systemPrompt,
     messages,
     tools,           // ← NEW
     maxSteps: 3,     // Allow up to 3 sequential tool calls per turn
     onFinish: async ({ text }) => { ... },
   })
   ```

4. Add `AGENT_TOOL_CALLING` feature flag to `src/lib/flags.ts`
5. Tools only passed when flag is enabled; otherwise chat works as before

### Phase 3: Test Suite

**Files to create:**

- `src/server/agents/chat-tools.test.ts` — unit tests for each tool's execute function
- Update `src/app/api/chat/route.test.ts` — integration tests for tool calling flow

**Test coverage:**

- Each tool returns correct data for valid input
- Each tool respects ownership (seeker can only see own matches)
- Each tool enforces result limits (max 10)
- Tool with invalid input returns validation error
- Route handler passes correct tools based on user role
- Tools work with mocked DB (no real API calls)

---

## Security

| Concern            | Mitigation                                                                                |
| ------------------ | ----------------------------------------------------------------------------------------- |
| Cross-user data    | Every tool query filters by authenticated userId/seekerId/employerId                      |
| Tool abuse         | Rate limited under existing chat limit (10/min). `maxSteps: 3` limits tool calls per turn |
| Data exposure      | Tools return summaries, not raw DB rows. Private params excluded                          |
| Invalid tool input | Zod validation rejects before execute runs                                                |

## Constitutional Compliance

- [x] **Type Safety (I):** Zod schemas on all tool inputs/outputs
- [x] **TDD (II):** Tests for every tool + route integration
- [x] **BYOK (III):** Tools use the same LLM call — no additional API keys
- [x] **Minimal Abstractions (IV):** `tool()` from AI SDK — no framework
- [x] **Security (V):** Ownership checks on every query
- [x] **Feature Flags (VI):** `AGENT_TOOL_CALLING` flag
- [x] **Agent Autonomy (VII):** Read-only tools, no actions

---

## File Inventory

| File                                   | Action | Purpose                       |
| -------------------------------------- | ------ | ----------------------------- |
| `src/server/agents/chat-tools.ts`      | Create | Tool definitions (8 tools)    |
| `src/server/agents/chat-tools.test.ts` | Create | Tool unit tests               |
| `src/app/api/chat/route.ts`            | Modify | Pass tools to streamText      |
| `src/app/api/chat/route.test.ts`       | Modify | Add tool integration tests    |
| `src/lib/flags.ts`                     | Modify | Add `AGENT_TOOL_CALLING` flag |

**Estimated effort:** 12 hours
