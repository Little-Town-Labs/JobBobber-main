<!--
Sync Impact Report - Constitution Update

Version Change: [NEW] → 1.0.0
Rationale: Initial constitution creation for JobBobber project

Modified Principles: None (initial creation)
Added Sections:
  - Core Principles (7 principles)
  - Technical Constraints
  - Development Workflow
  - Governance

Templates Requiring Updates:
  ✅ plan-template.md - Reviewed, aligns with type safety and testing principles
  ✅ spec-template.md - Reviewed, aligns with phased rollout approach
  ✅ tasks-template.md - Reviewed, aligns with TDD workflow

Follow-up TODOs: None

Dependencies:
  - Ensure all new features comply with BYOK model
  - Verify feature flags configured before enabling beta features
  - All agent code must use type-safe schemas (Zod)
-->

# JobBobber Constitution

## Core Principles

### I. Type Safety First (NON-NEGOTIABLE)

Full-stack type safety from database to UI with zero tolerance for type bypasses.

**Rules:**
- ALL data flows MUST be type-safe: Database (Prisma) → API (tRPC) → UI (TypeScript)
- Zod schemas REQUIRED for all external inputs (user input, LLM responses, API calls)
- NO `any` types except in verified third-party integration boundaries
- AI agent outputs MUST use structured schemas validated with Zod

**Rationale:** Type safety prevents runtime errors, catches bugs at compile time, and enables confident refactoring. Critical for AI systems where LLM responses are unpredictable.

### II. Test-Driven Development (NON-NEGOTIABLE)

TDD workflow is mandatory for all feature development.

**Rules:**
- Tests written FIRST, then implementation
- Red-Green-Refactor cycle strictly enforced
- Minimum 80% code coverage (unit + integration)
- AI agent logic MUST be tested with mocked LLM responses
- NO shipping untested code

**Rationale:** TDD ensures code correctness, prevents regressions, and makes refactoring safe. Essential for AI systems where unexpected behavior can occur.

### III. BYOK Architecture (NON-NEGOTIABLE)

Users provide their own LLM API keys. JobBobber NEVER pays for AI usage.

**Rules:**
- ALL user-facing AI features MUST use user-provided API keys
- API keys MUST be encrypted at rest (AES-256)
- User-scoped encryption (separate keys per user)
- NO fallback to platform API keys
- Key validation REQUIRED before saving
- Usage tracking for user visibility

**Rationale:** BYOK enables infinite scaling without AI cost scaling, maintains high SaaS margins (~95%), and gives users full transparency and control over AI spending.

### IV. Minimal Abstractions

Prefer explicit, debuggable code over heavy frameworks and abstractions.

**Rules:**
- NO LangChain, LangGraph, or similar heavy AI frameworks
- Use Vercel AI SDK + direct OpenAI SDK calls
- Custom agent logic over framework magic
- Explicit is better than implicit
- Build only what we need (YAGNI principle)

**Rationale:** Heavy abstractions make debugging difficult, hide important details, and add unnecessary complexity. Direct SDK usage gives full control and clarity.

### V. Security & Privacy

Protect user data and private negotiation parameters.

**Rules:**
- Private negotiation parameters (salary, deal-breakers) MUST NEVER be exposed in public APIs
- Separate data models for public vs private fields
- All API endpoints MUST validate authorization (tRPC protected procedures)
- User API keys encrypted with user-specific keys
- NO logging of sensitive data (API keys, salaries, private params)
- Regular security audits before each phase launch

**Rationale:** JobBobber handles sensitive career and financial data. Privacy breaches would destroy user trust and violate compliance requirements.

### VI. Phased Rollout with Feature Flags

All new features deployed progressively using Vercel Flags SDK.

**Rules:**
- ALL beta/experimental features behind feature flags
- MVP → Beta → Full launch progression strictly followed
- No "big bang" releases
- Flags evaluated at edge (zero latency)
- Gradual rollout: internal → beta users → 10% → 50% → 100%
- Instant kill-switch capability for problematic features

**Rationale:** Feature flags enable safe, gradual rollout, quick rollback, A/B testing, and risk mitigation. Critical for AI features where behavior is hard to predict.

### VII. Agent Autonomy

AI agents operate autonomously without human intervention until interview stage.

**Rules:**
- Agent-to-agent conversations MUST NOT require human approval mid-negotiation
- Private parameters used strategically by agents
- Multi-turn negotiations handled by Inngest (resumable, no timeout limits)
- Agents make final match decisions
- Humans only intervene at interview scheduling stage

**Rationale:** Autonomy is JobBobber's core value proposition. Manual intervention defeats the purpose and kills the user experience.

## Technical Constraints

### Technology Stack (LOCKED)

The following stack decisions are locked for consistency:

**Frontend:**
- Next.js 15 + React 19 (App Router)
- tRPC 11 (type-safe API)
- Tailwind CSS 3 + shadcn/ui
- TypeScript 5 (strict mode)

**Backend:**
- Next.js API Routes (tRPC server)
- Prisma 5 (ORM)
- NeonDB (PostgreSQL + pgvector)
- Inngest 3 (workflow orchestration)

**AI Infrastructure:**
- Vercel AI SDK 3 (user chat + tools)
- Vercel AI Gateway (unified API)
- BYOK model (user-provided keys)
- Zod (structured output validation)

**Infrastructure:**
- Clerk (auth + organizations)
- Vercel (hosting + deployment)
- Vercel Flags SDK (feature rollout)
- pnpm (package manager)

**Deviation Requires:** Architecture review, documentation update, and explicit justification.

### Code Organization

**Rules:**
- Feature-based organization (colocate related files)
- One tRPC router per domain entity
- One Inngest function per workflow
- Component files: kebab-case
- Component names: PascalCase
- Functions: camelCase
- Maximum file length: 500 lines (except generated code)

### AI Agent Code

**Rules:**
- Agent prompts stored as typed functions (not strings)
- All agent outputs validated with Zod schemas
- LLM API calls mocked in tests (NO real API calls in test suite)
- Inngest workflows for long-running agent operations
- Tool calling for interactive agent features
- NO storing LLM responses without validation

## Development Workflow

### Code Review Requirements

**Before ANY pull request can merge:**
- [ ] All tests passing (80%+ coverage)
- [ ] TypeScript compilation successful (zero errors)
- [ ] ESLint passing (zero errors)
- [ ] Prettier formatting applied
- [ ] Security review for sensitive features (auth, payments, API keys)
- [ ] Performance check for database queries
- [ ] Vercel preview deployment successful

### Agent Code Review

**Additional requirements for AI agent code:**
- [ ] Zod schemas defined for all agent outputs
- [ ] LLM calls properly mocked in tests
- [ ] Private parameters never exposed in logs or responses
- [ ] Error handling for malformed LLM responses
- [ ] Cost estimation documented

### Feature Release Process

**Progressive rollout checklist:**
1. Feature developed behind feature flag (OFF by default)
2. Tests passing with 80%+ coverage
3. Code review approved
4. Deploy to production (feature still OFF)
5. Enable for internal team (1-2 days)
6. Enable for beta users (1 week)
7. Gradual rollout (10% → 50% → 100% over 2-4 weeks)
8. Monitor metrics at each stage
9. Full enable only after zero critical issues

## Governance

### Constitutional Authority

This constitution supersedes all other development practices and guidelines. When conflicts arise between this document and other resources (README, PRD, etc.), the constitution takes precedence.

### Amendment Process

**To amend this constitution:**
1. Propose amendment with clear rationale
2. Update constitution file with version bump
3. Document impact on dependent templates
4. Update all affected template files
5. Get team approval (all founding members)
6. Commit with message: `docs: amend constitution to vX.Y.Z (summary)`

**Version Bump Rules:**
- MAJOR (X.0.0): Removed or redefined core principles, breaking governance changes
- MINOR (X.Y.0): New principles added, material expansions to guidance
- PATCH (X.Y.Z): Clarifications, wording improvements, typo fixes

### Compliance Verification

**Every pull request MUST verify:**
- [ ] Follows type safety principle (no any types, Zod validation)
- [ ] Includes tests (80%+ coverage)
- [ ] Uses BYOK model (no platform API keys)
- [ ] Security-reviewed if handles sensitive data
- [ ] Behind feature flag if beta/experimental
- [ ] Follows minimal abstraction principle (no heavy frameworks)

**Architecture review REQUIRED for:**
- Changes to core tech stack (database, framework, AI provider)
- New external dependencies
- New third-party API integrations
- Changes to BYOK model or encryption

### Runtime Development Guidance

For day-to-day development patterns and examples, reference:
- **Primary**: `.claude/rules.md` (T3 + AI agent patterns)
- **Secondary**: `docs/AGENT_ARCHITECTURE.md` (agent system design)
- **Configuration**: `project-config.json` (tech stack and commands)

This constitution defines **what** we must do. The guidance files define **how** to do it.

---

**Version**: 1.0.0 | **Ratified**: 2026-02-14 | **Last Amended**: 2026-02-14
