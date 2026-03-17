# Implementation Plan — 19-user-chat-basic

**Specification:** `.specify/specs/19-user-chat-basic/spec.md`
**Research:** `.specify/specs/19-user-chat-basic/research.md`
**Data Model:** `.specify/specs/19-user-chat-basic/data-model.md`
**API Contract:** `.specify/specs/19-user-chat-basic/contracts/chat-api.yaml`
**Created:** 2026-03-16

---

## Executive Summary

Add a user-facing chat interface where job seekers and employers can converse with
their personal AI agent. Uses Vercel AI SDK `useChat()` for streaming and a new
`ChatMessage` Prisma model for persistence. The chat agent has read-only context
from the user's profile, matches, and conversation logs.

**Key architecture decisions:**

- Streaming via Next.js Route Handler (`/api/chat`) — tRPC doesn't support streaming
- Message persistence via individual `ChatMessage` rows (not Json array — unbounded growth)
- Context assembled per-request from existing tables (always fresh, no caching)
- Lighter LLM model (gpt-4o-mini / claude-haiku) for cost efficiency
- Rate limited at 10 messages/minute via existing Upstash infrastructure

---

## Architecture Overview

```
┌──────────────────────────────────────────────────────────────┐
│                        Browser                               │
│                                                              │
│  ┌─────────────────────┐    ┌────────────────────────────┐  │
│  │   Chat Page          │    │   useChat() Hook           │  │
│  │   /chat (seeker)     │◄──►│   Manages messages state   │  │
│  │   /chat (employer)   │    │   Handles streaming        │  │
│  └─────────────────────┘    └──────────┬─────────────────┘  │
│                                         │                    │
└─────────────────────────────────────────┼────────────────────┘
                                          │ POST /api/chat (streaming)
                                          │ tRPC chat.getHistory (pagination)
                                          ▼
┌──────────────────────────────────────────────────────────────┐
│                     Next.js Server                            │
│                                                              │
│  ┌──────────────────────┐   ┌────────────────────────────┐  │
│  │  POST /api/chat      │   │  tRPC chat router          │  │
│  │  (Route Handler)     │   │  (protectedProcedure)      │  │
│  │                      │   │                            │  │
│  │  1. Auth (Clerk)     │   │  • getHistory (paginated)  │  │
│  │  2. Rate limit check │   │                            │  │
│  │  3. BYOK decrypt     │   └────────────┬───────────────┘  │
│  │  4. Context assembly │                │                   │
│  │  5. Stream LLM call  │                │                   │
│  │  6. Persist messages  │                │                   │
│  └──────────┬───────────┘                │                   │
│             │                             │                   │
└─────────────┼─────────────────────────────┼───────────────────┘
              │                             │
    ┌─────────▼──────────┐     ┌────────────▼───────────┐
    │  User's LLM API    │     │  NeonDB (PostgreSQL)   │
    │  (BYOK)            │     │                        │
    │                    │     │  • ChatMessage (new)   │
    │  gpt-4o-mini  or   │     │  • JobSeeker (read)    │
    │  claude-haiku      │     │  • Match (read)        │
    └────────────────────┘     │  • SeekerSettings (read)│
                               │  • AgentConversation   │
                               └────────────────────────┘
```

---

## Technology Stack

| Component               | Choice                                          | Rationale                                                             |
| ----------------------- | ----------------------------------------------- | --------------------------------------------------------------------- |
| **Streaming**           | Vercel AI SDK `streamText` + `useChat()`        | Already installed (v6.0.99), handles SSE streaming, React integration |
| **Streaming endpoint**  | Next.js Route Handler `/api/chat`               | tRPC doesn't support streaming responses                              |
| **History persistence** | tRPC `chat` router                              | Type-safe, follows existing patterns                                  |
| **Message storage**     | Prisma `ChatMessage` model                      | Individual rows for pagination (not Json array)                       |
| **Auth**                | Clerk `auth()` via `getAuth()` helper           | Existing auth boundary                                                |
| **BYOK decryption**     | Existing `decrypt()` from `encryption.ts`       | AES-256-GCM, user-scoped                                              |
| **Rate limiting**       | Existing Upstash rate limiter                   | Add `chat` category (10/min)                                          |
| **LLM model**           | gpt-4o-mini (OpenAI) / claude-haiku (Anthropic) | Cost-efficient for Q&A                                                |
| **Feature flag**        | `USER_CHAT` via Vercel Flags SDK                | Existing flag infrastructure                                          |

---

## Implementation Phases

### Phase 1: Database & Schema (Foundation)

**Files to create/modify:**

- `prisma/schema.prisma` — add `ChatMessage` model and `ChatMessageRole` enum
- Run migration

**Work:**

1. Add `ChatMessageRole` enum (`USER`, `ASSISTANT`)
2. Add `ChatMessage` model with indexes
3. Generate and apply migration
4. Add `chat` rate limit category to `src/lib/rate-limit.ts`
5. Add `USER_CHAT` feature flag to `src/lib/flags.ts`

**Tests:**

- Migration applies cleanly
- ChatMessage CRUD operations work

---

### Phase 2: Chat Agent System Prompt & Context Assembly

**Files to create:**

- `src/server/agents/chat-agent.ts` — system prompt builder + context assembly

**Work:**

1. Create `buildChatSystemPrompt(context: ChatAgentContext): string`
   - Identifies as "your JobBobber agent"
   - Job-focused persona with polite off-topic redirection
   - Injects user profile summary, match summaries, private settings (own user only)
   - Read-only instruction: "You cannot take actions. You can only provide information and advice."
2. Create `assembleChatContext(db, userId, userRole): Promise<ChatAgentContext>`
   - Seeker: profile, skills, matches (last 10), private settings, conversation summaries
   - Employer: company profile, active postings, matches per posting, conversation summaries
   - Never includes other users' private data
3. Create Zod schema for `ChatAgentContext`

**Tests:**

- System prompt includes user's actual name, skills, match count
- Seeker context includes private settings (own data)
- Employer context includes posting titles and match counts
- Context never includes other users' data
- Off-topic instruction present in system prompt

---

### Phase 3: Streaming Route Handler

**Files to create:**

- `src/app/api/chat/route.ts` — POST handler for streaming

**Work:**

1. Authenticate via `getAuth()` — return 401 if not authenticated
2. Rate limit check via `checkRateLimit(userId, "chat")` — return 429 if exceeded
3. Look up BYOK key:
   - Seeker: `SeekerSettings.byokApiKeyEncrypted` + `byokProvider`
   - Employer: `Employer.byokApiKeyEncrypted` + `byokProvider`
   - Return 403 if no key configured
4. Decrypt key via `decrypt(encryptedKey, scopeId)`
5. Assemble context via `assembleChatContext()`
6. Persist incoming user message to `ChatMessage` table
7. Call `streamText()` with:
   - `model`: `createProvider(provider, decryptedKey)(modelName)`
   - `system`: `buildChatSystemPrompt(context)`
   - `messages`: from request body
8. On stream completion callback: persist assistant message to `ChatMessage` table
9. Return streaming response

**Tests:**

- Returns 401 without auth
- Returns 403 without BYOK key
- Returns 429 when rate limited
- Streams response for authenticated user with valid key
- Persists both user and assistant messages
- Uses correct model per provider (gpt-4o-mini / claude-haiku)

---

### Phase 4: tRPC Chat Router

**Files to create:**

- `src/server/api/routers/chat.ts` — chat history procedures
- Modify `src/server/api/root.ts` — add chat router

**Work:**

1. `getHistory` procedure (protectedProcedure):
   - Input: `{ cursor?: string, limit?: number (default 50, max 100) }`
   - Query `ChatMessage` where `clerkUserId = ctx.userId`, ordered by `createdAt DESC`
   - Cursor-based pagination (existing pattern)
   - Return `{ items, nextCursor, hasMore }`
2. Add `chatRouter` to `appRouter` in `root.ts`
3. Add typed hook `useChatGetHistory()` to `src/lib/trpc/hooks.ts`
4. Update `RouterOutputs` / `RouterInputs` types

**Tests:**

- Returns messages for authenticated user only
- Pagination works with cursor
- Empty history returns empty items array
- Messages ordered by createdAt descending

---

### Phase 5: Chat UI Page

**Files to create:**

- `src/app/(seeker)/chat/page.tsx` — seeker chat page
- `src/app/(employer)/dashboard/chat/page.tsx` — employer chat page
- `src/components/chat/chat-interface.tsx` — shared chat UI component

**Work:**

1. `ChatInterface` component:
   - Uses `useChat()` hook from Vercel AI SDK pointed at `/api/chat`
   - Loads history via `useChatGetHistory()` tRPC hook on mount
   - Merges persisted history with `useChat()` managed messages
   - Message input with character limit (5000 chars)
   - Send button with loading state
   - Message list with user/assistant differentiation
   - Scrolls to bottom on new messages
   - Error display for provider errors
   - Rate limit exceeded message
2. Seeker chat page (`/chat`):
   - Feature flag check (`USER_CHAT`)
   - BYOK key check — show setup prompt if missing
   - Render `ChatInterface`
3. Employer chat page (`/dashboard/chat`):
   - Same pattern, employer layout

**Tests:**

- Renders loading skeleton while history loads
- Displays BYOK setup prompt when no key configured
- Sends message and displays streamed response
- Displays error on provider failure
- Character limit enforced on input
- Previous messages displayed on mount

---

### Phase 6: GDPR Compliance Update

**Files to modify:**

- `src/server/inngest/functions/execute-account-deletion.ts` — add ChatMessage cleanup

**Work:**

1. Add a step to delete all `ChatMessage` rows for the user's `clerkUserId`
2. Must run before the user record is deleted (cascade order)

**Tests:**

- Account deletion removes all chat messages
- Deletion of chat messages doesn't affect other users' messages

---

## Security Considerations

| Concern                             | Mitigation                                                                                                                                                                              |
| ----------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Cross-user data leakage**         | Context assembly queries filter by authenticated userId only. System prompt explicitly instructs agent to discuss only the user's own data.                                             |
| **BYOK key exposure**               | Key decrypted in Route Handler only, never sent to client. Same AES-256-GCM pattern as existing agent code.                                                                             |
| **Prompt injection via chat input** | Agent system prompt uses clear role boundaries. User message is the `user` role — cannot override `system` instructions. Same guardrail pattern as custom-agent-prompting (Feature 15). |
| **Rate limiting bypass**            | Server-side Upstash rate limit check before LLM call. Client-side disable is cosmetic only.                                                                                             |
| **Message content privacy**         | Chat messages stored per-user with clerkUserId. No cross-user queries possible through the chat router.                                                                                 |
| **GDPR deletion**                   | ChatMessage included in account deletion cascade (Phase 6).                                                                                                                             |

---

## Performance Strategy

| Metric                  | Target       | Approach                                                          |
| ----------------------- | ------------ | ----------------------------------------------------------------- |
| **First token latency** | <1s (p90)    | Lighter model (gpt-4o-mini), context assembly <50ms               |
| **History page load**   | <2s (p90)    | Indexed query on (clerkUserId, createdAt DESC), cursor pagination |
| **Context assembly**    | <100ms       | Parallel DB queries for profile, matches, settings                |
| **Message persistence** | Non-blocking | Persist after streaming completes, not in the critical path       |

---

## Testing Strategy

| Layer           | Coverage                                                        | Tools                               |
| --------------- | --------------------------------------------------------------- | ----------------------------------- |
| **Unit**        | System prompt builder, context assembly, rate limit check       | Vitest, mocked DB                   |
| **Integration** | Route Handler (auth, rate limit, streaming), tRPC router (CRUD) | Vitest, mocked LLM                  |
| **Component**   | ChatInterface (render, send, error states, BYOK prompt)         | Vitest + Testing Library            |
| **E2E**         | Full chat flow (open, send message, receive response)           | Playwright (deferred to E2E sprint) |

**LLM mocking:** All tests mock the AI SDK — no real API calls. Use `vi.mock("ai")` to return deterministic streamed responses.

---

## Risks & Mitigation

| Risk                                                 | Likelihood | Impact | Mitigation                                                                                                                |
| ---------------------------------------------------- | ---------- | ------ | ------------------------------------------------------------------------------------------------------------------------- |
| `useChat()` hook conflicts with tRPC-managed history | Medium     | Medium | Merge strategy: load persisted history first, then let `useChat()` manage new messages. Deduplicate by message ID.        |
| Streaming endpoint outside tRPC loses type safety    | Low        | Low    | Input validated with Zod in Route Handler. Only the stream itself is untyped — messages are validated before persistence. |
| Large context exceeds model context window           | Low        | Medium | Truncate older messages, summarize profile data. Monitor context size in development.                                     |
| Adding 19th router worsens TS2589                    | Low        | Medium | New typed hook in `hooks.ts` prevents client-side overflow. Router output types pre-computed via `inferRouterOutputs`.    |

---

## Constitutional Compliance

- [x] **Type Safety First (I):** Zod schemas for ChatMessage, context, and Route Handler input. tRPC router is fully typed. Only the SSE stream is untyped (inherent to streaming).
- [x] **Test-Driven Development (II):** Tests defined for every phase. 80%+ coverage required. LLM calls mocked.
- [x] **BYOK Architecture (III):** User's own API key decrypted per-request. No platform keys. Lighter model choice reduces user cost.
- [x] **Minimal Abstractions (IV):** Uses Vercel AI SDK directly (already in project). No new frameworks. No LangChain.
- [x] **Security & Privacy (V):** Context assembly excludes other users' data. BYOK key never sent to client. Rate limiting prevents abuse.
- [x] **Feature Flags (VI):** `USER_CHAT` flag gates the feature. Chat pages check flag before rendering.
- [x] **Agent Autonomy (VII):** Chat agent is advisory only (read-only). Does not interfere with autonomous agent-to-agent negotiations.

---

## File Inventory

### New Files (7)

| File                                            | Purpose                                  |
| ----------------------------------------------- | ---------------------------------------- |
| `src/server/agents/chat-agent.ts`               | System prompt builder + context assembly |
| `src/app/api/chat/route.ts`                     | Streaming Route Handler                  |
| `src/server/api/routers/chat.ts`                | tRPC chat history router                 |
| `src/components/chat/chat-interface.tsx`        | Shared chat UI component                 |
| `src/app/(seeker)/chat/page.tsx`                | Seeker chat page                         |
| `src/app/(employer)/dashboard/chat/page.tsx`    | Employer chat page                       |
| `prisma/migrations/YYYYMMDD_add_chat_messages/` | Migration                                |

### Modified Files (5)

| File                                                       | Change                                       |
| ---------------------------------------------------------- | -------------------------------------------- |
| `prisma/schema.prisma`                                     | Add ChatMessage model + ChatMessageRole enum |
| `src/server/api/root.ts`                                   | Add chatRouter to appRouter                  |
| `src/lib/rate-limit.ts`                                    | Add `chat` rate limit category               |
| `src/lib/flags.ts`                                         | Add `USER_CHAT` flag                         |
| `src/server/inngest/functions/execute-account-deletion.ts` | Delete ChatMessages on account deletion      |
| `src/lib/trpc/hooks.ts`                                    | Add `useChatGetHistory()` typed hook         |

### Test Files (4)

| File                                                 | Covers                                                   |
| ---------------------------------------------------- | -------------------------------------------------------- |
| `src/server/agents/chat-agent.test.ts`               | Prompt builder, context assembly                         |
| `src/app/api/chat/route.test.ts`                     | Route Handler (auth, rate limit, streaming, persistence) |
| `src/server/api/routers/chat.test.ts`                | tRPC history router                                      |
| `tests/unit/components/chat/chat-interface.test.tsx` | UI component                                             |
