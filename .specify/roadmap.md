# JobBobber — Spec-Kit Implementation Roadmap

**PRD Source:** `PRD.md`
**Constitution:** `.specify/memory/constitution.md`
**Product Roadmap:** `docs/ROADMAP.md`
**Version:** 1.0
**Created:** 2026-02-22
**Status:** Ready for speckit-ralph

---

## Overview

This roadmap breaks the JobBobber PRD into **18 spec-kit features** organized across three
implementation phases. Each feature is processed independently through the full
specify → clarify → plan → tasks → analyze → implement → review pipeline.

**Constitutional Alignment:**

- Type Safety First (I) — tRPC + Prisma + Zod throughout
- Test-Driven Development (II) — 80%+ coverage, TDD mandatory
- BYOK Architecture (III) — user-provided API keys, AES-256 encrypted
- Minimal Abstractions (IV) — Vercel AI SDK + direct SDKs, no LangChain
- Security & Privacy (V) — private params never exposed, RBAC enforced
- Phased Rollout with Feature Flags (VI) — Vercel Flags SDK
- Agent Autonomy (VII) — no human-in-loop until interview stage

**Total Features:** 18
**Phases:** 3 (MVP → Beta → Full Launch)
**Critical Path:** 1 → 2 → 3 + 4 → 5 → 6 (parallel with 7)

---

## Phase 1: MVP (Months 1–3)

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

## Phase 2: Beta (Months 4–6)

**Goal:** Enable full agent-to-agent interaction and private negotiation.
**Dependency:** Phase 1 complete.

### Features

- [x] 8-private-negotiation-parameters
- [x] 9-agent-to-agent-conversations
- [x] 10-two-way-matching
- [x] 11-vector-search
- [x] 12-agent-conversation-logs
- [ ] 13-multi-member-employer-accounts

---

## Phase 3: Full Launch (Months 7–12)

**Goal:** Complete platform — billing, enterprise features, compliance, and scale.
**Dependency:** Phase 2 complete.

### Features

- [ ] 14-aggregate-feedback-insights
- [ ] 15-custom-agent-prompting
- [ ] 16-subscription-billing
- [ ] 17-advanced-employer-dashboard
- [ ] 18-compliance-security

---

## Feature Descriptions

### Phase 1 Features

#### 1-foundation-infrastructure

**PRD Section:** §10 Technology Stack, §11 Phase 1 MVP
**Priority:** P0
**Complexity:** Medium
**Description:** Bootstrap the full T3 stack — Next.js 15, React 19, tRPC 11, Prisma 5,
NeonDB (PostgreSQL), Tailwind CSS + shadcn/ui, Clerk, Inngest, Vercel Flags SDK. Configure
TypeScript strict mode, ESLint, Prettier, Vitest, and CI/CD pipeline. Establish the
Prisma database schema for all core entities (JobSeeker, Employer, JobPosting, AgentConversation,
Match, FeedbackInsights). Deploy to Vercel with preview-per-PR.

**Acceptance Criteria:**

- `pnpm dev` runs without errors
- `pnpm build` succeeds (zero TypeScript errors)
- Database schema migrated and seeded
- Vercel preview deployment working
- All MVP feature flags initialized to OFF

#### 2-authentication-byok

**PRD Section:** §6.1 Authentication & User Management, §Constitution III (BYOK)
**Priority:** P0
**Complexity:** Medium
**Description:** Clerk-based authentication with role selection (Job Seeker vs Employer) at
sign-up. BYOK API key setup flow: user provides OpenAI or Anthropic API key, system validates
it against the provider, encrypts it with AES-256 using a user-scoped key, and stores it.
Display estimated cost range. No platform fallback keys allowed.

**Acceptance Criteria:**

- Job seekers and employers can register and sign in via Clerk
- Role persisted and enforced in tRPC protected procedures
- API key validated before saving (live API call)
- API key encrypted at rest with user-scoped AES-256
- API key never appears in logs, API responses, or client state
- Key can be rotated or deleted by the user

#### 3-job-seeker-profile

**PRD Section:** §6.2 Job Seeker Profile, §8.1 Job Seeker Flow
**Priority:** P0
**Complexity:** Medium
**Description:** Multi-step profile creation wizard: basic info, experience, education,
skills (autocomplete), portfolio URLs, location and relocation preferences. Resume upload
(PDF/DOCX via Vercel Blob) with AI-assisted field extraction using the user's BYOK key.
Profile completeness score displayed to the user.

**Acceptance Criteria:**

- Job seeker can create and update a complete profile
- Resume uploads to Vercel Blob, parsing extracts structured fields
- Profile completeness score calculated and displayed
- All structured fields type-safe (Prisma + tRPC + Zod)
- Private settings schema exists (minSalary, dealBreakers, priorities, exclusions)
  but is hidden behind Beta feature flag

#### 4-employer-profile-job-posting

**PRD Section:** §6.3 Employer Profile, §8.2 Employer Flow
**Priority:** P0
**Complexity:** Medium
**Description:** Employer company profile (name, description, industry, size, culture, URLs,
benefits) and single-job-posting creation for MVP (title, description, required skills,
experience level, employment type, location, public salary range, "why apply"). Job posting
status management (draft → active → paused → closed → filled).

**Acceptance Criteria:**

- Employer can create and update company profile
- Employer can create, edit, and manage a job posting
- Job posting status transitions enforced
- Private job settings schema exists (truMaxSalary, willingToTrain, urgency)
  but hidden behind Beta feature flag
- All data type-safe end-to-end

#### 5-basic-ai-matching

**PRD Section:** §7.1 Agent Types (Employer Agent), §11 Phase 1 MVP
**Priority:** P0
**Complexity:** Large
**Description:** One-directional matching: the Employer Agent evaluates job seeker profiles
against a job posting. Uses user's BYOK key via Vercel AI SDK. Agent generates a match score
(0–100) and match reasoning (text) using structured output validated with Zod. Matching
triggered via Inngest workflow. No agent-to-agent conversation in MVP — employer agent
evaluates static profiles only.

**Acceptance Criteria:**

- Inngest workflow fires when employer activates a job posting
- Employer agent evaluates all candidate profiles for the posting
- Match score and reasoning generated and stored
- Zod schema validates all agent output (no storing invalid LLM output)
- BYOK key used exclusively (no platform keys)
- LLM calls mocked in all tests (no real API calls in test suite)
- Agent respects ethical guardrails (no discrimination on protected characteristics)

#### 6-match-dashboard

**PRD Section:** §6.5 Dashboard & Notifications, §6.6 Match Delivery
**Priority:** P1
**Complexity:** Medium
**Description:** Job seeker dashboard: view matches sorted by score, filter by status
(pending/accepted/declined), view match reasoning, accept or decline. Employer dashboard:
view matched candidates sorted by score, view full candidate profile, accept/reject/request
more info. Match notification system (email via Inngest). When both parties accept a match,
employer receives job seeker contact info and availability.

**Acceptance Criteria:**

- Job seeker can view, sort, and filter their matches
- Employer can view, sort, and filter matched candidates
- Accept/decline actions update match status atomically
- When both accept: employer receives contact info (job seeker's consent required)
- Email notifications sent via Inngest on match creation and status change
- Confidence score (Strong/Good/Potential) displayed on each match card

#### 7-testing-infrastructure

**PRD Section:** §Constitution II (TDD), Roadmap Testing & Quality
**Priority:** P0 (Constitutional Requirement)
**Complexity:** Small
**Description:** Establish the full testing infrastructure: Vitest configuration, test
scaffolding helpers, LLM mock utilities (deterministic mocked responses for all agent tests),
pre-commit hooks, and CI/CD test gates. Playwright E2E setup with critical flow coverage
(auth, profile creation, matching, match acceptance). 80%+ coverage enforced as a
non-negotiable gate.

**Acceptance Criteria:**

- `pnpm test` runs all unit + integration tests
- `pnpm test:e2e` runs Playwright tests against local dev server
- Coverage report generated; CI fails if below 80%
- LLM mock utility returns deterministic responses for given inputs
- Pre-commit hook prevents commits with failing tests
- All CI gates pass before merge to main

---

### Phase 2 Features

#### 8-private-negotiation-parameters

**PRD Section:** §6.2 (Private Settings), §6.3 (Private Job Settings)
**Priority:** P1
**Complexity:** Medium
**Description:** Job seeker private settings UI: minimum salary, salary flexibility rules,
deal-breakers, priorities ranking, industry/company exclusions. Employer private job settings
UI: true maximum salary, minimum qualification override, training willingness, urgency,
priority attributes. Data stored in separate private tables, never exposed via public API,
accessed only by the user's own agent.

**Acceptance Criteria:**

- Private settings saved separately from public profile (separate DB tables)
- Private settings never appear in any tRPC response accessible to other users
- Agent reads private settings only via server-side agent context
- Behind `PRIVATE_PARAMS` feature flag (Beta rollout)
- Full test coverage of privacy boundary enforcement

#### 9-agent-to-agent-conversations

**PRD Section:** §7.2 Agent-to-Agent Interaction Model
**Priority:** P0
**Complexity:** Large
**Description:** Full multi-turn automated dialogue between Employer Agent and Job Seeker
Agent via Inngest resumable workflows. Conversation flow: discovery → initial screening →
deep evaluation → negotiation alignment → match decision. Agents use private parameters
strategically without disclosing exact values. All conversations logged to AgentConversation
table. No human intervention until match is surfaced.

**Acceptance Criteria:**

- Inngest workflow handles full conversation lifecycle (resumable, no timeout)
- Employer Agent initiates; Job Seeker Agent responds
- Multi-turn evaluation (minimum 3 turns before match decision)
- Private params used without disclosure of exact figures
- Conversation state persisted between turns (resume after interruption)
- Both agents can reach no-match conclusion (quiet termination, no notification)
- Agent guardrails enforced: no fabrication, no discrimination, no private disclosure
- All agent calls mocked in tests

#### 10-two-way-matching

**PRD Section:** §7.2 (Match Decision), §Constitution VII (Agent Autonomy)
**Priority:** P0
**Complexity:** Medium
**Description:** Bidirectional consensus matching — both Employer Agent and Job Seeker Agent
must independently determine sufficient alignment before a match is surfaced. Builds on
agent-to-agent conversations. Adds Job Seeker Agent's active evaluation of opportunities
against private preferences. Match only generated when both agents agree.

**Acceptance Criteria:**

- Job Seeker Agent evaluates job opportunities against private preferences
- Match generated only when both agents signal consensus
- Confidence score (Strong/Good/Potential) calculated from alignment depth
- Match summary AI-generated and explains both-sided alignment
- Unilateral no-match is silent (no notification to either party)
- Agent autonomy fully respected (no human approval mid-negotiation)

#### 11-vector-search

**PRD Section:** §10 Technology Stack (pgvector), §7.4 Profile Validation
**Priority:** P1
**Complexity:** Medium
**Description:** Enable semantic profile-to-job matching using pgvector (NeonDB extension).
Generate embeddings for job seeker profiles and job postings using user's BYOK key.
Employer Agent uses vector similarity search to build initial candidate shortlist before
initiating conversations. Semantic search replaces naive keyword filtering.

**Acceptance Criteria:**

- pgvector extension enabled on NeonDB
- Profile and job posting embeddings generated and stored on create/update
- Employer Agent uses cosine similarity search for initial candidate discovery
- Embedding regenerated on profile or job posting update
- Search results ranked by similarity; top-N returned for agent evaluation
- BYOK key used for embedding generation (OpenAI or Anthropic embeddings)

#### 12-agent-conversation-logs

**PRD Section:** §6.5 Dashboard (conversation logs), §14 Agent Conversation Data
**Priority:** P1
**Complexity:** Small
**Description:** Transparency feature — users can read the full logs of conversations their
agent participated in. Read-only view in the dashboard. Private parameters and exact figures
never shown in logs (redacted at storage time). Users can opt out of their conversation data
being used for model improvement.

**Acceptance Criteria:**

- Conversation messages stored in AgentConversation.messages[] field
- Job seeker can view conversations their agent participated in
- Employer can view conversations per candidate per job posting
- Private parameter values redacted before storage (pattern-matched and removed)
- Data usage opt-out flag stored and respected
- Behind `CONVERSATION_LOGS` feature flag

#### 13-multi-member-employer-accounts

**PRD Section:** §6.3 (EmployerMember), §6.1 (Role Management)
**Priority:** P1
**Complexity:** Medium
**Description:** Multi-user employer accounts with role-based access control via Clerk
Organizations. Roles: Admin (full access, invite/remove members), Job Poster (create/manage
postings), Viewer (read-only). Admin can invite team members by email. Role enforced at API
level via tRPC protected procedures.

**Acceptance Criteria:**

- Clerk Organizations used for employer multi-tenancy
- Admin can invite, remove, and assign roles to team members
- tRPC procedures enforce role-based access for all employer operations
- Team activity visible to admins (who posted/reviewed what)
- Invitation emails sent via Inngest + Clerk webhook
- Single-user employer accounts from MVP still supported

---

### Phase 3 Features

#### 14-aggregate-feedback-insights

**PRD Section:** §7.2.1 Aggregate Feedback Insights, §6.5 Dashboard
**Priority:** P1
**Complexity:** Large
**Description:** Private AI-generated feedback visible only to the user in their dashboard.
For job seekers: what makes them attractive, what patterns cause rejections, trends over time.
For employers: what makes their posting attractive, what causes candidates to decline.
Derived from aggregated conversation outcomes — never exposes individual conversation details
or the identity of the other party. FeedbackInsights entity regenerated periodically by Inngest.

**Acceptance Criteria:**

- FeedbackInsights generated from aggregated conversation outcomes (not individual disclosures)
- Insights visible only to the profile owner (private API endpoint)
- No individual rejection details or opposing party identity revealed
- Trend direction (improving/declining/stable) displayed with metrics
- Regenerated by Inngest on a schedule (or after N new conversations)
- Content validated with Zod before storage
- Behind `FEEDBACK_INSIGHTS` feature flag

#### 15-custom-agent-prompting

**PRD Section:** §6.4 Custom Agent Prompting
**Priority:** P2
**Complexity:** Medium
**Description:** Advanced feature allowing users to write a custom prompt that influences
their agent's behavior during agent-to-agent interactions. Prompt is sandboxed — cannot
override core agent policies, ethical guardrails, or matching rules. Platform provides
example prompts and guidance. Prompt quality is itself a soft signal of user capability.
Prompt injection detection required.

**Acceptance Criteria:**

- Custom prompt input available in profile settings (both user types)
- Prompt injected into agent context within a sandboxed section
- Core guardrails cannot be overridden by custom prompt
- Prompt injection / adversarial content detection applied before use
- Example prompts and guidance shown in UI
- Prompt stored encrypted at rest
- Behind `CUSTOM_PROMPTS` feature flag

#### 16-subscription-billing

**PRD Section:** §12 Revenue Model
**Priority:** P0
**Complexity:** Large
**Description:** Full Stripe subscription billing for all tiers. Job Seeker: Free (capped agent
activity) and Pro ($39/mo — unlimited activity, full features). Employer: Free (1 posting, capped),
Business ($99/mo — multi-posting, unlimited), Enterprise (custom). Feature flag gating enforces
tier limits. Billing dashboard shows current plan, usage, and payment history. Stripe webhooks
handled via Inngest.

**Acceptance Criteria:**

- Stripe Checkout and Customer Portal integrated
- Subscription tiers enforce feature flag access
- Inngest handles Stripe webhook events (payment, cancellation, upgrade, downgrade)
- Billing dashboard shows current plan, usage metrics, and payment history
- Free tier limits enforced at API level (not just UI)
- Upgrade/downgrade flows work correctly
- No raw payment data stored (Stripe handles PCI compliance)
- Introductory beta pricing supported via Stripe coupons

#### 17-advanced-employer-dashboard

**PRD Section:** §6.5 Employer Dashboard, §11 Phase 3
**Priority:** P2
**Complexity:** Medium
**Description:** Enhanced employer experience: pipeline view across all job postings,
candidate comparison tool for side-by-side evaluation of matched candidates, bulk operations
(batch accept/reject, export to CSV), advanced sorting and filtering, per-job-posting metrics
(conversations, in-progress, match rate). Team activity view for admins.

**Acceptance Criteria:**

- Pipeline view shows all active job postings with match counts and status
- Candidate comparison: side-by-side view of 2–4 candidates with match details
- Bulk actions: batch status updates, CSV export of matched candidates
- Job posting metrics displayed (total conversations, in-progress, match %)
- Filters: by status, experience level, location type, match confidence
- Admin sees team activity log

#### 18-compliance-security

**PRD Section:** §14 Security, Privacy & Compliance
**Priority:** P1
**Complexity:** Large
**Description:** Regulatory compliance and security hardening: GDPR data export and right-to-
deletion (including all agent conversation data), CCPA disclosure and deletion rights, full
audit logging for sensitive operations, two-factor authentication (Clerk MFA), API rate limiting
and abuse detection, DDoS protection, penetration testing prep. Bias audit framework for
agent matching (EEOC compliance). SOC 2 preparation documentation.

**Acceptance Criteria:**

- Users can export all their data (GDPR Article 20) via self-service
- Users can delete all their data (GDPR Article 17 / CCPA); cascading deletion confirmed
- Audit log captures all sensitive operations (profile access, key rotation, match decisions)
- Clerk MFA enabled and encouraged for all users
- Rate limiting applied to all public-facing API endpoints
- Bias audit checklist documented and run against agent evaluation logic
- SOC 2 control mapping documented (readiness for audit)
- Penetration test performed by third party; critical findings resolved

---

## Dependency Graph

```
1-foundation-infrastructure
  └─ blocks: 2, 3, 4, 5, 6, 7

2-authentication-byok
  └─ blocks: 3, 4, 5

3-job-seeker-profile ──────────────┐
4-employer-profile-job-posting ────┤
  └─ both block: 5                 │
                                   ▼
5-basic-ai-matching ──── blocks: 6, 9, 10
6-match-dashboard ────── blocks: 14, 17
7-testing-infrastructure ─ (parallel with 3–6, gates all CI)

Phase 1 complete → Phase 2:
8-private-negotiation-parameters ── blocks: 9, 10
9-agent-to-agent-conversations ──── blocks: 10, 12, 14
10-two-way-matching ─────────────── blocks: 14
11-vector-search ────────────────── (parallel with 9–10)
12-agent-conversation-logs ─────────(parallel with 13)
13-multi-member-employer-accounts ──(parallel with 9–12)

Phase 2 complete → Phase 3:
14-aggregate-feedback-insights ─────(requires 9, 10)
15-custom-agent-prompting ───────────(parallel)
16-subscription-billing ────────────(parallel, requires 2)
17-advanced-employer-dashboard ─────(requires 6, 13)
18-compliance-security ─────────────(parallel, final gate)
```

---

## Risk Register

| Feature                        | Risk                            | Mitigation                                                      |
| ------------------------------ | ------------------------------- | --------------------------------------------------------------- |
| 5-basic-ai-matching            | LLM cost at scale               | BYOK; optimize prompt length; cache repeated evaluations        |
| 9-agent-to-agent-conversations | Private data leakage via agents | Strict sandboxing; red-team testing; agent output filtering     |
| 9-agent-to-agent-conversations | Conversation depth limits       | Inngest resumable workflows; configurable max turns             |
| 10-two-way-matching            | Poor match quality              | Human feedback loops on outcomes; A/B test agent strategies     |
| 14-aggregate-feedback-insights | Inadvertent disclosure          | Aggregate only; minimum N conversations before insights shown   |
| 15-custom-agent-prompting      | Adversarial prompt injection    | Sandbox execution; content filtering; injection detection       |
| 18-compliance-security         | EEOC bias in matching           | Regular bias audits; diverse test cases; third-party assessment |

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
- [ ] 16-subscription-billing P0
- [ ] 17-advanced-employer-dashboard P2
- [ ] 18-compliance-security P1

---

## Execution Checklist

### Pre-Implementation Gates

- [x] PRD reviewed and approved (v1.1)
- [x] Constitution ratified (v1.0.0)
- [x] Tech stack locked (see constitution §Technical Constraints)
- [x] Features extracted and numbered (18 features)
- [x] Dependencies mapped
- [ ] First feature spec started (`/speckit-specify 1-foundation-infrastructure`)

### Phase 1 Gate (before Phase 2 begins)

- [ ] All 7 MVP features complete and deployed to production
- [ ] 80%+ test coverage achieved across all MVP code
- [ ] Zero TypeScript errors in CI
- [ ] Vercel preview deployments passing for all PRs
- [ ] Core matching loop demonstrated end-to-end

### Phase 2 Gate (before Phase 3 begins)

- [ ] All 6 Beta features complete
- [ ] Agent-to-agent conversations stable in production
- [ ] Two-way matching producing quality results
- [ ] Beta user feedback incorporated

### Phase 3 Gate (launch readiness)

- [ ] All 5 Full Launch features complete
- [ ] GDPR/CCPA compliance verified by legal review
- [ ] Penetration test complete, critical findings resolved
- [ ] Billing system tested end-to-end with real Stripe keys
- [ ] SOC 2 readiness documentation complete

---

_This roadmap is the authoritative source for speckit-ralph feature processing.
Human-readable product roadmap: `docs/ROADMAP.md`_
