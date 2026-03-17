# JobBobber — Spec-Kit Implementation Roadmap

**PRD Source:** `PRD.md`
**Constitution:** `.specify/memory/constitution.md`
**Product Roadmap:** `docs/ROADMAP.md`
**Version:** 2.0
**Created:** 2026-02-22
**Updated:** 2026-03-16
**Status:** Phase 4 ready for speckit-ralph

---

## Overview

This roadmap breaks the JobBobber PRD into **37 spec-kit features** organized across five
implementation phases. Each feature is processed independently through the full
specify → clarify → plan → tasks → analyze → implement → review pipeline.

Phases 1–3 (18 features) are **complete**. Phases 4–5 (19 features) add user-facing
interactions, analytics, integrations, and expansion capabilities, ordered by
highest impact and lowest effort.

**Constitutional Alignment:**

- Type Safety First (I) — tRPC + Prisma + Zod throughout
- Test-Driven Development (II) — 80%+ coverage, TDD mandatory
- BYOK Architecture (III) — user-provided API keys, AES-256 encrypted
- Minimal Abstractions (IV) — Vercel AI SDK + direct SDKs, no LangChain
- Security & Privacy (V) — private params never exposed, RBAC enforced
- Phased Rollout with Feature Flags (VI) — Vercel Flags SDK
- Agent Autonomy (VII) — no human-in-loop until interview stage

**Total Features:** 37
**Phases:** 5 (MVP → Beta → Full Launch → Growth → Expansion)
**Critical Path (Phase 4):** 19 → 20 → 21 → 22 (chat cluster, sequential)

---

## Phase 1: MVP ✅ COMPLETE

**Goal:** Prove the core matching loop works end-to-end.

### Features

- [x] 1-foundation-infrastructure
- [x] 2-authentication-byok
- [x] 3-job-seeker-profile
- [x] 4-employer-profile-job-posting
- [x] 5-basic-ai-matching
- [x] 6-match-dashboard
- [x] 7-testing-infrastructure

---

## Phase 2: Beta ✅ COMPLETE

**Goal:** Enable full agent-to-agent interaction and private negotiation.
**Dependency:** Phase 1 complete.

### Features

- [x] 8-private-negotiation-parameters
- [x] 9-agent-to-agent-conversations
- [x] 10-two-way-matching
- [x] 11-vector-search
- [x] 12-agent-conversation-logs
- [x] 13-multi-member-employer-accounts

---

## Phase 3: Full Launch ✅ COMPLETE

**Goal:** Complete platform — billing, enterprise features, compliance, and scale.
**Dependency:** Phase 2 complete.

### Features

- [x] 14-aggregate-feedback-insights
- [x] 15-custom-agent-prompting
- [x] 16-subscription-billing
- [x] 17-advanced-employer-dashboard
- [x] 18-compliance-security

---

## Phase 4: Growth (High Impact, Low-Medium Effort)

**Goal:** User-facing AI interactions, analytics, and quick wins that maximize
platform value with minimal new infrastructure.
**Dependency:** Phase 3 complete.

### Features

- [x] 19-user-chat-basic
- [ ] 20-agent-tool-calling
- [ ] 21-advanced-chat-with-tools
- [ ] 22-streaming-structured-outputs
- [ ] 23-product-analytics
- [ ] 24-bulk-job-upload
- [ ] 25-multi-provider-fallback
- [ ] 26-ai-resume-builder
- [ ] 27-hiring-metrics
- [ ] 28-public-rest-api
- [ ] 29-industry-agent-templates

---

## Phase 5: Expansion (High Effort, External Dependencies)

**Goal:** Platform expansion requiring third-party integrations, new infrastructure,
or entirely new client applications.
**Dependency:** Phase 4 features 19–22 recommended but not required.

### Features

- [ ] 30-interview-scheduling
- [ ] 31-salary-negotiation-assistant
- [ ] 32-ai-gateway-caching
- [ ] 33-skills-assessment
- [ ] 34-reference-checking
- [ ] 35-video-interview-analysis
- [ ] 36-mobile-apps
- [ ] 37-soc2-penetration-testing

---

## Feature Descriptions

### Phase 1–3 Features

See Version 1.0 of this document (git history) for full descriptions of features 1–18.
All 18 features are complete and deployed.

---

### Phase 4 Features

#### 19-user-chat-basic

**PRD Section:** §8.1 Job Seeker Flow, §8.2 Employer Flow
**Priority:** P0
**Complexity:** Medium
**Impact/Effort:** ★★★★★ — Highest-impact missing feature; closes the gap between
"AI agents handle everything" and what users can actually interact with today.
**Description:** User-facing chat interface where seekers and employers can converse
with their personal AI agent. Uses Vercel AI SDK `useChat()` hook with BYOK key.
New chat tRPC router for message persistence. Chat agent has read access to user's
profile, matches, and conversation logs. Foundation for tool calling (Feature 20).

**Acceptance Criteria:**

- Chat UI accessible from both seeker and employer dashboards
- Messages streamed in real-time via Vercel AI SDK
- Chat agent uses BYOK key (no platform keys)
- Message history persisted and reloadable
- Agent has read-only context of user's profile and match status
- Behind `USER_CHAT` feature flag
- LLM calls mocked in all tests

#### 20-agent-tool-calling

**PRD Section:** §7.3 Tool Calling
**Priority:** P0
**Complexity:** Medium
**Dependency:** 19-user-chat-basic
**Impact/Effort:** ★★★★★ — Transforms chat from a novelty to a functional interface.
**Description:** Define callable tools for the chat agent: `searchJobs` (query active
postings by skills/location), `getProfile` (retrieve user's own profile data),
`checkMatchStatus` (list current matches with status), `getConversationLog` (read
agent-to-agent conversation summaries). Tools implemented as tRPC caller invocations
within the chat route handler. Zod schemas validate all tool inputs/outputs.

**Acceptance Criteria:**

- Minimum 4 tools defined with Zod input/output schemas
- Tools invoked by the LLM via Vercel AI SDK tool calling
- Tool results rendered inline in chat UI
- Tools respect existing RBAC (seeker tools vs employer tools)
- No tool can access another user's data
- All tool calls mocked in tests

#### 21-advanced-chat-with-tools

**PRD Section:** §8.1 (Advanced Seeker Flow), §8.2 (Advanced Employer Flow)
**Priority:** P1
**Complexity:** Small
**Dependency:** 19-user-chat-basic, 20-agent-tool-calling
**Impact/Effort:** ★★★★☆ — UX polish on existing tool infrastructure.
**Description:** Enhanced chat experience combining streaming responses with inline
tool result display. Search results shown as cards, match status as a summary table,
profile data as structured preview. Adds "suggested actions" after tool results
(e.g., "Accept this match?" after viewing match details).

**Acceptance Criteria:**

- Tool results rendered as structured UI components (not raw JSON)
- Suggested follow-up actions displayed after relevant tool calls
- Chat maintains context across tool invocations
- Responsive layout for mobile viewports

#### 22-streaming-structured-outputs

**PRD Section:** §7.1 (Agent Output)
**Priority:** P2
**Complexity:** Small
**Dependency:** 19-user-chat-basic
**Impact/Effort:** ★★★☆☆ — Enhancement to chat experience, not a new capability.
**Description:** Use Vercel AI SDK `streamObject` to progressively render structured
agent output in the chat UI. Partial results shown as they stream (e.g., match
evaluation dimensions filling in one by one). Replaces waiting for full response.

**Acceptance Criteria:**

- `streamObject` used for structured agent responses in chat
- Partial results rendered progressively in UI
- Graceful fallback if streaming fails (show full result on completion)
- No change to agent evaluation logic

#### 23-product-analytics

**PRD Section:** §10 Technology Stack (Monitoring)
**Priority:** P1
**Complexity:** Small
**Impact/Effort:** ★★★★☆ — Critical for understanding user behavior before scaling.
**Description:** Integrate PostHog for product analytics. Install `posthog-js`,
add PostHog provider to app layout, instrument key events: sign-up, profile
completion, match created, match accepted/declined, subscription started/cancelled,
chat message sent. Configure `NEXT_PUBLIC_POSTHOG_KEY` and `NEXT_PUBLIC_POSTHOG_HOST`
env vars (already defined in `src/lib/env.ts`).

**Acceptance Criteria:**

- PostHog JS SDK installed and provider mounted in app layout
- Minimum 8 events tracked (sign-up, profile complete, match created, match
  accepted, match declined, subscription started, subscription cancelled, chat sent)
- User identification linked to Clerk userId (no PII in events)
- PostHog disabled in test/development environments
- Behind `PRODUCT_ANALYTICS` feature flag

#### 24-bulk-job-upload

**PRD Section:** §6.3 Employer Profile (Bulk Operations)
**Priority:** P1
**Complexity:** Small
**Impact/Effort:** ★★★★☆ — High value for enterprise employers with many openings.
**Description:** CSV upload endpoint for employers to create multiple job postings
at once. Parse CSV, validate each row against existing `jobPostings.create` input
schema, show preview with validation errors, create postings in batch. Uses existing
job posting CRUD — no new data model.

**Acceptance Criteria:**

- CSV file upload UI in employer dashboard
- CSV parsed and validated against JobPosting Zod schema
- Preview table shows valid/invalid rows before submission
- Batch creation via existing tRPC procedure (transactional)
- Error report downloadable for invalid rows
- Maximum 100 postings per upload

#### 25-multi-provider-fallback

**PRD Section:** §10 Technology Stack (AI Infrastructure)
**Priority:** P2
**Complexity:** Small
**Impact/Effort:** ★★★☆☆ — Improves reliability; low effort since provider factory exists.
**Description:** Add Cohere as a third BYOK provider option. Implement automatic
fallback: if the user's primary provider returns an error (rate limit, outage),
try the next configured provider before failing. Requires users to optionally
configure a secondary API key. Extends existing `createProvider` factory in
`employer-agent.ts`.

**Acceptance Criteria:**

- Cohere SDK added as optional BYOK provider
- Users can configure primary and secondary API keys
- Automatic fallback on provider error (429, 500, 503)
- Fallback logged for user visibility
- No fallback to platform keys (BYOK maintained)
- Existing tests updated to cover fallback path

#### 26-ai-resume-builder

**PRD Section:** §8.1 Job Seeker Flow (Full Launch)
**Priority:** P1
**Complexity:** Medium
**Impact/Effort:** ★★★☆☆ — Unique feature that adds standalone value for seekers.
**Description:** Generate a formatted resume from the user's JobSeeker profile using
their BYOK key. LLM creates professional summary, formats experience/education,
highlights relevant skills. Render to PDF via a server-side PDF generation library.
Multiple template options (professional, modern, minimal). Users can regenerate
with different templates.

**Acceptance Criteria:**

- Resume generated from existing profile data via BYOK LLM call
- Minimum 3 template options
- PDF export downloadable from dashboard
- Resume content validated with Zod before rendering
- Regeneration supported (different template, updated profile)
- Behind `RESUME_BUILDER` feature flag

#### 27-hiring-metrics

**PRD Section:** §6.5 Employer Dashboard (Advanced Analytics)
**Priority:** P2
**Complexity:** Small
**Impact/Effort:** ★★★☆☆ — Builds on existing dashboard; mostly SQL aggregation.
**Description:** Add time-to-hire and cost-per-hire metrics to the employer dashboard.
Track timestamps: posting created → first match → mutual accept → (external: interview
scheduled). Aggregate across postings for trend analysis. Extends existing
`dashboard` tRPC router with new query procedures.

**Acceptance Criteria:**

- Time-to-first-match calculated per posting
- Time-to-mutual-accept calculated per posting
- Average metrics displayed on employer dashboard
- Trend over last 30/60/90 days
- CSV export of metrics data

#### 28-public-rest-api

**PRD Section:** §10 Technology Stack (API for Integrations)
**Priority:** P2
**Complexity:** Medium
**Impact/Effort:** ★★☆☆☆ — Important for ecosystem but not user-facing.
**Description:** Public REST API wrapping core tRPC procedures for external
integrations (ATS systems, staffing agencies). API key authentication (separate
from BYOK keys). Rate-limited endpoints for job postings, matches, and profile
data. OpenAPI spec generated from Zod schemas. Webhooks for match events.

**Acceptance Criteria:**

- REST endpoints for: list postings, get matches, get profile, webhook subscription
- API key table with creation/rotation/revocation
- Rate limiting per API key (separate from user rate limits)
- OpenAPI 3.0 spec auto-generated
- Webhook delivery for match.created, match.accepted, match.declined events
- Behind `PUBLIC_API` feature flag

#### 29-industry-agent-templates

**PRD Section:** §7.1 Agent Types (Industry Specialization)
**Priority:** P2
**Complexity:** Medium
**Impact/Effort:** ★★☆☆☆ — Technically simple but requires domain expertise per industry.
**Description:** Pre-built agent prompt templates optimized for specific industries:
technology/engineering, healthcare, finance, sales/marketing. Templates adjust
evaluation criteria, terminology, and scoring weights. Users select an industry
template or use the default generic prompt. Templates stored as versioned prompt
functions.

**Acceptance Criteria:**

- Minimum 4 industry templates defined
- Template selection in employer job posting settings
- Templates adjust agent evaluation prompts (not just system message prefix)
- Default generic template preserved as fallback
- Templates versioned and auditable
- Behind `INDUSTRY_TEMPLATES` feature flag

---

### Phase 5 Features

#### 30-interview-scheduling

**PRD Section:** §8.2 Employer Flow (Interview Stage)
**Priority:** P1
**Complexity:** Large
**External Dependency:** Google Calendar API, Microsoft Graph API
**Impact/Effort:** ★★★☆☆ — High impact but requires OAuth calendar integration.
**Description:** After mutual match acceptance, enable interview scheduling.
Calendar OAuth integration (Google Calendar + Outlook) for both parties. Agent
suggests available time slots based on overlapping availability. Interview
confirmation emails via Inngest. Timezone-aware scheduling.

**Acceptance Criteria:**

- OAuth flow for Google Calendar and Microsoft Outlook
- Available time slots computed from calendar intersection
- Interview requests sent via email with accept/decline links
- Confirmed interviews added to both parties' calendars
- Timezone display and conversion
- Behind `INTERVIEW_SCHEDULING` feature flag

#### 31-salary-negotiation-assistant

**PRD Section:** §8.1 Job Seeker Flow (Full Launch)
**Priority:** P2
**Complexity:** Large
**External Dependency:** Market salary data API (BLS, Levels.fyi, or similar)
**Impact/Effort:** ★★☆☆☆ — High value but requires external data source.
**Description:** AI-powered salary recommendations based on user's profile, location,
industry, and experience level. Market rate comparisons using external salary data.
Negotiation strategy suggestions generated via BYOK LLM call with market data context.

**Acceptance Criteria:**

- External salary data integrated (API or dataset)
- Salary recommendation based on profile + market data
- Comparison to market percentiles (25th/50th/75th/90th)
- Negotiation talking points generated by LLM
- Data refreshed periodically (weekly or monthly)
- Behind `SALARY_ASSISTANT` feature flag

#### 32-ai-gateway-caching

**PRD Section:** §10 Technology Stack (Performance Optimization)
**Priority:** P2
**Complexity:** Large
**Impact/Effort:** ★★☆☆☆ — Reduces user LLM costs but requires new infrastructure.
**Description:** Implement an LLM caching proxy to reduce redundant API calls.
Cache identical or semantically similar evaluation requests. Options: Helicone
(managed), LiteLLM (self-hosted), or custom Redis-based cache. Must maintain
BYOK key isolation — cache keyed by (user_id, prompt_hash), never sharing
responses across users.

**Acceptance Criteria:**

- LLM responses cached for identical prompts (same user)
- Cache hit rate tracked and displayed to user
- Target: 30%+ cache hit rate for repeat evaluations
- BYOK key isolation maintained (no cross-user cache sharing)
- Cache TTL configurable (default 24 hours)
- Cache invalidation on profile/posting update

#### 33-skills-assessment

**PRD Section:** §8.1 Job Seeker Flow (Skills Verification)
**Priority:** P3
**Complexity:** Large
**External Dependency:** Code execution sandbox or third-party API (HackerRank, CodeSignal)
**Impact/Effort:** ★☆☆☆☆ — High effort, requires secure sandboxing.
**Description:** Optional skills verification for job seekers. Code challenges
for engineering roles (sandboxed execution), skills quizzes for other roles
(LLM-generated and auto-graded), certification URL verification. Results
displayed as badges on seeker profile. Agent considers verified skills in matching.

**Acceptance Criteria:**

- Sandboxed code execution for engineering challenges (or third-party API)
- LLM-generated skills quizzes with auto-grading
- Verification badges displayed on profile
- Agent prompt includes verification status in evaluation
- Behind `SKILLS_ASSESSMENT` feature flag

#### 34-reference-checking

**PRD Section:** §8.2 Employer Flow (Due Diligence)
**Priority:** P3
**Complexity:** Large
**External Dependency:** Email/SMS outreach service, legal review (FCRA compliance)
**Impact/Effort:** ★☆☆☆☆ — Legal complexity outweighs technical complexity.
**Description:** Automated reference request workflow. Seeker provides reference
contacts, platform sends structured questionnaire via email. Responses aggregated
and summarized by LLM. Reference summary visible to employer after mutual match.
Requires explicit consent flow and FCRA compliance review.

**Acceptance Criteria:**

- Reference contacts provided by seeker (name, email, relationship)
- Structured questionnaire sent via email (Inngest + Resend)
- Responses collected and stored securely
- LLM-generated reference summary for employer
- Explicit consent from seeker AND reference provider
- Legal review of FCRA compliance before launch
- Behind `REFERENCE_CHECKING` feature flag

#### 35-video-interview-analysis

**PRD Section:** §7.1 Agent Types (Advanced Analysis)
**Priority:** P3
**Complexity:** Extra Large
**External Dependency:** Video hosting (Mux/S3), transcription (Whisper/Deepgram), LLM analysis
**Impact/Effort:** ★☆☆☆☆ — Entirely new infrastructure stack.
**Description:** AI analysis of recorded video interviews. Video upload/recording,
automatic transcription, LLM analysis of communication skills and technical
responses. Bias detection in evaluation. Requires video hosting, transcription
pipeline, and analysis workflow — all new infrastructure.

**Acceptance Criteria:**

- Video upload or browser-based recording
- Automatic transcription (Whisper or Deepgram)
- LLM analysis of communication quality and technical depth
- Bias detection audit on video analysis output
- Results visible to employer with seeker consent
- Behind `VIDEO_ANALYSIS` feature flag

#### 36-mobile-apps

**PRD Section:** §10 Technology Stack (Mobile)
**Priority:** P3
**Complexity:** Extra Large
**External Dependency:** App Store / Google Play submissions, push notification infra (APNs/FCM)
**Impact/Effort:** ★★☆☆☆ — Large reach but parallel maintenance burden.
**Description:** Native mobile apps for iOS and Android using React Native (or
Expo). Core screens: dashboard, matches, chat, profile, settings. Push notifications
for match events. Shares API layer with web app (tRPC or public REST API).

**Acceptance Criteria:**

- iOS and Android apps published to app stores
- Core screens: dashboard, matches, chat, profile, notifications
- Push notifications for match created, mutual accept, chat messages
- Biometric authentication (Face ID / fingerprint)
- Offline support for viewing cached matches
- Shares backend with web app

#### 37-soc2-penetration-testing

**PRD Section:** §14 Security, Privacy & Compliance
**Priority:** P1
**Complexity:** Medium (procurement, not code)
**External Dependency:** Third-party security firm
**Impact/Effort:** ★★★☆☆ — Required for enterprise sales. Not code work.
**Description:** Engage a third-party security firm to perform SOC 2 Type II audit
and penetration testing. Remediate critical and high findings. Update
`docs/soc2-control-mapping.md` with audit results. Provides enterprise customers
with compliance assurance.

**Acceptance Criteria:**

- Third-party penetration test completed
- All critical findings remediated
- All high findings remediated or documented with timeline
- SOC 2 Type II audit report obtained
- `docs/soc2-control-mapping.md` updated with audit results
- Compliance badge/documentation available for enterprise prospects

---

## Dependency Graph

```
Phase 1–3: COMPLETE (features 1–18)
All Phase 4–5 features depend on Phase 3 completion.

Phase 4 (sequential chat cluster):
19-user-chat-basic
  └─ blocks: 20, 21, 22
20-agent-tool-calling
  └─ blocks: 21
21-advanced-chat-with-tools ──── (requires 19, 20)
22-streaming-structured-outputs ─ (requires 19)

Phase 4 (parallel — no internal dependencies):
23-product-analytics ──────────── (parallel)
24-bulk-job-upload ────────────── (parallel)
25-multi-provider-fallback ────── (parallel)
26-ai-resume-builder ──────────── (parallel)
27-hiring-metrics ─────────────── (parallel)
28-public-rest-api ────────────── (parallel)
29-industry-agent-templates ───── (parallel)

Phase 5 (independent — external dependencies):
30-interview-scheduling ───────── (parallel, external: Calendar APIs)
31-salary-negotiation-assistant ── (parallel, external: salary data API)
32-ai-gateway-caching ─────────── (parallel, new infra)
33-skills-assessment ──────────── (parallel, external: code sandbox)
34-reference-checking ─────────── (parallel, external: legal review)
35-video-interview-analysis ───── (parallel, external: video infra)
36-mobile-apps ────────────────── (parallel, external: app stores)
37-soc2-penetration-testing ───── (parallel, external: security firm)
```

---

## Risk Register

### Phase 1–3 Risks (historical)

| Feature                        | Risk                            | Mitigation                                                      |
| ------------------------------ | ------------------------------- | --------------------------------------------------------------- |
| 5-basic-ai-matching            | LLM cost at scale               | BYOK; optimize prompt length; cache repeated evaluations        |
| 9-agent-to-agent-conversations | Private data leakage via agents | Strict sandboxing; red-team testing; agent output filtering     |
| 9-agent-to-agent-conversations | Conversation depth limits       | Inngest resumable workflows; configurable max turns             |
| 10-two-way-matching            | Poor match quality              | Human feedback loops on outcomes; A/B test agent strategies     |
| 14-aggregate-feedback-insights | Inadvertent disclosure          | Aggregate only; minimum N conversations before insights shown   |
| 15-custom-agent-prompting      | Adversarial prompt injection    | Sandbox execution; content filtering; injection detection       |
| 18-compliance-security         | EEOC bias in matching           | Regular bias audits; diverse test cases; third-party assessment |

### Phase 4–5 Risks

| Feature                         | Risk                                  | Mitigation                                                    |
| ------------------------------- | ------------------------------------- | ------------------------------------------------------------- |
| 19-user-chat-basic              | Chat used to extract private params   | Agent prompt excludes private data from chat context          |
| 20-agent-tool-calling           | Tool abuse (excessive API calls)      | Rate limit tool invocations per user session                  |
| 25-multi-provider-fallback      | Inconsistent results across providers | Normalize output via Zod schema regardless of provider        |
| 28-public-rest-api              | API key leakage / abuse               | Rate limiting, key rotation, usage monitoring                 |
| 30-interview-scheduling         | Calendar OAuth token management       | Encrypted token storage, refresh flow, revocation support     |
| 31-salary-negotiation-assistant | Inaccurate salary data                | Multiple data sources, display confidence ranges, disclaimers |
| 33-skills-assessment            | Code execution sandbox escape         | Use third-party sandbox service, no self-hosted execution     |
| 34-reference-checking           | FCRA compliance violations            | Legal review required before launch; consent-first design     |
| 35-video-interview-analysis     | Bias in video-based evaluation        | Transcript-only analysis option, bias audit framework         |
| 36-mobile-apps                  | Maintenance burden of 3 clients       | Shared API layer, maximum code reuse via React Native         |

---

## Feature Status

<!-- Machine-readable section parsed by speckit-ralph roadmap_tracker.sh -->
<!-- Format: - [ ] N-feature-name Px  (Px = P0/P1/P2/P3) -->

- [x] 1-foundation-infrastructure P0
- [x] 2-authentication-byok P0
- [x] 3-job-seeker-profile P0
- [x] 4-employer-profile-job-posting P0
- [x] 5-basic-ai-matching P0
- [x] 6-match-dashboard P1
- [x] 7-testing-infrastructure P0
- [x] 8-private-negotiation-parameters P1
- [x] 9-agent-to-agent-conversations P0
- [x] 10-two-way-matching P0
- [x] 11-vector-search P1
- [x] 12-agent-conversation-logs P1
- [x] 13-multi-member-employer-accounts P1
- [x] 14-aggregate-feedback-insights P1
- [x] 15-custom-agent-prompting P2
- [x] 16-subscription-billing P0
- [x] 17-advanced-employer-dashboard P2
- [x] 18-compliance-security P1
- [x] 19-user-chat-basic P0
- [ ] 20-agent-tool-calling P0
- [ ] 21-advanced-chat-with-tools P1
- [ ] 22-streaming-structured-outputs P2
- [ ] 23-product-analytics P1
- [ ] 24-bulk-job-upload P1
- [ ] 25-multi-provider-fallback P2
- [ ] 26-ai-resume-builder P1
- [ ] 27-hiring-metrics P2
- [ ] 28-public-rest-api P2
- [ ] 29-industry-agent-templates P2
- [ ] 30-interview-scheduling P1
- [ ] 31-salary-negotiation-assistant P2
- [ ] 32-ai-gateway-caching P2
- [ ] 33-skills-assessment P3
- [ ] 34-reference-checking P3
- [ ] 35-video-interview-analysis P3
- [ ] 36-mobile-apps P3
- [ ] 37-soc2-penetration-testing P1

---

## Execution Checklist

### Pre-Implementation Gates

- [x] PRD reviewed and approved (v1.1)
- [x] Constitution ratified (v1.0.0)
- [x] Tech stack locked (see constitution §Technical Constraints)
- [x] Features extracted and numbered (37 features)
- [x] Dependencies mapped

### Phase 1 Gate ✅ PASSED

- [x] All 7 MVP features complete and deployed
- [x] 80%+ test coverage achieved
- [x] Zero TypeScript errors in CI
- [x] Core matching loop demonstrated end-to-end

### Phase 2 Gate ✅ PASSED

- [x] All 6 Beta features complete
- [x] Agent-to-agent conversations functional
- [x] Two-way matching operational

### Phase 3 Gate ✅ PASSED

- [x] All 5 Full Launch features complete
- [x] Billing system integrated with Stripe
- [x] GDPR/CCPA compliance infrastructure built
- [x] SOC 2 readiness documentation complete

### Phase 4 Gate (before Phase 5 begins)

- [ ] Chat cluster complete (19, 20, 21)
- [ ] Product analytics operational (23)
- [ ] At least 3 additional Phase 4 features complete
- [ ] User feedback incorporated from chat feature

### Phase 5 Gate (expansion readiness)

- [ ] SOC 2 audit complete (37)
- [ ] Public API stable (28)
- [ ] At least 2 Phase 5 features complete

---

_This roadmap is the authoritative source for speckit-ralph feature processing.
Human-readable product roadmap: `docs/ROADMAP.md`_
