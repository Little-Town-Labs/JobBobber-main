# JobBobber — AI-Powered Talent Matching Platform

> Autonomous AI agents connecting job seekers with employers — eliminating the manual grind of job searching and applicant screening.

[![License](https://img.shields.io/badge/license-MIT-blue)]()
[![Status](https://img.shields.io/badge/status-architecture-yellow)]()

## Executive Summary

**The Problem:** Job seekers spend 20-40+ hours/week applying to hundreds of jobs. Employers spend thousands of hours screening unqualified applicants. LinkedIn has devolved into a noisy social feed where genuine talent is hard to identify.

**Our Solution:** JobBobber uses AI agents that autonomously handle the entire matching process. Job seekers and employers each have their own AI agent that negotiates on their behalf — no manual applications, no resume screening, just interview-ready matches.

**Business Model:** Subscription platform ($0-$99/month) where users bring their own LLM API keys (OpenAI/Anthropic). JobBobber has **zero AI infrastructure costs** while users pay only for what they use (~$10-50/month to their LLM provider).

**Market Opportunity:**
- Large and growing market for AI-powered recruiting solutions
- We're building the first truly AI-native talent platform

## Overview

JobBobber is a next-generation talent matching platform that leverages AI agents to autonomously connect job seekers with employer opportunities. Unlike traditional professional networks (e.g., LinkedIn), JobBobber replaces the manual, noise-heavy experience with a streamlined, AI-first approach: humans provide their information, and AI agents handle the screening, negotiation, and matching — delivering a shortlist of interview-ready candidates to employers and interview-ready opportunities to job seekers.

**Status:** Currently in architecture phase. See [PRD.md](PRD.md) for complete product requirements.

## Why We're Building This

**The LinkedIn Problem:**
LinkedIn has evolved from a professional networking tool into a general-purpose social media platform. The signal-to-noise ratio has deteriorated — personal opinion posts, political commentary, and engagement-bait content now dominate feeds. Evaluating genuine professional talent from a profile alone is nearly impossible.

**The Manual Grind:**
- **Job Seekers:** Spend weeks/months submitting hundreds of applications with ~2% response rate
- **Employers:** Invest thousands of hours screening applicants where 90%+ are unqualified or misaligned
- **Both:** Frustrated by inefficiency, wasted time, and poor matches

**Our Insight:**
AI agents can handle the screening and negotiation process better than humans — they're objective, tireless, available 24/7, and can evaluate thousands of matches simultaneously while respecting private preferences (salary flexibility, deal-breakers, training willingness) that neither party wants to reveal upfront.

**Key Differentiators:**
- **AI-First Matching**: Agent-to-agent conversations autonomously evaluate fit and negotiate terms
- **Zero Noise**: No social feed, no opinion posts — purely focused on talent-to-opportunity matching
- **Private Negotiation**: Both parties set confidential parameters that their AI agents use strategically
- **Profile Validation**: AI agents probe and contextualize qualifications beyond static profiles
- **Time Savings**: Reduces job search from weeks/months to days; automates employer screening
- **Zero AI Costs**: BYOK model means platform scales infinitely without infrastructure cost scaling

## Features

### For Job Seekers
- **AI Agent Representation**: Your agent searches, screens, and negotiates on your behalf 24/7
- **Private Preferences**: Set confidential parameters (min salary, deal-breakers) that your agent uses strategically
- **Profile Enhancement**: AI helps build comprehensive, accurate profiles from resumes and conversations
- **Interview-Ready Matches**: Only see opportunities where mutual fit has been verified by AI agents

### For Employers
- **Automated Screening**: AI agent evaluates all applicants against job requirements and private criteria
- **Cost Reduction**: Eliminate thousands of hours spent on manual applicant review
- **Quality Matches**: AI probes beyond surface-level profiles to validate true qualifications
- **Multi-User Support**: Team-based access with roles (admin, job poster, hiring manager)

### Core Capabilities
- **Agent-to-Agent Conversations**: Multi-turn negotiations between job seeker and employer agents
- **Semantic Search**: Vector-based matching for profile-to-job similarity
- **Custom Agent Prompting**: Organizations can customize their AI agent's evaluation criteria
- **Match Scoring & Ranking**: Transparent scoring system with explainability
- **Real-time Notifications**: Instant updates on new matches and interview requests

## Technology Stack

**Architecture**: Hybrid T3 Stack with separate agent processing service

### Frontend
- **Framework**: Next.js 15 (React 19)
- **API Layer**: tRPC (end-to-end type safety)
- **Styling**: Tailwind CSS
- **State Management**: React Context + tRPC cache
- **UI Components**: shadcn/ui + Radix UI

### Backend - Main API
- **Runtime**: Node.js 20+
- **Framework**: Next.js API Routes (tRPC)
- **Language**: TypeScript
- **Type Safety**: Full-stack with tRPC + Prisma

### Backend - Agent Service (Separate)
- **Runtime**: Node.js 20+
- **Framework**: Express or Fastify
- **Purpose**: Long-running AI agent conversations
- **Orchestration**: Inngest workflows

### Database & Storage
- **Primary Database**: PostgreSQL (NeonDB serverless)
- **ORM**: Prisma (type-safe queries + migrations)
- **Vector Database**: pgvector (NeonDB extension)
- **File Storage**: Vercel Blob Storage (resumes, documents)

### AI & Agent Infrastructure
- **Development AI**: Anthropic Claude (Claude Sonnet 4.5)
- **Runtime AI**: **User-provided API keys** (BYOK model - OpenAI, Anthropic, or Cohere)
- **AI Gateway**: Vercel AI Gateway (user's budgets, monitoring, load-balancing)
- **Agent Framework**: Vercel AI SDK + Custom (no heavy abstractions)
- **Agent Orchestration**: Inngest (long-running agent-to-agent workflows)
- **User-Facing Chat**: Vercel AI SDK (streaming, React hooks, tool calling)
- **Tool Calling**: AI SDK native tools (job search, profile retrieval during chat)
- **Structured Outputs**: Zod validation + AI SDK `streamObject`
- **Embeddings**: User's choice (OpenAI, Cohere, or Voyage AI)
- **Vector Similarity**: pgvector cosine similarity

**Bring Your Own Key (BYOK) Model:**
- Users provide their own OpenAI/Anthropic/Cohere API keys
- JobBobber doesn't pay for AI usage (**zero AI infrastructure costs!**)
- Users control their AI spending through their own provider accounts
- AI Gateway routes requests through user's keys
- Encrypted key storage with user-scoped isolation

## Business Model

### Revenue: Subscription-Only

**Free Tier** — $0/month
- 10 AI matches per month
- Basic chat with your agent
- Manual job applications
- *User pays ~$0.50/month to their LLM provider*

**Pro Tier** — $29/month
- Unlimited AI matches
- Advanced agent features
- Auto-apply to jobs
- Private negotiation parameters
- *User pays ~$10-50/month to their LLM provider*

**Team Tier** — $99/month (For Employers)
- Everything in Pro
- 5 team members
- Custom agent prompts
- Analytics dashboard
- Dedicated support
- *User pays ~$50-200/month to their LLM provider*

### Why BYOK Makes Sense

**Traditional SaaS AI Cost Problem:**
```
10,000 users × 100 agent calls/month × $0.05/call
= $50,000/month in AI costs 😱
= Need to charge $10+/user just to break even on AI
```

**JobBobber with BYOK:**
```
JobBobber AI costs: $0/month ✅
Revenue: Subscription-based (pricing TBD)
Margin: High margins (standard SaaS costs: hosting, support, ops)
Users: Pay their own LLM provider directly (transparent, controllable)
```

**Benefits:**
- **Infinite scaling** without AI cost concerns
- **Simple pricing** that never changes based on usage
- **User transparency** (they see exact AI costs in OpenAI dashboard)
- **Better margins** than any AI-included pricing model

**Agent Architecture Philosophy:**
- Vercel AI SDK for user-facing chat (streaming, `useChat` hooks, function calling)
- AI SDK tools enable agents to search jobs, retrieve profiles during conversations
- Inngest workflows for agent-to-agent negotiations (no timeout limits)
- User API keys used for all LLM calls (via secure gateway)
- Custom agent logic (explicit, debuggable, TypeScript-native)
- Feature flags control rollout phases (MVP → Beta → Full)

### Infrastructure
- **Authentication**: Clerk (organizations, teams, RBAC)
- **Workflow Engine**: Inngest (long-running agent workflows)
- **Feature Flags**: Vercel Flags SDK (phased rollout, A/B testing)
- **Hosting**: Vercel (frontend + API routes)
- **Database**: NeonDB (serverless PostgreSQL)
- **Monitoring**: Sentry (errors) + Vercel Analytics
- **Real-time**: Server-Sent Events (SSE) via tRPC subscriptions

### Testing
- **Unit Testing**: Vitest
- **E2E Testing**: Playwright
- **API Testing**: tRPC testing utilities
- **Coverage Target**: 80%
- **Test Database**: NeonDB preview branches

### Development Tools
- **Package Manager**: pnpm
- **Linting**: ESLint + TypeScript strict mode
- **Formatting**: Prettier
- **Git Hooks**: Husky + lint-staged
- **CI/CD**: GitHub Actions + Vercel deployment

## Architecture

### High-Level Overview

```
┌─────────────────────────────────────────────────────────────────────┐
│                         Vercel Platform                              │
│                                                                       │
│  ┌────────────────┐         ┌──────────────────────────────────┐   │
│  │   Next.js App  │         │      tRPC API Routes             │   │
│  │  (React + SSR) │ ◄─────► │  (Type-safe API layer)           │   │
│  │                │         │                                   │   │
│  │  • Dashboards  │         │  • User Management                │   │
│  │  • Profiles    │         │  • Match Retrieval                │   │
│  │  • Messaging   │         │  • Profile CRUD                   │   │
│  └────────────────┘         └──────────────┬───────────────────┘   │
│                                             │                        │
└─────────────────────────────────────────────┼────────────────────────┘
                                              │
                    ┌─────────────────────────┼─────────────────────────┐
                    │                         │                         │
           ┌────────▼─────────┐     ┌────────▼────────┐      ┌────────▼────────┐
           │   NeonDB         │     │    Inngest      │      │     Clerk       │
           │   (PostgreSQL)   │     │  (Workflows)    │      │     (Auth)      │
           │                  │     │                 │      │                 │
           │ • User Profiles  │     │ • Agent Runner  │      │ • Multi-tenant  │
           │ • Jobs           │     │ • Multi-turn    │      │ • RBAC          │
           │ • Matches        │     │   Conversations │      │ • Orgs/Teams    │
           │ • pgvector       │     │ • No timeouts   │      └─────────────────┘
           └──────────────────┘     └────────┬────────┘
                                              │
                                    ┌─────────▼─────────┐
                                    │   OpenAI API      │
                                    │                   │
                                    │ • GPT-4 Agents    │
                                    │ • Embeddings      │
                                    │ • Conversations   │
                                    └───────────────────┘
```

**Key Architecture Decisions:**

1. **Next.js + tRPC**: Full-stack type safety from database to UI
2. **Inngest**: Handles long-running agent workflows (no 10-second Vercel timeout)
3. **pgvector**: Embedded in NeonDB (no separate vector DB needed)
4. **Clerk**: Organizations & RBAC built-in (perfect for employer teams)
5. **Vercel Blob**: Integrated file storage for resumes

### Directory Structure

**T3 Stack Monorepo Structure:**

```
jobbobber/
├── src/
│   ├── app/                    # Next.js App Router
│   │   ├── (auth)/            # Auth routes (sign-in, sign-up)
│   │   ├── (dashboard)/       # Protected dashboard routes
│   │   │   ├── seeker/       # Job seeker dashboard
│   │   │   └── employer/     # Employer dashboard
│   │   ├── api/              # API routes
│   │   │   ├── trpc/         # tRPC handler
│   │   │   └── inngest/      # Inngest webhook
│   │   ├── layout.tsx        # Root layout
│   │   └── page.tsx          # Landing page
│   │
│   ├── components/            # React components
│   │   ├── ui/               # shadcn/ui components
│   │   ├── forms/            # Form components
│   │   ├── layouts/          # Layout components
│   │   └── ...               # Feature components
│   │
│   ├── server/               # Backend logic
│   │   ├── api/              # tRPC routers
│   │   │   ├── root.ts       # Root router
│   │   │   ├── routers/      # Feature routers
│   │   │   │   ├── user.ts
│   │   │   │   ├── profile.ts
│   │   │   │   ├── job.ts
│   │   │   │   └── match.ts
│   │   │   └── trpc.ts       # tRPC setup
│   │   │
│   │   ├── db/               # Database
│   │   │   ├── schema.ts     # Prisma schema types
│   │   │   └── client.ts     # Prisma client
│   │   │
│   │   ├── agents/           # AI Agent logic
│   │   │   ├── employer.ts   # Employer agent
│   │   │   ├── seeker.ts     # Job seeker agent
│   │   │   ├── conversation.ts # Agent conversations
│   │   │   └── prompts/      # Agent prompts
│   │   │
│   │   └── inngest/          # Inngest workflows
│   │       ├── client.ts     # Inngest client
│   │       └── functions/    # Workflow functions
│   │           ├── match-agent.ts
│   │           ├── conversation.ts
│   │           └── embeddings.ts
│   │
│   ├── lib/                  # Utilities
│   │   ├── utils.ts          # General utilities
│   │   ├── validators.ts     # Zod schemas
│   │   ├── openai.ts         # OpenAI client
│   │   └── vector.ts         # pgvector utilities
│   │
│   ├── hooks/                # React hooks
│   ├── styles/               # Global styles
│   └── types/                # TypeScript types
│
├── prisma/
│   ├── schema.prisma         # Database schema
│   ├── migrations/           # Migration history
│   └── seed.ts               # Seed data
│
├── public/                   # Static assets
├── tests/
│   ├── e2e/                  # Playwright tests
│   ├── integration/          # API integration tests
│   └── unit/                 # Unit tests
│
├── .claude/                  # Claude Code configuration
├── docs/                     # Documentation
├── package.json
├── tsconfig.json
├── next.config.js
├── tailwind.config.ts
└── .env.example
```

### Key Design Patterns

- **Agent-to-Agent Communication**: Autonomous multi-turn conversations between AI agents
- **Event-Driven Architecture**: Job queue for async agent processing
- **Semantic Matching**: Vector embeddings for profile-to-job similarity
- **Private Information Handling**: Separate public/private data models for strategic negotiation

## Getting Started

### Prerequisites

- **Node.js**: 20.0.0 or higher
- **pnpm**: 8.0.0 or higher (install with `npm install -g pnpm`)
- **Git**: For version control
- **Accounts needed**:
  - NeonDB account (database)
  - Clerk account (authentication)
  - OpenAI API key (AI agents)
  - Inngest account (workflow orchestration)
  - Vercel account (deployment - optional for local dev)

### Installation

```bash
# Clone the repository
git clone https://github.com/your-org/jobbobber.git
cd jobbobber

# Install dependencies
pnpm install

# Add AI SDK and agent dependencies
pnpm add ai @ai-sdk/openai zod
pnpm add inngest
pnpm add @clerk/nextjs
pnpm add @vercel/flags

# Set up environment variables
cp .env.example .env
# Edit .env with your configuration (see Configuration section below)

# Set up database
pnpm db:push          # Push Prisma schema to database
pnpm db:seed          # Seed with sample data (optional)

# Start development server
pnpm dev              # Starts Next.js dev server on http://localhost:3000

# In a separate terminal, start Inngest dev server
pnpm inngest:dev      # Starts Inngest UI on http://localhost:8288
```

### Configuration

**Environment Variables:**

Create a `.env` file in the project root:

```env
# Database (NeonDB)
DATABASE_URL="postgresql://username:password@ep-xxx.us-east-2.aws.neon.tech/jobbobber?sslmode=require"
DIRECT_URL="postgresql://username:password@ep-xxx.us-east-2.aws.neon.tech/jobbobber?sslmode=require"

# Authentication (Clerk)
NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=pk_test_...
CLERK_SECRET_KEY=sk_test_...
NEXT_PUBLIC_CLERK_SIGN_IN_URL=/sign-in
NEXT_PUBLIC_CLERK_SIGN_UP_URL=/sign-up
NEXT_PUBLIC_CLERK_AFTER_SIGN_IN_URL=/dashboard
NEXT_PUBLIC_CLERK_AFTER_SIGN_UP_URL=/onboarding

# AI/LLM (OpenAI)
OPENAI_API_KEY=sk-proj-...
OPENAI_ORG_ID=org-...  # Optional

# Inngest (Workflow Orchestration)
INNGEST_EVENT_KEY=...
INNGEST_SIGNING_KEY=signkey-prod-...
NEXT_PUBLIC_INNGEST_ENV=development

# Vercel Blob Storage (File uploads)
BLOB_READ_WRITE_TOKEN=vercel_blob_rw_...

# Application
NODE_ENV=development
NEXT_PUBLIC_APP_URL=http://localhost:3000

# Optional: Analytics & Monitoring
NEXT_PUBLIC_POSTHOG_KEY=phc_...
NEXT_PUBLIC_POSTHOG_HOST=https://app.posthog.com
SENTRY_DSN=https://...@sentry.io/...
```

**Getting API Keys:**

1. **NeonDB**: Sign up at https://neon.tech, create a project, copy connection string
2. **Clerk**: Sign up at https://clerk.com, create application, copy keys from dashboard
3. **OpenAI**: Get API key from https://platform.openai.com/api-keys
4. **Inngest**: Sign up at https://inngest.com, create project, copy event + signing keys
5. **Vercel Blob**: Deploy to Vercel or use local development token

See `.env.example` for all available options.

## Development

### Running Tests

```bash
# Run all tests
pnpm test                       # Run unit + integration tests with Vitest

# Run tests in watch mode
pnpm test:watch                 # Watch mode for development

# Run E2E tests
pnpm test:e2e                   # Run Playwright E2E tests
pnpm test:e2e:ui                # Run E2E tests with Playwright UI

# Coverage report
pnpm test:coverage              # Generate coverage report (target: 80%+)
```

### Code Quality

```bash
# Lint code
pnpm lint                       # Run ESLint
pnpm lint:fix                   # Auto-fix linting issues

# Format code
pnpm format                     # Check Prettier formatting
pnpm format:write               # Auto-format all files

# Type checking
pnpm type-check                 # Run TypeScript compiler check
pnpm type-check:watch           # Type check in watch mode
```

### Database Operations (Prisma)

```bash
# Development workflow
pnpm db:push                    # Push schema changes to DB (dev only)
pnpm db:studio                  # Open Prisma Studio (DB GUI)

# Production workflow
pnpm db:generate                # Generate Prisma Client
pnpm db:migrate:dev             # Create and apply migration (dev)
pnpm db:migrate:deploy          # Apply migrations (production)

# Data management
pnpm db:seed                    # Seed database with sample data
pnpm db:reset                   # Reset database (WARNING: deletes all data)

# Utility commands
pnpm db:format                  # Format schema.prisma
pnpm db:validate                # Validate schema
```

### Inngest Development

```bash
# Start Inngest dev server (runs locally)
pnpm inngest:dev                # Starts Inngest dashboard on http://localhost:8288

# Test Inngest functions
pnpm inngest:test               # Run Inngest function tests

# Trigger specific workflow (for testing)
pnpm inngest:trigger <function-name>
```

### Common Development Tasks

```bash
# Start full dev environment
pnpm dev                        # Next.js dev server (port 3000)
# In separate terminal:
pnpm inngest:dev                # Inngest dev server (port 8288)

# Build for production
pnpm build                      # Build Next.js app
pnpm start                      # Start production server

# Clean build artifacts
pnpm clean                      # Remove .next, node_modules/.cache, etc.

# Check everything before commit
pnpm check-all                  # Runs: lint, type-check, test, build
```

## Roadmap & Phased Rollout

### Phase 1: MVP (Months 1–3)
**Goal:** Prove the core matching loop works.

**Timeline:** 3 months from project start
**Success Metrics:** TBD (will be defined based on market research)

**Features:**
- ✅ User authentication (Clerk with orgs)
- ✅ Job seeker profile creation (structured fields + resume upload)
- ✅ Employer profile and job posting creation
- ✅ Basic AI matching (Employer Agent evaluates candidates)
- ✅ Match scoring and notifications
- ✅ Simple dashboards showing matches
- ✅ BYOK onboarding (users add their API keys)

**Tech Stack:**
- Next.js + tRPC + Prisma (T3 Stack)
- Vercel AI SDK (user chat)
- Inngest (basic workflows)
- Feature flags: All advanced features OFF

**Launch Strategy:**
- Internal team testing (2 weeks)
- Friends & family (2 weeks)
- Small beta cohort (50-100 users)

---

### Phase 2: Beta (Months 4–6)
**Goal:** Add agent intelligence and two-way matching.

**Timeline:** 3 months after MVP launch
**Success Metrics:** TBD (will be defined after MVP learnings)

**Features:**
- ✅ Agent-to-agent conversations (multi-turn via Inngest)
- ✅ Job Seeker Agent evaluates job postings (two-way matching)
- ✅ Private negotiation parameters (salary, flexibility, deal-breakers)
- ✅ Match acceptance/rejection workflow
- ✅ Interview scheduling integration
- ✅ Agent chat with tool calling (job search during conversation)

**Tech Stack:**
- All MVP tech +
- AI SDK tool calling
- Inngest multi-turn workflows
- Feature flags: Agent features enabled for beta users

**Launch Strategy:**
- Gradual rollout: 10% → 25% → 50% → 100%
- A/B test GPT-4 vs Claude performance
- Collect user feedback continuously

---

### Phase 3: Full Launch (Months 7–12)
**Goal:** Scale and optimize for growth.

**Timeline:** 6 months after beta
**Success Metrics:** TBD (will be defined based on beta performance)

**Features:**
- ✅ Custom agent prompt templates (employers customize evaluation criteria)
- ✅ Advanced analytics and reporting
- ✅ Team features for employers (5+ members, role-based access)
- ✅ Revenue implementation (subscription billing)
- ✅ Performance optimization and caching
- ✅ Mobile app (iOS + Android)
- ✅ API for integrations

**Tech Stack:**
- All Beta tech +
- Vercel AI Gateway (caching, load-balancing)
- Advanced feature flags
- Multi-provider support (OpenAI + Anthropic + Cohere)

**Launch Strategy:**
- Public launch with marketing campaign
- Content marketing (blog, case studies)
- Partnership with recruiting agencies
- Paid acquisition channels

---

### Long-Term Vision (Year 2+)

**Features:**
- Industry-specific agent templates (tech, healthcare, finance)
- AI-powered resume generation
- Salary negotiation automation
- Reference checking automation
- Skills assessment integration
- Video interview AI analysis
- Global expansion (EU, APAC markets)

**Business Goals:**
- Scale to significant user base
- Achieve profitability
- Consider fundraising options (if desired)

## API Documentation

> API documentation will be available once endpoints are implemented.

**Planned Key Endpoints:**
- `POST /api/v1/auth/register` - User registration
- `POST /api/v1/profiles/job-seeker` - Create job seeker profile
- `POST /api/v1/profiles/employer` - Create employer profile
- `POST /api/v1/jobs` - Create job posting
- `GET /api/v1/matches` - Get matches for user
- `POST /api/v1/matches/:id/accept` - Accept a match

## Deployment

> Deployment instructions will be finalized once hosting platform is selected.

## Contributing

We welcome contributions! Please see [CONTRIBUTING.md](CONTRIBUTING.md) for:
- Code of conduct
- Development workflow
- Coding standards
- Pull request process
- Testing requirements

### Quick Start for Contributors

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Make your changes
4. Run tests and linting
5. Commit your changes (following [Conventional Commits](https://www.conventionalcommits.org/))
6. Push to your fork
7. Open a Pull Request

## Security & Privacy

JobBobber handles sensitive user data including:
- Personal information (names, contact details)
- Professional history (resumes, work experience)
- Private negotiation parameters (salary expectations, deal-breakers)

**Security Measures:**
- All data encrypted at rest and in transit
- Role-based access control (RBAC)
- Regular security audits
- Compliance with GDPR, CCPA, and other privacy regulations

See [SECURITY.md](SECURITY.md) for security policies and reporting vulnerabilities.

## License

This project is licensed under the MIT License - see [LICENSE](LICENSE) file for details.

## Support

- **Documentation**: See `docs/` directory
- **Issues**: [GitHub Issues](https://github.com/your-org/jobbobber/issues)
- **Discussions**: [GitHub Discussions](https://github.com/your-org/jobbobber/discussions)

## Acknowledgments

- Built with Claude (Anthropic) for development
- Powered by AI agents for runtime matching
- Inspired by the need for a better professional networking experience

---

## Team & Collaboration

This is a **private repository** for the JobBobber founding team. We're currently in the architecture and planning phase.

### Documentation

- **[README.md](README.md)** - This file (project overview, business model, roadmap)
- **[PRD.md](PRD.md)** - Complete Product Requirements Document
- **[AGENT_ARCHITECTURE.md](docs/AGENT_ARCHITECTURE.md)** - Agent system architecture and patterns
- **[project-config.json](project-config.json)** - Machine-readable tech stack and configuration
- **[CLAUDE.md](CLAUDE.md)** - Claude Code preferences and workflow
- **[.claude/rules.md](.claude/rules.md)** - Project-specific coding patterns

### Next Steps

1. **Review this README** and PRD.md for alignment on vision and approach
2. **Review tech stack decisions** (T3 Stack + BYOK model + Inngest)
3. **Set up development environment** (once architecture is approved)
4. **Begin MVP development** following phased rollout plan

### Questions or Feedback?

Open a GitHub Discussion or reach out directly. This is a collaborative effort!

---

**Last Updated**: 2026-02-14
**Version**: 0.1.0 (Pre-MVP)
**Status**: Planning & Architecture Phase
**Repository**: Private
