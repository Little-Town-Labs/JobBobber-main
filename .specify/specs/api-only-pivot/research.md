# Technology Research — API-Only Pivot

**Feature:** api-only-pivot
**Date:** 2026-04-30
**Status:** Approved

---

## Decision 1: REST Adapter Strategy

### Context

The existing API surface is 18 tRPC routers with full Zod validation, 85 test files,
and ~5,300 LOC. External agents and HTTP clients require standard REST/JSON, not
tRPC's TypeScript-only transport.

### Options Considered

**Option A: `trpc-openapi` adapter**

- Adds `meta: { openapi: { method, path } }` to each tRPC procedure
- Mounts a REST handler at `/api/v1/[...path]`
- Auto-generates OpenAPI 3.0 spec from existing Zod schemas
- All 85 existing tests remain valid; no router rewrite
- Maintained by the tRPC ecosystem; actively used in production

**Option B: Rewrite routers as raw Next.js route handlers**

- Full REST control but requires rewriting ~5,300 LOC
- Invalidates all 85 router test files
- High regression risk; large upfront cost for no functional gain

**Option C: Hono on a separate `/api/v1/` prefix**

- Thin, fast HTTP framework, excellent TypeScript support
- Would duplicate business logic or require calling tRPC internals indirectly
- Adds a second server framework to maintain

### Chosen: Option A — `trpc-openapi`

**Rationale:** Preserves all type safety and tests. Delivers standard REST + OpenAPI
spec at minimal cost. The Zod schemas already serve as the canonical source of truth
for request/response shapes.
**Tradeoffs:** trpc-openapi requires procedures to have explicit `input`/`output`
schemas (some `publicProcedure` calls currently lack `output` — these need to be
annotated before the adapter will generate valid spec entries).

---

## Decision 2: API Key Authentication

### Context

External agents need a way to authenticate without a browser session (Clerk JWT is
session-based). API keys must be long-lived, revocable, and scoped to an owner.

### Options Considered

**Option A: Custom hashed API keys**

- Generate 32-byte random token → store SHA-256 hash in DB
- Display plaintext once at creation; never again
- `Authorization: Bearer jb_live_<base64>` header
- Simple, no dependencies, full control over key format and lifecycle
- Industry-standard pattern (GitHub PATs, Stripe, Anthropic)

**Option B: OAuth 2.0 client credentials flow**

- Standard for machine-to-machine auth
- High implementation complexity; requires token endpoint, refresh logic, expiry
- Overkill for the use case — agents just want a persistent key

**Option C: Clerk machine tokens (API keys)**

- Clerk offers machine token support
- Ties key lifecycle to Clerk's UI/admin; less control over format
- Not yet GA at the time of this writing; risk of API changes

### Chosen: Option A — Custom hashed API keys

**Rationale:** Simple, battle-tested, zero new dependencies, fully testable without
mocking OAuth flows. Key rotation and revocation are trivial DB writes.
**Tradeoffs:** We own the security of key generation (must use `crypto.randomBytes(32)`,
not `Math.random()`). Key format must be documented clearly to avoid confusion with
BYOK keys.

---

## Decision 3: Webhook Delivery

### Context

Agents subscribing to JobBobber events need push notifications. Polling the REST API
is inefficient for low-latency match pipelines. Resend (email) exists but agents
don't read email.

### Options Considered

**Option A: Inngest step inside existing notification functions**

- After the existing `sendEmail` step, add `step.run("post-webhook", ...)` that
  POSTs the event payload to registered webhook URLs
- Zero new infrastructure; reuses existing Inngest retry/backoff semantics
- HMAC-SHA256 signature on each delivery (same pattern as Stripe/Clerk webhooks)

**Option B: Separate webhook queue (e.g. Vercel Queues)**

- Dedicated delivery infrastructure with dead-letter queues
- More operationally complex; Vercel Queues is still beta
- Unnecessary for the initial pivot scale

**Option C: Direct HTTP call in tRPC mutation (synchronous)**

- Fire webhook inline when a match is created/updated
- Adds latency to the user-facing response path
- No retry on failure; bad actor webhook URLs block mutations

### Chosen: Option A — Inngest step in notification functions

**Rationale:** Reuses existing retry/step semantics, keeps webhook delivery async
and decoupled from the request path, and requires minimal new code.
**Tradeoffs:** Webhook delivery is batched with email delivery inside the same Inngest
function. If email and webhook have different retry needs in the future, they should
be split into separate functions.

---

## Decision 4: Rate Limiting

### Context

The existing rate limiter (`src/lib/rate-limit.ts`) dynamically imports
`@upstash/ratelimit` and `@upstash/redis` at runtime, but neither package is in
`package.json`. Rate limiting silently passes all requests when the packages are
absent — a production security hole.

### Options Considered

**Option A: Add `@upstash/ratelimit` + `@upstash/redis` to `package.json`**

- Makes the existing implementation actually work
- Requires provisioning Upstash Redis in Vercel Marketplace
- Sliding window algorithm is already implemented correctly

**Option B: Replace with `@upstash/ratelimit` using Vercel KV (deprecated)**

- Vercel KV is no longer offered; skip

**Option C: In-process token bucket (no Redis)**

- Works for single-instance local dev but fails in serverless (no shared memory)
- Not viable on Vercel

### Chosen: Option A — Add Upstash as proper dependency

**Rationale:** The implementation is correct; only the dependency declaration is
missing. Adding the packages and provisioning Upstash Redis via Vercel Marketplace
is a 15-minute fix.
**Tradeoffs:** Adds a paid dependency (Upstash free tier is sufficient for MVP
scale). Rate limit state is lost on Redis restart (acceptable for sliding window).

---

## Decision 5: API Documentation UI

### Context

The auto-generated OpenAPI spec needs a human-readable documentation surface for
developers building agent integrations.

### Options Considered

**Option A: Scalar**

- Modern, beautiful UI; actively maintained; lightweight bundle (~150KB)
- Native Next.js integration via `@scalar/nextjs-api-reference`
- Renders directly from `/api/v1/openapi.json`

**Option B: Swagger UI**

- Industry standard; universally recognized
- Older design; heavier bundle (~500KB)

**Option C: Redoc**

- Clean three-panel layout; good for complex APIs
- Read-only (no "try it" functionality)

### Chosen: Option A — Scalar

**Rationale:** Best developer experience, lightest bundle, native Next.js package
available, and "Try it" request runner built in.
**Tradeoffs:** Less universally recognized than Swagger UI, but this matters less as
the spec itself is importable into any tool.

---

## Decision 6: Landing Page Stack

### Context

`src/app/page.tsx` is a 9-line placeholder. It becomes the primary product surface
for an API-only platform. Needs: marketing copy, pricing, CTA to sign up.

### Options Considered

**Option A: Rebuild within existing Next.js app (RSC)**

- Zero new infrastructure; deploy alongside the API
- Use existing Tailwind + shadcn/ui

**Option B: Separate marketing site (e.g. Framer, Webflow)**

- Design-first tooling; fast iteration on marketing copy
- Adds separate deployment, subdomain routing complexity

### Chosen: Option A — Next.js RSC page

**Rationale:** Landing page is static content with one CTA → Clerk sign-up. RSC +
static generation means zero runtime cost. Keeping it in the same repo avoids
deploy coordination overhead.
**Tradeoffs:** Less design tooling than Webflow/Framer; acceptable given scope.
