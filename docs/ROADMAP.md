# JobBobber Product Roadmap

**Status**: Phase 1-3 Complete — Pre-Launch
**Last Updated**: 2026-03-16
**Version**: 2.0

---

## Overview

This roadmap outlines all features planned for JobBobber across three phases: MVP (Months 1-3), Beta (Months 4-6), and Full Launch (Months 7-12). Features are organized by user type and technical domain.

**Constitutional Alignment:**

All features in this roadmap MUST comply with the [Project Constitution](../.specify/memory/constitution.md):

- ✅ Type Safety First (tRPC + Prisma + Zod validation)
- ✅ Test-Driven Development (80%+ coverage from day 1)
- ✅ BYOK Architecture (all AI features use user API keys)
- ✅ Minimal Abstractions (no LangChain/LangGraph)
- ✅ Security & Privacy (encrypted keys, private params)
- ✅ Phased Rollout with Feature Flags
- ✅ Agent Autonomy (no human intervention)

**Key Principles:**

- **Start Simple**: MVP focuses on core matching loop only
- **Iterate Fast**: Beta adds agent intelligence based on MVP learnings
- **Scale Smart**: Full launch adds enterprise features and optimization
- **Feature Flags**: Use Vercel Flags SDK to roll out features gradually
- **Constitution First**: Every feature validates against constitutional principles

---

## Phase 1: MVP (Months 1–3) ✅ COMPLETE

**Goal**: Prove the core matching loop works
**Status**: All items implemented

### Authentication & Onboarding

- [x] **User Registration**
  - Clerk integration (email, OAuth, SSO)
  - Role selection (Job Seeker vs Employer)
  - Email verification

- [x] **API Key Setup (BYOK)**
  - User provides OpenAI/Anthropic API key
  - AES-256-GCM encrypted key storage
  - Key validation before saving (live API call)
  - Masked key display for status checks

- [x] **Profile Creation Wizard**
  - Multi-step onboarding flow
  - Profile completeness score
  - Role-based routing after setup

### Job Seeker Features

- [x] **Profile Creation**
  - Basic info (name, headline, location)
  - Skills (autocomplete, multi-select)
  - Experience and education (JSON arrays)
  - Resume upload (PDF/DOCX via Vercel Blob)
  - Bio/summary (optional)
  - Portfolio URLs (structured objects)

- [x] **Profile Parsing**
  - Extract structured data from resume via AI (BYOK)
  - AI-assisted skill extraction
  - Auto-populate profile fields with user review

- [x] **Match Dashboard**
  - View all matches with confidence scores (Strong/Good/Potential)
  - Sort by match score
  - Filter by status (pending, accepted, declined)
  - Match details with AI-generated reasoning

- [x] **Match Actions**
  - View match reasoning and summaries
  - Accept match (express interest)
  - Decline match (not interested)

### Employer Features

- [x] **Company Profile**
  - Company name, description, industry, size
  - Website, logo upload, headquarters
  - Benefits and culture description

- [x] **Job Posting Creation**
  - Job title and description
  - Required and preferred skills
  - Experience level, employment type
  - Location type (remote/hybrid/onsite)
  - Salary range (optional, public)
  - Status management (draft/active/paused/closed/filled)

- [x] **Candidate Dashboard**
  - View all matched candidates per posting
  - Sort by match score
  - Filter by status and confidence
  - Candidate details (name, skills, score)

- [x] **Candidate Review**
  - View full candidate profile
  - View match reasoning
  - Accept/decline candidates
  - Confidence badge display

### AI Agent Features (Basic)

- [x] **Employer Agent Evaluation**
  - One-directional matching (employer evaluates candidates)
  - Skill matching and experience validation
  - Generate match score (0-100) with confidence mapping
  - Generate match reasoning (text explanation)
  - Anti-discrimination guardrails in prompts

- [x] **Structured Output**
  - Zod schema validation (agentEvaluationSchema)
  - Type-safe agent responses via Vercel AI SDK generateObject
  - Error handling for invalid outputs

- [x] **User Chat (Basic)**
  - Chat with personal agent
  - Ask about profile
  - Get job search advice
  - View conversation history

### Technical Infrastructure

- [x] **T3 Stack Setup**
  - Next.js 15 + React 19 (App Router)
  - tRPC 11 for API layer (18 routers)
  - Prisma 5 + NeonDB (PostgreSQL)
  - Tailwind CSS + shadcn/ui + Radix UI
  - Clerk authentication

- [x] **Type Safety Enforcement (CONSTITUTIONAL REQUIREMENT)**
  - TypeScript strict mode with noUncheckedIndexedAccess
  - tRPC end-to-end type safety
  - Prisma type generation automated
  - Zod schema validation for all external inputs
  - CI/CD type checking (zero tolerance for type errors)
  - Typed boundaries for third-party SDK mismatches

- [x] **Database Schema**
  - 16 Prisma models, 18 enums
  - JobSeeker, Employer, JobPosting, Match, AgentConversation
  - SeekerSettings, JobSettings (private, never exposed via API)
  - Subscription, StripeEvent, AuditLog, DeletionRequest

- [x] **Vercel AI SDK Integration**
  - generateObject for structured LLM output
  - BYOK provider factory (OpenAI + Anthropic)
  - Agent prompt construction with guardrails

- [x] **Inngest Workflows (Basic)**
  - Match evaluation workflow (evaluate-candidates)
  - Email notification workflow (send-match-notification)

- [x] **Feature Flags Setup**
  - Vercel Flags SDK integration
  - Feature flags for progressive rollout (AGENT_CONVERSATIONS, VECTOR_SEARCH, etc.)

- [x] **File Storage**
  - Vercel Blob for resume uploads and employer logos
  - PDF and DOCX parsing (pdf-parse, mammoth)
  - Client-upload token exchange pattern

### Testing & Quality (CONSTITUTIONAL REQUIREMENT)

- [x] **TDD Workflow Setup**
  - Vitest configuration with happy-dom/jsdom environments
  - Test scaffolding helpers
  - Mock utilities for LLM responses (deterministic)
  - Pre-commit hooks (Husky + lint-staged: prettier, eslint, vitest related)
  - CI/CD test gates via GitHub Actions

- [x] **Unit Testing Framework**
  - Agent logic tested with mocked LLM calls
  - tRPC procedures tested with caller factory
  - Database query tests
  - Utility function coverage
  - 80%+ code coverage enforced

- [x] **Integration Testing**
  - API endpoint testing
  - Inngest workflow testing
  - Database operation tests

- [x] **E2E Testing Framework**
  - Playwright setup and configuration
  - Critical user flow specs defined

### Deployment & Monitoring

- [x] **Vercel Deployment**
  - Production environment
  - Preview deployments per PR
  - Environment variables configured

- [x] **Basic Monitoring**
  - Sentry for error tracking (@sentry/nextjs)
  - Vercel Analytics for performance

---

## Phase 2: Beta (Months 4–6) ✅ COMPLETE

**Goal**: Add agent intelligence and two-way matching
**Status**: All items implemented

### Job Seeker Features (Beta)

- [x] **Private Negotiation Parameters**
  - Minimum salary requirement (private, separate DB table)
  - Salary flexibility rules (JSON)
  - Deal-breakers (private list)
  - Priorities ranking
  - Industry/company exclusions
  - Data usage opt-out

- [ ] **Advanced Chat with Tools**
  - Search jobs during conversation
  - Get profile information
  - Check match status
  - Submit applications via chat

- [ ] **Interview Scheduling**
  - Calendar integration
  - Availability sharing
  - Interview request/acceptance flow

### Employer Features (Beta)

- [x] **Private Hiring Parameters**
  - True maximum salary budget (private)
  - Minimum qualification override (JSON)
  - Willingness to train
  - Urgency level (LOW/MEDIUM/HIGH/CRITICAL)
  - Priority attributes
  - Custom agent prompt (sandboxed)

- [x] **Match Insights**
  - View agent conversation logs (read-only)
  - PII redaction in stored conversation messages
  - Per-candidate, per-posting conversation view
  - Data usage opt-out flag

### AI Agent Features (Advanced)

- [x] **Two-Way Matching**
  - Job Seeker Agent evaluates opportunities
  - Employer Agent evaluates candidates
  - Both must agree for match (bidirectional consensus)
  - Confidence score from alignment depth (6 dimensions)

- [x] **Agent Autonomy (CONSTITUTIONAL REQUIREMENT)**
  - No human approval required during agent negotiations
  - Agents make final match decisions autonomously
  - Private parameters used strategically without disclosure
  - Quiet termination on no-match (no notification)

- [x] **Agent-to-Agent Conversations**
  - Multi-turn negotiations via Inngest resumable workflows
  - 5 conversation phases (discovery/screening/deep_evaluation/negotiation/decision)
  - Minimum 3 turns before match decision
  - Conversation state persisted between turns
  - Configurable max turns (default 10)
  - Agent guardrails enforced (no fabrication, no discrimination, no private disclosure)

- [ ] **Tool Calling**
  - searchJobs tool
  - getProfile tool
  - checkMatchStatus tool
  - submitApplication tool

- [ ] **Structured Outputs (Advanced)**
  - streamObject for real-time results
  - Show partial results as generated
  - Progressive enhancement

### Technical Infrastructure (Beta)

- [x] **Inngest Workflows (Advanced)**
  - Multi-step agent negotiations (run-agent-conversation)
  - Resumable workflows with per-turn steps
  - Rate limiting via Upstash Redis
  - Error handling and retries
  - 10 Inngest functions total

- [ ] **AI Gateway Integration**
  - Route all LLM calls through gateway
  - Caching for repeated evaluations
  - Fallback providers

- [x] **Vector Search**
  - pgvector extension on NeonDB
  - Generate embeddings for profiles and job postings (OpenAI text-embedding-3-small)
  - Cosine similarity search for candidate discovery
  - Embedding regeneration on profile/posting update

- [x] **Feature Flags (Progressive Rollout)**
  - Enable agent-to-agent for beta users
  - Vercel Flags SDK for gradual rollout

---

## Phase 3: Full Launch (Months 7–12) — PARTIALLY COMPLETE

**Goal**: Scale and optimize for growth
**Status**: Core features implemented, expansion features pending

### Job Seeker Features (Full)

- [ ] **AI Resume Builder**
  - Generate optimized resume from profile
  - Multiple template options
  - Export as PDF
  - Continuous improvement based on matches

- [ ] **Salary Negotiation Assistant**
  - AI-powered salary recommendations
  - Market rate comparisons
  - Negotiation strategy suggestions

- [ ] **Skills Assessment Integration**
  - Code challenges (for engineers)
  - Skills tests (auto-validated)
  - Certification verification

- [ ] **Reference Checking**
  - Automated reference requests
  - AI-validated reference calls
  - Reference summary for employers

### Employer Features (Full)

- [x] **Team Features**
  - Multi-user access via Clerk Organizations
  - Role-based permissions (Admin/Job Poster/Viewer)
  - Team invitations with email and expiry
  - Team activity log for admins

- [x] **Custom Agent Prompts**
  - Customize agent behavior per user
  - Sandboxed prompt injection (cannot override guardrails)
  - Prompt injection detection
  - Example prompts and guidance in UI
  - Prompt stored encrypted at rest

- [x] **Advanced Analytics** (partial)
  - Candidate pipeline view across all postings
  - Per-posting metrics (conversations, in-progress, match rate)
  - Candidate comparison (side-by-side 2-4 candidates)
  - Team activity view for admins

- [ ] **Advanced Analytics** (remaining)
  - Time-to-hire tracking
  - Source quality analysis
  - Cost-per-hire reporting

- [x] **Bulk Operations**
  - Batch accept/decline matches
  - Export matched candidates to CSV
  - Advanced sorting and filtering

- [ ] **Bulk Operations** (remaining)
  - Upload multiple jobs at once (CSV/batch import)

### AI Agent Features (Full)

- [ ] **Industry-Specific Templates**
  - Tech/engineering agents
  - Healthcare agents
  - Finance agents
  - Custom templates per industry

- [x] **Multi-Provider Support** (partial)
  - OpenAI + Anthropic supported via BYOK
  - User choice of provider at key setup

- [ ] **Multi-Provider Support** (remaining)
  - Cohere support
  - Automatic fallback between providers
  - Provider comparison

- [ ] **Video Interview Analysis**
  - AI analysis of video interviews
  - Communication skills assessment
  - Technical question evaluation
  - Bias detection

### Revenue & Billing

- [x] **Subscription Tiers**
  - Job Seeker: Free (capped) and Pro ($39/month)
  - Employer: Free (1 posting), Business ($99/month), Enterprise (custom)
  - Feature flag gating enforces tier limits at API level

- [x] **Stripe Integration**
  - Stripe Checkout and Customer Portal
  - Subscription management (upgrade/downgrade)
  - Webhook event handling via Inngest (process-stripe-event)
  - Idempotent webhook processing (StripeEvent table)

- [x] **Billing Dashboard**
  - Current plan and usage metrics
  - Payment history
  - Upgrade/downgrade flows
  - No raw payment data stored (Stripe handles PCI)

### Technical Infrastructure (Full)

- [x] **Performance Optimization** (partial)
  - Database query parallelization (billing, matches routers)
  - Dynamic imports for heavy components
  - Module-level constants for stable references
  - React 18 automatic batching

- [ ] **Performance Optimization** (remaining)
  - AI Gateway caching (50%+ hit rate)
  - Edge caching

- [ ] **Advanced Monitoring**
  - PostHog product analytics
  - User behavior tracking
  - Conversion funnel analysis
  - Feature usage metrics

- [ ] **API for Integrations**
  - Public REST API
  - API keys for external apps
  - Webhooks for events
  - Rate limiting

- [ ] **Mobile Apps**
  - iOS app (React Native)
  - Android app (React Native)
  - Push notifications
  - Mobile-optimized chat

### Compliance & Security

- [x] **GDPR Compliance**
  - Data export (self-service, Article 20)
  - Right to deletion with 72-hour grace period (Article 17)
  - Cascading deletion via Inngest (execute-account-deletion)

- [x] **SOC 2 Compliance** (readiness)
  - SOC 2 Type II control mapping documented
  - Bias audit checklist (NYC Local Law 144)

- [ ] **SOC 2 Compliance** (remaining)
  - Third-party security audit
  - Penetration testing

- [x] **Advanced Security**
  - Clerk MFA enabled and encouraged
  - API key rotation supported
  - Platform-wide audit logging with IP hashing
  - Rate limiting on all endpoints (Upstash Redis, fail-open)
  - PII redaction in agent conversation logs
  - Cross-tenant data isolation (validated at query level)

---

## Long-Term Vision (Year 2+)

### Future Features (Months 13+)

- [ ] **Global Expansion**
  - EU market (GDPR-compliant)
  - APAC market
  - Multi-language support
  - Regional salary data

- [ ] **Advanced AI Features**
  - Custom model fine-tuning
  - Agent learning from feedback
  - Predictive analytics
  - Career path recommendations

- [ ] **Marketplace Features**
  - Recruiting agency partnerships
  - Headhunter marketplace
  - Training provider integrations
  - Background check services

- [ ] **Enterprise Features**
  - Custom contracts
  - Dedicated support
  - White-labeling
  - On-premise deployment option

---

## Feature Prioritization Framework

When deciding what to build next, use this framework:

### P0 (Must Have)

Features required for the product to function:

- ~~Authentication~~ ✅
- ~~Profile creation~~ ✅
- ~~Basic matching~~ ✅
- ~~Match viewing~~ ✅

### P1 (Should Have)

Features that significantly improve user experience:

- ~~Private parameters~~ ✅
- User chat (not yet built)
- ~~Two-way matching~~ ✅
- Tool calling (not yet built)

### P2 (Nice to Have)

Features that add value but aren't critical:

- ~~Custom prompts~~ ✅
- PostHog analytics
- Mobile apps
- Public API

### P3 (Future)

Features for later phases:

- Video analysis
- Global expansion
- White-labeling

---

## Changelog

### Version 2.0 (2026-03-16)

- Updated all checkboxes to reflect actual implementation state
- Marked Phase 1 and Phase 2 as complete
- Marked Phase 3 as partially complete with per-item status
- Updated feature descriptions to match what was actually built
- Added implementation details (schema names, tech choices, counts)
- Split partially-complete Phase 3 items into done/remaining sections
- Updated status from "Planning & Architecture Phase" to "Phase 1-3 Complete"
- Cross-referenced with `.specify/roadmap.md` (18 features, all delivered)

### Version 1.1 (2026-02-14)

- **BREAKING**: Moved Testing & Quality from Phase 2 to Phase 1 (MVP)
  - Rationale: Constitution requires TDD from day 1 (Principle II)
- Added Type Safety Enforcement to MVP (Constitutional Requirement - Principle I)
- Added Agent Autonomy Validation to Beta (Constitutional Requirement - Principle VII)
- Removed specific success metrics (marked as TBD)
- Added constitutional compliance references
- Clarified that all features must align with constitution

### Version 1.0 (2026-02-14)

- Initial roadmap created
- Defined MVP, Beta, and Full Launch phases
- Outlined 100+ features across all phases
- Established prioritization framework

---

**Questions or suggestions?** Open a GitHub Discussion or update this document directly.
