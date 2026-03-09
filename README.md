# JobBobber — AI-Powered Talent Matching Platform

> Autonomous AI agents connecting job seekers with employers — eliminating the manual grind of job searching and applicant screening.

[![License](https://img.shields.io/badge/license-MIT-blue)]()
[![Status](https://img.shields.io/badge/status-all%20features%20implemented-brightgreen)]()

## Executive Summary

**The Problem:** Job seekers spend 20-40+ hours/week applying to hundreds of jobs. Employers spend thousands of hours screening unqualified applicants. LinkedIn has devolved into a noisy social feed where genuine talent is hard to identify.

**Our Solution:** JobBobber uses AI agents that autonomously handle the entire matching process. Job seekers and employers each have their own AI agent that negotiates on their behalf — no manual applications, no resume screening, just interview-ready matches.

**Business Model:** Subscription platform ($0-$99/month) where users bring their own LLM API keys (OpenAI/Anthropic). JobBobber has **zero AI infrastructure costs** while users pay only for what they use (~$10-50/month to their LLM provider).

## Overview

JobBobber is a next-generation talent matching platform that leverages AI agents to autonomously connect job seekers with employer opportunities. Unlike traditional professional networks, JobBobber replaces the manual, noise-heavy experience with a streamlined, AI-first approach: humans provide their information, and AI agents handle the screening, negotiation, and matching — delivering a shortlist of interview-ready candidates to employers and interview-ready opportunities to job seekers.

**Status:** All 18 features implemented across 3 phases (MVP, Beta, Full Launch). See [Implementation Status](#implementation-status) for details.

## Technology Stack

### Frontend

- **Framework**: Next.js 15 (React 19, App Router)
- **API Layer**: tRPC 11 (end-to-end type safety)
- **Styling**: Tailwind CSS + shadcn/ui + Radix UI
- **State Management**: React Context + tRPC cache

### Backend

- **Runtime**: Node.js 20+
- **Framework**: Next.js API Routes (tRPC)
- **Language**: TypeScript (strict mode)
- **Workflow Engine**: Inngest (long-running agent conversations, scheduled jobs)

### Database & Storage

- **Primary Database**: PostgreSQL (NeonDB serverless)
- **ORM**: Prisma (type-safe queries + migrations)
- **Vector Database**: pgvector (NeonDB extension, cosine similarity)
- **File Storage**: Vercel Blob Storage (resumes)

### AI & Agent Infrastructure

- **Runtime AI**: User-provided API keys (BYOK — OpenAI, Anthropic, or Cohere)
- **Agent Framework**: Vercel AI SDK + custom orchestration
- **Agent Orchestration**: Inngest (resumable multi-turn workflows)
- **Embeddings**: User's choice (OpenAI, Cohere, or Voyage AI) via pgvector
- **Structured Outputs**: Zod validation + AI SDK `streamObject`

### Infrastructure

- **Authentication**: Clerk (organizations, teams, RBAC)
- **Billing**: Stripe (subscriptions, webhooks via Inngest)
- **Feature Flags**: Vercel Flags SDK
- **Hosting**: Vercel
- **Rate Limiting**: Upstash Redis (fail-open design)
- **Monitoring**: Sentry + Vercel Analytics

### Testing & Development

- **Unit/Integration Testing**: Vitest (80%+ coverage target)
- **E2E Testing**: Playwright
- **Package Manager**: pnpm
- **Linting**: ESLint + TypeScript strict mode
- **Formatting**: Prettier
- **Git Hooks**: Husky + lint-staged
- **CI/CD**: GitHub Actions + Vercel deployment

## Architecture

### High-Level Overview

```
┌──────────────────────────────────────────────────────────────┐
│                       Vercel Platform                         │
│                                                              │
│  ┌────────────────┐         ┌────────────────────────────┐   │
│  │   Next.js App  │         │      tRPC API (18 routers) │   │
│  │  (React 19)    │ ◄─────► │  Type-safe end-to-end      │   │
│  │                │         │                            │   │
│  │  • Dashboards  │         │  • Profile CRUD            │   │
│  │  • Profiles    │         │  • Match management        │   │
│  │  • Billing     │         │  • Billing & subscriptions │   │
│  │  • Compliance  │         │  • Compliance & audit      │   │
│  └────────────────┘         └────────────┬───────────────┘   │
│                                          │                    │
└──────────────────────────────────────────┼────────────────────┘
                                           │
           ┌───────────────────────────────┼────────────────────────┐
           │                               │                        │
  ┌────────▼─────────┐   ┌────────────────▼────────┐   ┌──────────▼──────┐
  │   NeonDB         │   │      Inngest            │   │    Clerk        │
  │   (PostgreSQL)   │   │   (10 functions)        │   │    (Auth)       │
  │                  │   │                         │   │                 │
  │ • 16 models      │   │ • Agent conversations   │   │ • Multi-tenant  │
  │ • 18 enums       │   │ • Match evaluation      │   │ • RBAC          │
  │ • pgvector       │   │ • Billing webhooks      │   │ • Orgs/Teams    │
  └──────────────────┘   │ • Feedback insights     │   └─────────────────┘
                         │ • Account deletion      │
                         └────────────┬────────────┘
                                      │
                            ┌─────────▼──────────┐
                            │   User's LLM API   │
                            │   (BYOK)           │
                            │                    │
                            │ • OpenAI / Anthropic│
                            │ • Embeddings       │
                            │ • Agent evaluation │
                            └────────────────────┘
```

### Directory Structure

```
src/
├── app/                          # Next.js App Router (23 pages)
│   ├── (auth)/                   # Sign-in / sign-up (Clerk)
│   ├── (employer)/               # Employer routes
│   │   ├── dashboard/            # Dashboard, billing, conversations, team
│   │   ├── postings/             # Job posting CRUD, matches, settings
│   │   ├── profile/              # Employer profile editing
│   │   └── settings/compliance/  # GDPR export, deletion, MFA
│   ├── (seeker)/                 # Job seeker routes
│   │   ├── conversations/        # Agent conversation logs
│   │   ├── matches/              # Match dashboard
│   │   ├── profile/setup/        # Profile creation wizard
│   │   └── settings/             # Billing, compliance, private params
│   ├── (onboarding)/             # Role selection, API key setup
│   ├── api/
│   │   ├── trpc/[trpc]/          # tRPC HTTP handler
│   │   ├── inngest/              # Inngest serve handler
│   │   └── webhooks/clerk/       # Clerk webhook handler
│   └── account/api-key/          # BYOK key management
│
├── components/                   # React components (11 feature domains)
│   ├── billing/                  # Subscription & payment UI
│   ├── compliance/               # GDPR export, deletion, MFA banner
│   ├── conversations/            # Agent conversation log viewer
│   ├── dashboard/                # Pipeline, metrics, comparison
│   ├── employer/                 # Employer-specific components
│   ├── insights/                 # Feedback insights display
│   ├── matches/                  # Match cards, filtering, actions
│   ├── onboarding/               # Role selection, profile wizard
│   ├── profile/                  # Profile display & editing
│   ├── settings/                 # Settings forms
│   └── team/                     # Team management, invitations
│
├── server/
│   ├── api/
│   │   ├── trpc.ts               # Context + middleware (auth, rate limiting)
│   │   ├── root.ts               # Root router (18 feature routers)
│   │   └── routers/              # Feature routers
│   │       ├── billing.ts        # Stripe subscriptions
│   │       ├── byok.ts           # API key management
│   │       ├── compliance.ts     # GDPR, deletion, audit log
│   │       ├── conversations.ts  # Agent conversation logs
│   │       ├── custom-prompts.ts # Custom agent prompt management
│   │       ├── dashboard.ts      # Employer pipeline & metrics
│   │       ├── employers.ts      # Employer profile CRUD
│   │       ├── health.ts         # Health check endpoints
│   │       ├── insights.ts       # Feedback insights
│   │       ├── jobPostings.ts    # Job posting CRUD & status
│   │       ├── jobSeekers.ts     # Job seeker profile CRUD
│   │       ├── matches.ts        # Match scoring & decisions
│   │       ├── notifications.ts  # Match notifications
│   │       ├── onboarding.ts     # Onboarding flow
│   │       ├── resume.ts         # Resume upload & parsing
│   │       ├── settings.ts       # Privacy & data usage settings
│   │       ├── settings-prompt-helpers.ts
│   │       └── team.ts           # Multi-member employer teams
│   │
│   └── inngest/functions/        # 10 Inngest functions
│       ├── evaluate-candidates.ts       # AI candidate evaluation
│       ├── run-agent-conversation.ts    # Multi-turn agent dialogue
│       ├── generate-posting-embedding.ts # Job posting vectors
│       ├── generate-profile-embedding.ts # Profile vectors
│       ├── generate-feedback-insights.ts # Aggregate insights
│       ├── check-insight-threshold.ts   # Insight trigger check
│       ├── send-match-notification.ts   # Email notifications
│       ├── process-stripe-event.ts      # Billing webhook handler
│       └── execute-account-deletion.ts  # GDPR cascading delete
│
├── lib/                          # ~30 utility modules
│   ├── db.ts                     # Prisma singleton
│   ├── env.ts                    # Type-safe environment variables
│   ├── encryption.ts             # AES-256-GCM for BYOK keys
│   ├── flags.ts                  # Vercel feature flags
│   ├── inngest.ts                # Inngest client
│   ├── audit.ts                  # Audit logging with IP hashing
│   ├── rate-limit.ts             # Upstash Redis rate limiting
│   ├── embeddings.ts             # Vector embedding generation
│   ├── redaction.ts              # PII redaction for conversation logs
│   ├── stripe.ts                 # Stripe client
│   ├── stripe-sessions.ts        # Stripe checkout sessions
│   ├── billing-plans.ts          # Subscription tier definitions
│   ├── plan-limits.ts            # Feature gating by plan
│   ├── csv-export.ts             # CSV export utility
│   ├── conversation-schemas.ts   # Agent conversation Zod schemas
│   ├── matching-schemas.ts       # Match evaluation schemas
│   ├── profile-completeness.ts   # Profile score calculation
│   ├── skills-data.ts            # Skills autocomplete data
│   ├── activity-log.ts           # Activity logging
│   └── trpc/                     # tRPC client (React + RSC)
│
├── middleware.ts                  # Clerk auth middleware
└── types/                        # Shared TypeScript types

prisma/
├── schema.prisma                 # Database schema (16 models, 18 enums)
├── migrations/                   # Migration history
└── seed.ts                       # Development fixture data

tests/
├── unit/                         # Vitest unit tests
├── integration/                  # Database integration tests
└── e2e/                          # Playwright E2E tests

docs/
├── AGENT_ARCHITECTURE.md         # Agent system design
├── ROADMAP.md                    # Product roadmap
├── bias-audit-checklist.md       # NYC Local Law 144 compliance
└── soc2-control-mapping.md       # SOC 2 Type II readiness
```

### Database Schema

**16 Prisma models:** JobSeeker, SeekerSettings, Employer, EmployerMember, Invitation, ActivityLog, JobPosting, JobSettings, AgentConversation, Match, ExtractionCache, FeedbackInsights, Subscription, StripeEvent, AuditLog, DeletionRequest

**18 enums:** EmployerMemberRole, ExperienceLevel, EmploymentType, LocationType, JobPostingStatus, JobUrgency, ConversationStatus, MatchConfidence, MatchPartyStatus, FeedbackUserType, SubscriptionStatus, SubscriptionUserType, TrendDirection, InvitationStatus, AuditActorType, AuditResult, DeletionUserType, DeletionStatus

## Developer Quickstart

### Prerequisites

- Node.js 20+
- pnpm 10+
- A [NeonDB](https://neon.tech) project (free tier works)
- A [Clerk](https://clerk.com) application (free tier works)
- An [Inngest](https://inngest.com) account (free tier works)

### 1. Clone and install

```bash
git clone https://github.com/Little-Town-Labs/jobbobber.git
cd jobbobber
pnpm install
```

### 2. Set up environment variables

```bash
cp .env.example .env.local
```

Fill in the required values in `.env.local`:

| Variable                            | Where to find it                    |
| ----------------------------------- | ----------------------------------- |
| `DATABASE_URL`                      | NeonDB → Connection string (pooled) |
| `DATABASE_URL_UNPOOLED`             | NeonDB → Connection string (direct) |
| `CLERK_SECRET_KEY`                  | Clerk → API Keys                    |
| `CLERK_WEBHOOK_SECRET`              | Clerk → Webhooks → Signing secret   |
| `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY` | Clerk → API Keys                    |
| `INNGEST_SIGNING_KEY`               | Inngest → App → Keys                |
| `INNGEST_EVENT_KEY`                 | Inngest → App → Keys                |
| `ENCRYPTION_KEY`                    | Generate: `openssl rand -hex 32`    |
| `ENCRYPTION_IV_SALT`                | Any random string                   |
| `STRIPE_SECRET_KEY`                 | Stripe → API Keys                   |
| `STRIPE_WEBHOOK_SECRET`             | Stripe → Webhooks → Signing secret  |
| `UPSTASH_REDIS_REST_URL`            | Upstash → Redis → REST URL          |
| `UPSTASH_REDIS_REST_TOKEN`          | Upstash → Redis → REST Token        |

### 3. Set up the database

```bash
# Apply migrations and generate Prisma client
pnpm db:migrate

# Seed with development fixture data
pnpm db:seed
```

### 4. Start the dev server

```bash
# Terminal 1: Next.js dev server
pnpm dev

# Terminal 2: Inngest dev server (for local workflow testing)
npx inngest-cli@latest dev
```

App is now running at http://localhost:3000.

### 5. Verify the setup

```bash
# Run unit tests
pnpm test

# Run unit tests with coverage (must be ≥80%)
pnpm test:coverage

# Type check
pnpm tsc --noEmit

# Lint
pnpm lint
```

Health check endpoints:

```bash
curl http://localhost:3000/api/trpc/health.ping
# Expected: {"result":{"data":{"status":"ok","timestamp":"..."}}}

curl http://localhost:3000/api/trpc/health.deepCheck
# Expected: {"result":{"data":{"healthy":true,"checks":[{"name":"database","status":"ok",...}],...}}}
```

### Available npm scripts

| Script               | Description                              |
| -------------------- | ---------------------------------------- |
| `pnpm dev`           | Start Next.js dev server                 |
| `pnpm build`         | Production build (runs migrations first) |
| `pnpm test`          | Run unit tests                           |
| `pnpm test:coverage` | Run tests with coverage report           |
| `pnpm test:e2e`      | Run Playwright E2E tests                 |
| `pnpm lint`          | ESLint + TypeScript type check           |
| `pnpm format`        | Format all files with Prettier           |
| `pnpm db:migrate`    | Apply pending migrations                 |
| `pnpm db:seed`       | Seed development data                    |
| `pnpm db:studio`     | Open Prisma Studio                       |

## Implementation Status

All 18 features have been implemented across 3 phases:

### Phase 1: MVP — Core Matching Loop

- [x] **1. Foundation Infrastructure** — T3 stack, CI/CD, Vercel deployment
- [x] **2. Authentication & BYOK** — Clerk auth, AES-256 encrypted API key storage
- [x] **3. Job Seeker Profile** — Multi-step wizard, resume upload, profile completeness
- [x] **4. Employer Profile & Job Posting** — Company profile, posting CRUD, status management
- [x] **5. Basic AI Matching** — Employer agent evaluates candidates via Inngest
- [x] **6. Match Dashboard** — Accept/decline workflow, notifications, confidence scores
- [x] **7. Testing Infrastructure** — Vitest, Playwright, LLM mocks, 80%+ coverage gate

### Phase 2: Beta — Agent Intelligence

- [x] **8. Private Negotiation Parameters** — Separate private tables, never exposed via API
- [x] **9. Agent-to-Agent Conversations** — Multi-turn Inngest workflows, autonomous negotiation
- [x] **10. Two-Way Matching** — Bidirectional consensus, both agents must agree
- [x] **11. Vector Search** — pgvector embeddings, cosine similarity candidate discovery
- [x] **12. Agent Conversation Logs** — Read-only logs, PII redaction, data usage opt-out
- [x] **13. Multi-Member Employer Accounts** — Clerk Organizations, RBAC, team invitations

### Phase 3: Full Launch — Enterprise & Compliance

- [x] **14. Aggregate Feedback Insights** — AI-generated private feedback, trend tracking
- [x] **15. Custom Agent Prompting** — Sandboxed prompts, injection detection
- [x] **16. Subscription Billing** — Stripe integration, tier enforcement, webhooks
- [x] **17. Advanced Employer Dashboard** — Pipeline view, candidate comparison, CSV export
- [x] **18. Compliance & Security** — GDPR export/deletion, audit logging, rate limiting, MFA, SOC 2 prep

## Security & Privacy

**Security measures implemented:**

- AES-256-GCM encryption for BYOK API keys (user-scoped isolation)
- Role-based access control via Clerk Organizations
- Platform-wide audit logging with IP hashing
- Rate limiting on all endpoints (Upstash Redis, fail-open)
- PII redaction in agent conversation logs
- Cross-tenant data isolation (validated at query level)
- GDPR data export and right-to-deletion with 72-hour grace period
- Stripe handles PCI compliance (no raw payment data stored)
- Bias audit framework for agent matching (NYC Local Law 144)
- SOC 2 Type II control mapping documented

## Documentation

- **[PRD.md](PRD.md)** — Complete Product Requirements Document
- **[docs/AGENT_ARCHITECTURE.md](docs/AGENT_ARCHITECTURE.md)** — Agent system design and patterns
- **[docs/ROADMAP.md](docs/ROADMAP.md)** — Product roadmap
- **[docs/bias-audit-checklist.md](docs/bias-audit-checklist.md)** — AI bias audit for compliance
- **[docs/soc2-control-mapping.md](docs/soc2-control-mapping.md)** — SOC 2 readiness documentation
- **[project-config.json](project-config.json)** — Machine-readable tech stack configuration

## License

This project is licensed under the MIT License - see [LICENSE](LICENSE) file for details.

---

**Last Updated**: 2026-03-09
**Version**: 1.0.0
**Status**: All Features Implemented
**Repository**: Private
