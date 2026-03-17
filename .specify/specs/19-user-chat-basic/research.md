# Technology Research — 19-user-chat-basic

## Decision 1: Chat Streaming Approach

**Context:** Need real-time token-by-token streaming from LLM to browser.

**Options:**

1. **Vercel AI SDK `useChat()` hook + Next.js Route Handler**
   - Pros: Already in the project (`ai: ^6.0.99`), built-in streaming, message history management, handles SSE/fetch streaming, React hook with loading states
   - Cons: Requires a Next.js API route (not tRPC) for the streaming endpoint
   - Examples: Vercel AI SDK documentation, ChatGPT-style interfaces

2. **tRPC subscription (WebSocket)**
   - Pros: Keeps everything in tRPC, type-safe
   - Cons: tRPC subscriptions require WebSocket adapter, Vercel doesn't support persistent WebSockets, would need separate infrastructure
   - Examples: Not commonly used for LLM streaming

3. **Custom SSE endpoint + manual state management**
   - Pros: Full control
   - Cons: Reinvents what Vercel AI SDK already provides, more code to maintain

**Chosen:** Option 1 — Vercel AI SDK `useChat()` + Route Handler
**Rationale:** The AI SDK is already installed at v6.0.99 with OpenAI and Anthropic provider packages. The `useChat()` hook handles streaming, message state, loading indicators, and error states out of the box. The only tradeoff is that the streaming endpoint must be a Next.js Route Handler (`/api/chat/route.ts`) rather than a tRPC procedure, because tRPC doesn't support streaming responses. Non-streaming operations (history persistence, context loading) remain in tRPC.
**Tradeoffs:** Streaming endpoint is outside tRPC (no end-to-end type safety on the stream itself), but message persistence and context loading are type-safe via tRPC.

---

## Decision 2: Message Persistence Strategy

**Context:** Chat messages need to survive page navigation and session restarts (FR-004).

**Options:**

1. **New Prisma model `ChatMessage` with individual rows per message**
   - Pros: Queryable, paginated, indexable by timestamp
   - Cons: More DB writes (one per message), more complex queries
   - Schema: `id, userId, role, content, createdAt`

2. **New Prisma model `ChatSession` with `messages Json[]` (like AgentConversation)**
   - Pros: Follows existing pattern (AgentConversation uses `Json[]`), single row per session, atomic reads
   - Cons: JSON array grows unbounded, harder to paginate within a session, Prisma Json typing issues (mitigated by our new Zod schemas)

3. **Hybrid: `ChatSession` row + `ChatMessage` rows**
   - Pros: Session metadata separate from messages, messages individually queryable
   - Cons: More complex, two tables for one feature

**Chosen:** Option 1 — Individual `ChatMessage` rows
**Rationale:** Unlike agent conversations (which are short, finite exchanges), user chat sessions grow unboundedly over weeks/months. Individual rows allow cursor-based pagination (matching existing codebase pattern), efficient loading of recent messages, and simple GDPR deletion cascades. The existing `Json[]` pattern works for agent conversations (max ~20 messages) but doesn't scale for open-ended user chat.
**Tradeoffs:** More DB writes per message, but chat messages are infrequent (user types, waits for response, reads) — not a performance concern.

---

## Decision 3: Agent Context Assembly

**Context:** The chat agent needs read-only access to user data (FR-005 through FR-008).

**Options:**

1. **Assemble context in the Route Handler before each LLM call**
   - Pros: Always fresh data, simple, no caching issues
   - Cons: DB queries on every message, adds latency before first token

2. **Assemble context once per session, cache in memory**
   - Pros: Fast subsequent messages
   - Cons: Stale data if profile/matches change mid-session, cache invalidation complexity

3. **Assemble context in a tRPC procedure, pass to Route Handler via request body**
   - Pros: Type-safe context assembly, reusable
   - Cons: Large request body, context still needs refreshing

**Chosen:** Option 1 — Assemble in Route Handler per request
**Rationale:** Chat messages are infrequent (seconds to minutes apart). The DB queries to assemble context (profile, recent matches, private settings) take <50ms total with existing indexes. This ensures the agent always has current data without cache invalidation complexity. The latency is masked by streaming — the first token arrives quickly even if context assembly takes 50ms.
**Tradeoffs:** Slightly more DB load per message, but negligible given chat frequency.

---

## Decision 4: Rate Limiting for Chat

**Context:** Need to limit chat messages to 10/minute per user (FR-011a).

**Options:**

1. **Reuse existing Upstash rate limiter with new category**
   - Pros: Infrastructure exists, fail-open design, consistent pattern
   - Cons: None significant

2. **Client-side throttle only**
   - Pros: Zero server load
   - Cons: Easily bypassed, doesn't protect BYOK spend

**Chosen:** Option 1 — Existing Upstash rate limiter
**Rationale:** Add a `chat` category to `RATE_LIMIT_CATEGORIES` with `{ requests: 10, window: "1m" }`. Check in the Route Handler before calling the LLM. Existing fail-open design means chat still works if Redis is down.
**Tradeoffs:** None — this is the established pattern.

---

## Decision 5: LLM Model Selection for Chat

**Context:** Which model to use for the conversational chat agent.

**Options:**

1. **Same model as agent conversations (gpt-4o / claude-sonnet)**
   - Pros: Consistent quality, proven prompts
   - Cons: Higher cost per message for a conversational UI

2. **Lighter model (gpt-4o-mini / claude-haiku)**
   - Pros: 10-20x cheaper, faster responses, adequate for Q&A
   - Cons: Less capable for complex reasoning

3. **User-configurable model selection**
   - Pros: Maximum flexibility
   - Cons: UI complexity, harder to test

**Chosen:** Option 2 — Lighter model by default
**Rationale:** Chat is advisory Q&A, not agent-to-agent negotiation. A lighter model (gpt-4o-mini for OpenAI, claude-haiku for Anthropic) provides adequate quality at 10-20x lower cost. Users already pay for their own API usage — keeping costs low improves adoption. The chat prompt is simpler than the negotiation prompts and doesn't require the reasoning depth of the larger models.
**Tradeoffs:** Slightly lower response quality vs significantly lower user cost.
