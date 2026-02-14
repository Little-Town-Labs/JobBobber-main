# JobBobber Product Roadmap

**Status**: Planning & Architecture Phase
**Last Updated**: 2026-02-14
**Version**: 1.0

---

## Overview

This roadmap outlines all features planned for JobBobber across three phases: MVP (Months 1-3), Beta (Months 4-6), and Full Launch (Months 7-12). Features are organized by user type and technical domain.

**Key Principles:**
- **Start Simple**: MVP focuses on core matching loop only
- **Iterate Fast**: Beta adds agent intelligence based on MVP learnings
- **Scale Smart**: Full launch adds enterprise features and optimization
- **Feature Flags**: Use Vercel Flags SDK to roll out features gradually

---

## Phase 1: MVP (Months 1–3)

**Goal**: Prove the core matching loop works
**Timeline**: 3 months from project start
**Success Metrics**: 100+ users, 500+ matches, 10+ interview placements

### Authentication & Onboarding

- [ ] **User Registration**
  - Clerk integration (email, OAuth, SSO)
  - Role selection (Job Seeker vs Employer)
  - Email verification

- [ ] **API Key Setup (BYOK)**
  - User provides OpenAI/Anthropic API key
  - Encrypted key storage
  - Key validation before saving
  - Cost estimation display ($0.50-$50/month)

- [ ] **Profile Creation Wizard**
  - Multi-step onboarding flow
  - Progress indicator
  - Skip/come back later option

### Job Seeker Features

- [ ] **Profile Creation**
  - Basic info (name, email, location)
  - Job title and experience level
  - Skills (autocomplete, multi-select)
  - Resume upload (PDF/DOCX)
  - Bio/summary (optional)

- [ ] **Profile Parsing**
  - Extract structured data from resume
  - AI-assisted skill extraction
  - Auto-populate profile fields

- [ ] **Match Dashboard**
  - View all matches
  - Sort by match score
  - Filter by status (pending, accepted, rejected)
  - Basic match details (job title, company, score)

- [ ] **Match Actions**
  - View match reasoning
  - Accept match (express interest)
  - Decline match (not interested)
  - Mark as "maybe" (review later)

### Employer Features

- [ ] **Company Profile**
  - Company name and description
  - Industry and size
  - Website and logo
  - Team members (single user for MVP)

- [ ] **Job Posting Creation**
  - Job title and description
  - Required skills
  - Experience level
  - Location (remote/hybrid/onsite)
  - Salary range (optional, public)

- [ ] **Candidate Dashboard**
  - View all matched candidates
  - Sort by match score
  - Filter by status
  - Basic candidate details (name, title, score)

- [ ] **Candidate Review**
  - View full candidate profile
  - View match reasoning
  - Accept candidate (move to interview)
  - Reject candidate
  - Request more information

### AI Agent Features (Basic)

- [ ] **Employer Agent Evaluation**
  - One-directional matching (employer evaluates candidates)
  - Basic qualification check
  - Skill matching
  - Experience level validation
  - Generate match score (0-100)
  - Generate match reasoning (text explanation)

- [ ] **Structured Output**
  - Zod schema validation
  - Type-safe agent responses
  - Error handling for invalid outputs

- [ ] **User Chat (Basic)**
  - Chat with personal agent
  - Ask about profile
  - Get job search advice
  - View conversation history

### Technical Infrastructure

- [ ] **T3 Stack Setup**
  - Next.js 15 + React 19
  - tRPC for API layer
  - Prisma + NeonDB
  - Tailwind CSS + shadcn/ui
  - Clerk authentication

- [ ] **Database Schema**
  - Users table
  - Profiles table (job seekers)
  - Jobs table
  - Matches table
  - User settings (API keys, preferences)

- [ ] **Vercel AI SDK Integration**
  - Chat route handlers
  - Streaming responses
  - useChat() hooks

- [ ] **Inngest Workflows (Basic)**
  - Match evaluation workflow
  - Email notification workflow

- [ ] **Feature Flags Setup**
  - Vercel Flags SDK integration
  - MVP flags (all advanced features OFF)

- [ ] **File Storage**
  - Vercel Blob for resume uploads
  - PDF parsing
  - Secure file access

### Deployment & Monitoring

- [ ] **Vercel Deployment**
  - Production environment
  - Preview deployments per PR
  - Environment variables

- [ ] **Basic Monitoring**
  - Sentry for error tracking
  - Vercel Analytics for performance

---

## Phase 2: Beta (Months 4–6)

**Goal**: Add agent intelligence and two-way matching
**Timeline**: 3 months after MVP launch
**Success Metrics**: 1,000+ users, 5,000+ matches, 100+ interview placements, 80%+ match acceptance

### Job Seeker Features (Beta)

- [ ] **Private Negotiation Parameters**
  - Minimum salary requirement (private)
  - Deal-breakers (private list)
  - Preferred industries
  - Work-life balance preferences
  - Training/learning priorities

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

- [ ] **Private Hiring Parameters**
  - Maximum salary budget (private)
  - Willingness to train
  - Urgency level
  - Flexibility on remote/location

- [ ] **Match Insights**
  - View agent conversation transcript
  - See negotiation summary
  - Understand why match succeeded/failed

### AI Agent Features (Advanced)

- [ ] **Two-Way Matching**
  - Job Seeker Agent evaluates jobs
  - Employer Agent evaluates candidates
  - Both must agree for match

- [ ] **Agent-to-Agent Conversations**
  - Multi-turn negotiations (Inngest workflows)
  - Private parameter usage (strategic)
  - Conversation state management
  - Resume after interruption

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

- [ ] **Inngest Workflows (Advanced)**
  - Multi-step agent negotiations
  - Resumable workflows
  - Rate limiting
  - Error handling and retries

- [ ] **AI Gateway Integration**
  - Route all LLM calls through gateway
  - User API keys
  - Caching for repeated evaluations
  - Fallback providers

- [ ] **Vector Search**
  - pgvector integration
  - Generate embeddings for profiles and jobs
  - Semantic similarity search
  - Improve match quality

- [ ] **Feature Flags (Progressive Rollout)**
  - Enable agent-to-agent for beta users
  - Gradual rollout (10% → 50% → 100%)
  - A/B testing different agent prompts

### Testing & Quality

- [ ] **E2E Testing**
  - Playwright test suite
  - Critical user flows
  - Agent conversation testing (mocked)

- [ ] **Unit Testing**
  - 80%+ code coverage
  - Agent logic tests (mocked LLM calls)
  - Database query tests

---

## Phase 3: Full Launch (Months 7–12)

**Goal**: Scale and optimize for growth
**Timeline**: 6 months after beta
**Success Metrics**: 10,000+ users, 50,000+ matches, 1,000+ interview placements, $50k+ MRR

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

- [ ] **Team Features**
  - Multi-user access (5+ team members)
  - Role-based permissions
  - Admin/poster/hiring manager roles
  - Collaboration on candidate reviews

- [ ] **Custom Agent Prompts**
  - Customize evaluation criteria
  - Company-specific requirements
  - Custom scoring weights
  - A/B test different prompts

- [ ] **Advanced Analytics**
  - Candidate pipeline metrics
  - Time-to-hire tracking
  - Source quality analysis
  - Cost-per-hire reporting

- [ ] **Bulk Operations**
  - Upload multiple jobs at once
  - Batch candidate actions
  - Export matches to CSV

### AI Agent Features (Full)

- [ ] **Industry-Specific Templates**
  - Tech/engineering agents
  - Healthcare agents
  - Finance agents
  - Custom templates per industry

- [ ] **Multi-Provider Support**
  - OpenAI + Anthropic + Cohere
  - User choice of provider
  - Automatic fallback
  - Provider comparison

- [ ] **Video Interview Analysis**
  - AI analysis of video interviews
  - Communication skills assessment
  - Technical question evaluation
  - Bias detection

### Revenue & Billing

- [ ] **Subscription Tiers**
  - Free tier (10 matches/month)
  - Pro tier ($29/month)
  - Team tier ($99/month)

- [ ] **Stripe Integration**
  - Payment processing
  - Subscription management
  - Invoicing
  - Usage tracking

- [ ] **Billing Dashboard**
  - Current plan and usage
  - AI cost tracking (user's LLM spend)
  - Upgrade/downgrade flows
  - Payment history

### Technical Infrastructure (Full)

- [ ] **Performance Optimization**
  - AI Gateway caching (50%+ hit rate)
  - Database query optimization
  - Image optimization
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

- [ ] **GDPR Compliance**
  - Data export
  - Right to deletion
  - Privacy policy
  - Cookie consent

- [ ] **SOC 2 Compliance**
  - Security audit
  - Compliance documentation
  - Penetration testing

- [ ] **Advanced Security**
  - Two-factor authentication
  - API key rotation
  - Audit logging
  - DDoS protection

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
- Authentication
- Profile creation
- Basic matching
- Match viewing

### P1 (Should Have)
Features that significantly improve user experience:
- Private parameters
- Agent chat
- Two-way matching
- Tool calling

### P2 (Nice to Have)
Features that add value but aren't critical:
- Custom prompts
- Analytics
- Mobile apps
- API

### P3 (Future)
Features for later phases:
- Video analysis
- Global expansion
- White-labeling

---

## Changelog

### Version 1.0 (2026-02-14)
- Initial roadmap created
- Defined MVP, Beta, and Full Launch phases
- Outlined 100+ features across all phases
- Established prioritization framework

---

**Questions or suggestions?** Open a GitHub Discussion or update this document directly.
