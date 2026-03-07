# Product Requirements Document (PRD)

## JobBobber — AI-Powered Talent Matching Platform

**Document Version:** 1.1
**Date:** February 13, 2026
**Status:** Draft

---

## Table of Contents

1. [Executive Summary](#1-executive-summary)
2. [Problem Statement](#2-problem-statement)
3. [Vision & Objectives](#3-vision--objectives)
4. [Target Users](#4-target-users)
5. [Platform Overview](#5-platform-overview)
6. [Core Features & Requirements](#6-core-features--requirements)
7. [AI Agent Architecture](#7-ai-agent-architecture)
8. [User Flows](#8-user-flows)
9. [Data Model](#9-data-model)
10. [Technology Stack](#10-technology-stack)
11. [Phased Rollout Plan](#11-phased-rollout-plan)
12. [Revenue Model](#12-revenue-model)
13. [Success Metrics](#13-success-metrics)
14. [Security, Privacy & Compliance](#14-security-privacy--compliance)
15. [Risks & Mitigations](#15-risks--mitigations)
16. [Open Questions & Future Considerations](#16-open-questions--future-considerations)

---

## 1. Executive Summary

This document defines the product requirements for **JobBobber**, a next-generation talent matching platform that leverages AI agents to autonomously connect job seekers with employer opportunities. JobBobber replaces the manual, noise-heavy experience of existing professional networks (e.g., LinkedIn) with a streamlined, AI-first approach: humans provide their information, and AI agents handle the screening, negotiation, and matching — delivering a shortlist of interview-ready candidates to employers and interview-ready opportunities to job seekers.

The platform will be built using Claude (Anthropic) as the development AI, with OpenAI (or TBD provider) powering the agentic interactions via API. JobBobber will follow a phased rollout (MVP → Beta → Full), launching initially in the US market with global expansion potential. Agent-to-agent interactions are fully automated with no human intervention until the interview stage. Revenue is generated through subscription tiers for both job seekers and employers.

---

## 2. Problem Statement

### The LinkedIn Problem

LinkedIn has evolved from a professional networking tool into a general-purpose social media platform. The signal-to-noise ratio has deteriorated significantly — personal opinion posts, political commentary, and engagement-bait content now dominate feeds, making it increasingly difficult to evaluate genuine professional talent from a profile alone.

### The Job Seeker Problem

Job seekers routinely spend 20–40+ hours per week searching for and applying to jobs. A single person may submit hundreds or thousands of applications over weeks or months before landing a single offer that matches their skills, experience, and compensation expectations. The process is manual, repetitive, and emotionally draining.

### The Employer Problem

Employers invest thousands to millions of dollars in human hours to post jobs, screen applicants, manage communications, and coordinate interviews. A single job posting can generate hundreds of applicants, the vast majority of whom are unqualified or misaligned. Human recruiters cannot deeply evaluate every applicant, leading to missed talent and wasted resources.

### The Profile Accuracy Problem

Traditional profiles are inherently unreliable. A highly skilled professional may present a mediocre profile due to poor self-marketing, while a less qualified candidate may present an impressive but inflated or fabricated profile. There is no systematic mechanism to validate, probe, or contextualize the claims made in a static profile — until now.

---

## 3. Vision & Objectives

### Vision

To become the definitive platform for connecting human talent with employer opportunities by letting AI do the heavy lifting — eliminating the manual grind of job searching and applicant screening, and delivering higher-quality matches than any human-driven process.

### Primary Objectives

- **Reduce time-to-match** for job seekers from weeks/months to days.
- **Reduce employer screening costs** by automating the top-of-funnel evaluation process.
- **Improve match quality** by using AI agents that can probe, validate, and contextualize candidate qualifications beyond what a static profile reveals.
- **Eliminate noise** by building a platform with zero social feed, zero opinion posts — purely focused on talent-to-opportunity matching.
- **Empower private negotiation** by allowing both parties to set confidential parameters (salary flexibility, training willingness, etc.) that their AI agents use strategically during matching.

---

## 4. Target Users

### 4.1 Job Seekers

Individual professionals seeking employment opportunities. They create a personal candidate profile and delegate the search-and-screen process to their AI agent.

**Characteristics:**

- Range from entry-level to executive
- Varying levels of technical and self-marketing proficiency
- Want to minimize time spent on applications
- Have private preferences they don't want disclosed upfront (salary flexibility, location flexibility, deal-breakers)

### 4.2 Employers

Companies and organizations seeking to fill open positions. They create an organizational profile with one or more job postings and delegate the screening process to their AI agent.

**Characteristics:**

- Range from startups to enterprise organizations
- May have one or many open positions simultaneously
- Have private hiring parameters they don't want disclosed publicly (max salary, willingness to train, urgency)
- Need multiple human users per account (admins, individual job posters, hiring managers)

---

## 5. Platform Overview

### Core Philosophy

Humans provide information. AI does the work. Humans meet for interviews.

### How It Works (High Level)

1. **Job Seekers** create a profile: resume, bio, URLs, expertise details, and private settings (compensation expectations, flexibility parameters).
2. **Employers** create a company profile and job postings: company info, URLs, job requirements, compensation, benefits, and private settings (salary ceilings, training flexibility).
3. **AI Agents are activated.** Each job seeker profile gets a Job Seeker Agent. Each employer profile/job posting gets an Employer Agent.
4. **Agents autonomously interact.** Employer Agents search the platform and initiate conversations with Job Seeker Agents. These conversations evaluate fit, probe qualifications, and negotiate alignment — all without human involvement.
5. **Matches are delivered.** When agents determine a strong match, both the job seeker and employer are notified with a match summary and recommendation to proceed to a human interview.

### What This Platform Is NOT

- It is **not** a social media platform. There is no feed, no posts, no likes, no comments.
- It is **not** a job board. Job seekers do not browse and apply to listings manually.
- It is **not** a messaging platform between humans (pre-interview). All pre-interview communication happens between AI agents.

---

## 6. Core Features & Requirements

### 6.1 Authentication & User Management

| Requirement         | Details                                                                    |
| ------------------- | -------------------------------------------------------------------------- |
| Auth Provider       | Clerk                                                                      |
| Job Seeker Accounts | Individual accounts, one profile per person                                |
| Employer Accounts   | Organizational accounts with role-based access (Admin, Job Poster, Viewer) |
| Role Management     | Employer admins can invite/remove team members, assign roles               |
| SSO Support         | Future consideration for enterprise employers                              |

### 6.2 Job Seeker Profile

**Public Profile Fields:**

- Full name and professional headline
- Bio / professional summary
- Resume upload (PDF, DOCX) with parsed extraction
- Cover letter (optional)
- Work experience (structured + freeform)
- Education and certifications
- Skills and expertise areas
- Portfolio URLs (personal website, GitHub, blog, etc.)
- Social/professional URLs (optional)
- Location and relocation preferences

**Private Settings (Agent-Only, Not Publicly Visible):**

- Minimum acceptable salary (overall and per-job-type)
- Salary flexibility rules (e.g., "will consider $80K if remote" or "require $120K+ for management roles")
- Deal-breakers (e.g., no relocation, no travel >20%)
- Priorities ranking (compensation, culture, growth, remote, title, etc.)
- Industries or companies to exclude
- Custom agent prompt / instructions (see Section 6.4)

### 6.3 Employer Profile

**Public Company Profile Fields:**

- Company name, logo, and description
- Industry and company size
- Company culture summary
- Headquarters location and office locations
- Company URLs (website, careers page, press, etc.)
- Benefits overview (global to company)

**Job Posting Fields (per posting):**

- Job title and department
- Job description and responsibilities
- Required qualifications and skills
- Preferred qualifications
- Experience level (entry, mid, senior, executive)
- Employment type (full-time, part-time, contract)
- Location (on-site, hybrid, remote) and geographic requirements
- Compensation range (public-facing range)
- Benefits specific to role
- "Why apply" narrative — the compelling case for the role

**Private Employer/Job Settings (Agent-Only, Not Publicly Visible):**

- True maximum salary for ideal candidate
- Minimum acceptable candidate qualifications (vs. preferred)
- What the employer is willing to train vs. requires day-one
- Urgency level and timeline to fill
- Internal priority ranking of candidate attributes
- Custom agent instructions

### 6.4 Custom Agent Prompting (Advanced Feature)

Both job seekers and employers can provide a custom prompt in their settings that influences how their AI agent represents them during agent-to-agent interactions.

**Purpose:**

- Allows savvy users to differentiate themselves through prompt engineering skill
- Demonstrates a user's understanding of AI — itself a valuable professional signal
- Enables nuanced agent behavior beyond structured fields

**Design Considerations:**

- The prompt operates within platform-defined guardrails (cannot override core agent behavior, ethical guidelines, or matching rules)
- A well-crafted prompt can improve match quality; a poor or adversarial prompt may reduce it
- The platform should provide example prompts and guidance for users unfamiliar with prompting
- Prompt quality itself becomes a soft signal of candidate capability in relevant roles

### 6.5 Dashboard & Notifications

**Job Seeker Dashboard:**

- Agent activity metrics: total agent conversations, conversations in progress, % resulting in interviews
- Match notifications with match summary (why this match was recommended)
- Match status tracking (new match → interview requested → interview scheduled → outcome)
- Profile completeness score and suggestions
- Agent conversation logs (read-only transparency into what the agent discussed)
- **Aggregate Feedback Insights** (private): AI-generated summary of what makes the job seeker attractive to employers and what patterns are causing rejections, with trend data over time (see Section 7.2.1)

**Employer Dashboard:**

- Per-job-posting agent activity metrics: total conversations, in progress, % resulting in interviews
- Candidate match notifications with match summaries
- Pipeline view across all job postings
- Candidate comparison tools for matched candidates
- Agent conversation logs per candidate interaction
- Team activity (which team members posted/reviewed what)
- **Aggregate Feedback Insights** (private): AI-generated summary of what makes the employer/posting attractive to candidates and what patterns are causing candidate agents to decline, with trend data over time (see Section 7.2.1)

### 6.6 Match Delivery & Interview Handoff

When the Employer Agent and Job Seeker Agent reach consensus that a match warrants a human interview:

- Both parties receive a **Match Notification**
- The notification includes a **Match Summary**: an AI-generated brief explaining why this match was recommended, key alignment points, and any noted areas of potential misalignment
- The notification includes a **Confidence Score** (e.g., Strong Match, Good Match, Potential Match)
- Both parties can accept or decline the match
- If both accept → the platform provides the **employer** with the job seeker's contact information and schedule availability, so the employer can reach out directly to facilitate the interview and onboarding process outside of JobBobber

**Design Rationale:** Once a match is accepted by both parties, the interview and hiring process is handed off to the employer. This allows employers to use their existing CRM, ATS, scheduling tools, and onboarding systems without introducing redundant workflows. JobBobber's value ends at delivering the right match — the employer owns the relationship from interview onward.

**Interview Scheduling (TBD):** Either integrate with a scheduling tool (e.g., Calendly) or provide a structured data export (job seeker contact info, availability windows) that both parties can use to coordinate via their preferred method.

---

## 7. AI Agent Architecture

### 7.1 Agent Types

**Job Seeker Agent**

- Represents a single job seeker
- Ingests and understands all profile data (public and private)
- Can ask the human job seeker clarifying questions during initial onboarding to build richer context
- Responds to inquiries from Employer Agents
- Evaluates opportunities against the job seeker's stated and inferred preferences
- Advocates for the job seeker's interests during agent-to-agent conversations

**Employer Agent**

- Represents an employer and one or more job postings
- Ingests and understands all company data, job posting data, and private settings
- Proactively searches the platform for candidate profiles matching job requirements
- Initiates conversations with Job Seeker Agents
- Evaluates candidates against job requirements and private hiring criteria
- Can probe and ask clarifying questions through the Job Seeker Agent

### 7.2 Agent-to-Agent Interaction Model

Interactions are **fully automated** with no human-in-the-loop until a match is surfaced for interview.

**Conversation Flow:**

1. **Discovery:** Employer Agent identifies candidate profiles that meet baseline criteria through semantic search and structured filtering.
2. **Initial Screening:** Employer Agent initiates a conversation with the Job Seeker Agent. Both agents exchange high-level information about fit.
3. **Deep Evaluation:** Agents engage in multi-turn dialogue. The Employer Agent may probe specific skills, experience claims, or scenario-based questions. The Job Seeker Agent responds based on profile context and private instructions, and may counter-probe about the role, culture, and growth opportunities.
4. **Negotiation Alignment:** Agents evaluate compatibility on private parameters (salary expectations vs. budget, location flexibility, etc.) without disclosing exact figures — instead converging on whether alignment exists.
5. **Match Decision:** If both agents determine sufficient alignment, a match is generated and surfaced to both humans. If not, the conversation concludes with no notification to either party about the specifics of that interaction.

### 7.2.1 Aggregate Feedback Insights (Private)

While individual rejection details are never disclosed, JobBobber continuously aggregates patterns from all agent-to-agent conversations to generate **private feedback insights** for each user. These insights are visible only to the user in a private section of their dashboard (not publicly visible on their profile).

**Job Seeker Feedback Insights (examples):**

- "Employers tend to pass on your profile because it lacks demonstration of technical understanding relevant to the roles you're targeting."
- "Your experience depth in project management is a strong signal — employers are engaging positively on this area."
- "Compensation expectations are misaligned for 60% of roles your agent has evaluated. Consider adjusting salary flexibility or targeting different role levels."

**Employer Feedback Insights (examples):**

- "Talented job seekers are passing on your posting because the in-office work requirement is a deal-breaker for the majority of qualified candidates."
- "Your compensation range is competitive — most candidates your agent engages find alignment here."
- "Job seekers with senior-level expertise are not engaging because the job description reads as mid-level."

**Dashboard Metrics (visible alongside insights):**

- Total number of agent conversations initiated/received
- Conversations currently in progress
- Percentage of conversations that resulted in a match recommendation
- Percentage of matches accepted by both parties (interview conversion rate)
- Trend data over time (improving, declining, stable)

These insights empower users to refine their profiles, job postings, and private settings based on real market signal — without ever exposing individual conversation outcomes or the identity of the other party.

### 7.3 Agent Guardrails & Ethics

- Agents must not fabricate or embellish information about their principal (job seeker or employer)
- Agents must not disclose private settings or exact private figures to the opposing agent
- Agents must operate within platform-defined ethical guidelines (no discrimination based on protected characteristics)
- Agent conversations are logged and auditable
- Agents cannot make binding commitments — they can only recommend matches for human decision
- Custom prompts are sandboxed and cannot override core agent policies

### 7.4 Profile Validation & Intelligence

One of the platform's key differentiators is that AI agents can go beyond static profile review:

- **Contextual Probing:** The Employer Agent can ask the Job Seeker Agent scenario-based or domain-specific questions to validate claimed expertise.
- **URL Ingestion:** Agents can access and analyze URLs provided in profiles (personal sites, GitHub repos, blogs, published articles) to build a richer picture of capability.
- **Cross-Reference Analysis:** Agents can identify inconsistencies or gaps in a profile and weigh them in match scoring.
- **Skill Depth Assessment:** Rather than treating "Python" as a binary skill checkbox, agents can evaluate the depth and relevance of the skill through dialogue.

---

## 8. User Flows

### 8.1 Job Seeker Flow

```
Sign Up (Clerk Auth)
    → Create Profile
        → Upload resume / paste info / provide URLs
        → Fill structured fields (experience, skills, education)
        → Configure Private Settings (salary, flexibility, deal-breakers)
        → (Optional) Write custom agent prompt
    → Agent Onboarding
        → Agent reviews profile, asks clarifying questions
        → Job seeker answers, agent refines understanding
    → Agent Activated
        → Agent begins responding to Employer Agent inquiries
        → Agent evaluates inbound opportunities
    → Match Notification
        → Review match summary
        → Accept or Decline
    → If Both Accept: Employer receives job seeker contact info + availability
    → Interview (managed by employer outside JobBobber)
```

### 8.2 Employer Flow

```
Sign Up (Clerk Auth)
    → Create Company Profile
        → Company info, culture, URLs, benefits
        → Invite team members, assign roles
    → Create Job Posting(s)
        → Job details, requirements, compensation, "why apply"
        → Configure Private Job Settings (true max salary, training willingness, urgency)
        → (Optional) Write custom agent prompt per job
    → Agent Activated
        → Agent searches candidate pool
        → Agent initiates conversations with Job Seeker Agents
        → Agent evaluates and screens autonomously
    → Match Notification
        → Review match summary and candidate brief
        → Accept or Decline
    → If Both Accept: Receive job seeker contact info + availability
    → Interview (managed by employer using their own systems)
```

### 8.3 Agent-to-Agent Conversation Flow

```
Employer Agent: Discovery search → identifies candidate pool
    → Initiates conversation with Job Seeker Agent
        → Employer Agent: "Evaluating for [Role]. Key requirements: X, Y, Z."
        → Job Seeker Agent: "Candidate has X (5 years), Y (project lead), Z (certified)."
        → Employer Agent: "Probing on Y — describe scope of project leadership."
        → Job Seeker Agent: [Responds with contextual detail from profile/URLs]
        → Employer Agent: "Evaluating compensation alignment..."
        → Job Seeker Agent: "Candidate's expectations are within discussed range for this role type."
        → [Both agents evaluate private parameters internally]
    → Match Decision
        → Consensus reached → Match surfaced to both humans
        → No consensus → Conversation archived, no notification
```

---

## 9. Data Model

### 9.1 Core Entities

```
┌─────────────────┐     ┌──────────────────┐     ┌─────────────────┐
│   JobSeeker      │     │    Employer       │     │   JobPosting     │
├─────────────────┤     ├──────────────────┤     ├─────────────────┤
│ id               │     │ id               │     │ id               │
│ clerkUserId      │     │ clerkOrgId       │     │ employerId       │
│ name             │     │ name             │     │ title            │
│ headline         │     │ industry         │     │ description      │
│ bio              │     │ size             │     │ requirements     │
│ resumeUrl        │     │ description      │     │ preferredQuals   │
│ parsedResume     │     │ culture          │     │ experienceLevel  │
│ experience[]     │     │ headquarters     │     │ employmentType   │
│ education[]      │     │ locations[]      │     │ locationType     │
│ skills[]         │     │ websiteUrl       │     │ salaryRange      │
│ urls[]           │     │ urls[]           │     │ benefits         │
│ location         │     │ benefits         │     │ whyApply         │
│ createdAt        │     │ createdAt        │     │ status           │
│ updatedAt        │     │ updatedAt        │     │ createdAt        │
└────────┬────────┘     └────────┬─────────┘     └────────┬────────┘
         │                       │                         │
         ▼                       ▼                         ▼
┌─────────────────┐     ┌──────────────────┐     ┌─────────────────┐
│ SeekerSettings   │     │ EmployerMember   │     │ JobSettings      │
│ (private)        │     ├──────────────────┤     │ (private)        │
├─────────────────┤     │ id               │     ├─────────────────┤
│ seekerId         │     │ employerId       │     │ jobPostingId     │
│ minSalary        │     │ clerkUserId      │     │ truMaxSalary     │
│ salaryRules{}    │     │ role (enum)      │     │ minQualOverride  │
│ dealBreakers[]   │     │ invitedBy        │     │ willingToTrain[] │
│ priorities[]     │     │ joinedAt         │     │ urgency          │
│ exclusions[]     │     └──────────────────┘     │ priorityAttrs[]  │
│ customPrompt     │                               │ customPrompt     │
│ notifPrefs{}     │                               └─────────────────┘
└─────────────────┘

┌────────────────────┐     ┌─────────────────────┐
│ AgentConversation   │     │       Match          │
├────────────────────┤     ├─────────────────────┤
│ id                  │     │ id                   │
│ employerAgentId     │     │ conversationId       │
│ seekerAgentId       │     │ jobPostingId         │
│ jobPostingId        │     │ seekerId             │
│ status              │     │ employerId           │
│ messages[]          │     │ confidenceScore      │
│ startedAt           │     │ matchSummary         │
│ completedAt         │     │ seekerStatus (enum)  │
│ outcome             │     │ employerStatus (enum)│
└────────────────────┘     │ seekerContactInfo    │
                            │ seekerAvailability   │
                            │ createdAt            │
                            └─────────────────────┘

┌──────────────────────┐
│  FeedbackInsights     │
├──────────────────────┤
│ id                    │
│ userId                │
│ userType (enum)       │
│ strengths[]           │
│ weaknesses[]          │
│ recommendations[]     │
│ totalConversations    │
│ inProgressCount       │
│ matchRate             │
│ interviewConversion   │
│ trendDirection (enum) │
│ generatedAt           │
│ updatedAt             │
└──────────────────────┘
```

### 9.2 Key Enums

- **EmployerMemberRole:** `admin`, `job_poster`, `viewer`
- **JobPostingStatus:** `draft`, `active`, `paused`, `closed`, `filled`
- **ConversationStatus:** `in_progress`, `completed_match`, `completed_no_match`, `terminated`
- **MatchConfidence:** `strong`, `good`, `potential`
- **MatchPartyStatus:** `pending`, `accepted`, `declined`, `expired`

---

## 10. Technology Stack

| Layer                    | Technology                             | Rationale                                            |
| ------------------------ | -------------------------------------- | ---------------------------------------------------- |
| **Frontend**             | Vue 3 + Vite                           | Modern reactive framework, fast dev experience       |
| **Styling**              | Tailwind CSS                           | Utility-first, rapid UI development                  |
| **Authentication**       | Clerk                                  | Managed auth with org/role support, SSO-ready        |
| **Database**             | NeonDB (PostgreSQL)                    | Serverless Postgres, scalable, cost-efficient        |
| **ORM**                  | Drizzle or Prisma                      | Type-safe database access (TBD)                      |
| **Backend/API**          | Node.js (Express or Nitro)             | JavaScript ecosystem alignment with Vue              |
| **AI/LLM (Development)** | Anthropic Claude (Claude Max)          | Platform development and code generation             |
| **AI/LLM (Agentic)**     | OpenAI API (or TBD provider)           | Agent reasoning, conversation, evaluation at runtime |
| **Agent Framework**      | LangChain / LangGraph / CrewAI (TBD)   | Multi-agent orchestration and workflow management    |
| **Vector Database**      | Pinecone / pgvector (NeonDB extension) | Semantic search for profile-to-job matching          |
| **File Storage**         | AWS S3 / Cloudflare R2                 | Resume and document storage                          |
| **Search**               | pgvector + semantic embeddings         | Profile and job posting similarity search            |
| **Job Queue**            | BullMQ / Inngest                       | Async agent conversation processing                  |
| **Hosting**              | Vercel / AWS / Railway (TBD)           | Frontend and API deployment                          |
| **Monitoring**           | Sentry + PostHog                       | Error tracking and product analytics                 |

### Technology Decisions to Finalize

- ORM selection (Drizzle vs. Prisma)
- Primary LLM provider and model(s) for agents
- Agent orchestration framework
- Vector storage strategy (dedicated vector DB vs. pgvector)
- Hosting and deployment platform
- Real-time notification mechanism (WebSockets, SSE, polling)

---

## 11. Phased Rollout Plan

### Phase 1: MVP (Months 1–3)

**Goal:** Prove the core matching loop works.

**Scope:**

- Job seeker profile creation (structured fields + resume upload)
- Employer profile and single job posting creation
- Basic AI agent matching (one-directional: Employer Agent evaluates Job Seeker profiles)
- Simple match scoring and notification
- Clerk auth for both user types
- Basic dashboards showing matches

**Out of Scope for MVP:**

- Agent-to-agent multi-turn conversations
- Custom agent prompting
- Private settings / negotiation logic
- URL ingestion and analysis
- Multi-member employer accounts
- Subscription billing

### Phase 2: Beta (Months 4–6)

**Goal:** Enable full agent-to-agent interaction and private negotiation.

**Scope:**

- Full agent-to-agent conversation system
- Private settings for both job seekers and employers
- Salary/compensation negotiation alignment
- Multi-turn probing and evaluation conversations
- Agent conversation logs visible to users
- Multi-member employer accounts with roles
- Profile completeness scoring and guidance
- URL ingestion (personal sites, GitHub, etc.)
- Match summary generation with confidence scores
- Basic subscription gating

### Phase 3: Full Launch (Months 7–10)

**Goal:** Complete platform with all features, billing, and scale.

**Scope:**

- Custom agent prompting (advanced feature)
- Full subscription tier system with billing integration
- Advanced employer dashboard (pipeline view, candidate comparison)
- Interview scheduling facilitation
- Agent performance analytics (match acceptance rates, time-to-match)
- Platform-wide analytics and reporting
- Mobile-responsive optimization
- Onboarding experience polish
- Public marketing site and launch

### Phase 4: Post-Launch (Ongoing)

- Mobile native apps (iOS/Android)
- Enterprise SSO and advanced admin features
- Industry-specific agent specializations
- Skills assessment integrations
- API for ATS (Applicant Tracking System) integrations
- Referral and networking features (non-social-media)
- Continuous agent model improvements based on match outcome data

---

## 12. Revenue Model

### Subscription Tiers

#### Job Seeker Tiers

| Tier     | Price  | Features                                                                                                                                                                |
| -------- | ------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Free** | $0/mo  | Profile creation, limited agent activity (capped agent conversations/month), basic match notifications, basic dashboard                                                 |
| **Pro**  | $39/mo | Unlimited agent activity, full private settings, priority agent processing, match analytics, aggregate feedback insights, custom agent prompting, advanced URL analysis |

#### Employer Tiers

| Tier           | Price               | Features                                                                                                                                                                                                                          |
| -------------- | ------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Free**       | $0/mo               | Company profile, 1 active job posting, limited agent conversations/month, basic matching and notifications                                                                                                                        |
| **Business**   | $99/mo              | Limited number of active job postings (with ability to purchase additional postings à la carte), unlimited agent conversations, multi-member accounts, pipeline dashboard, aggregate feedback insights, full private job settings |
| **Enterprise** | Contact for pricing | Unlimited job postings, priority matching, access to future features, dedicated support, API access, custom integrations, SLA                                                                                                     |

### Pricing Strategy Notes

- Job seeker free tier is essential for building the candidate pool (supply side of the marketplace)
- Employer tiers are the primary revenue driver; the à la carte posting add-on provides incremental revenue at the Business tier
- Enterprise tier pricing is custom to allow flexibility for large organizations with high-volume hiring needs
- Consider introductory pricing during Beta phase
- À la carte job posting pricing (Business tier) TBD

---

## 13. Success Metrics

### Primary KPIs

| Metric                     | Definition                                                   | Target (Year 1) |
| -------------------------- | ------------------------------------------------------------ | --------------- |
| **Time-to-Match**          | Average time from profile activation to first accepted match | < 7 days        |
| **Match Acceptance Rate**  | % of agent-recommended matches accepted by both parties      | > 40%           |
| **Interview-to-Hire Rate** | % of platform-facilitated interviews that result in a hire   | > 25%           |
| **Job Seeker Activation**  | % of registered job seekers with complete profiles           | > 60%           |
| **Employer Activation**    | % of registered employers with at least 1 active posting     | > 70%           |

### Secondary KPIs

| Metric                         | Definition                                               |
| ------------------------------ | -------------------------------------------------------- |
| **Agent Conversation Quality** | Average conversation depth (turns) and relevance scoring |
| **Profile Completeness**       | Average completeness score across all user types         |
| **Platform NPS**               | Net Promoter Score from both job seekers and employers   |
| **Churn Rate**                 | Monthly subscriber churn by tier and user type           |
| **Cost per Match**             | Infrastructure + LLM cost per successful match           |

---

## 14. Security, Privacy & Compliance

### Data Privacy

- **Private settings are never exposed** to the opposing party, other users, or in any public-facing context. Only the user's own AI agent accesses this data.
- Agent-to-agent conversations must not leak private parameters (exact salary numbers, deal-breaker specifics). Agents discuss alignment in abstract terms ("within range," "aligned," "misaligned").
- Users can delete their profile and all associated data at any time (right to deletion).
- All data at rest is encrypted. All data in transit uses TLS.

### Agent Conversation Data

- All agent conversations are logged and stored.
- Users can view conversations their agent participated in.
- Conversation data is used to improve matching algorithms (with appropriate anonymization).
- Users can opt out of data being used for model improvement.

### Compliance Considerations

- **GDPR:** Applicable for EU users post-global expansion — data portability, right to deletion, consent management. Architecture should be GDPR-aware from day one.
- **CCPA:** Applicable for California users at launch — disclosure and deletion rights.
- **EEOC / Anti-Discrimination:** Agent matching logic must not discriminate based on protected characteristics (race, gender, age, disability, religion, etc.). Regular bias auditing of agent behavior is required.
- **SOC 2:** Target for enterprise employer trust (Phase 4).

### Authentication Security

- Clerk handles auth security, MFA support, session management.
- Employer role-based access enforced at API level.
- API rate limiting and abuse detection.

---

## 15. Risks & Mitigations

| Risk                                                        | Impact   | Likelihood | Mitigation                                                                                                       |
| ----------------------------------------------------------- | -------- | ---------- | ---------------------------------------------------------------------------------------------------------------- |
| **Cold start problem** — not enough candidates or employers | High     | High       | Launch with targeted industry verticals; seed candidate pool with partnerships; offer generous free tiers        |
| **Agent hallucination / fabrication**                       | High     | Medium     | Strict guardrails; agents only reference verified profile data; conversation auditing                            |
| **Private data leakage via agents**                         | Critical | Low–Medium | Rigorous prompt engineering; red-team testing; agent output filtering                                            |
| **Match quality is poor**                                   | High     | Medium     | Human feedback loops on match outcomes; continuous model tuning; A/B test agent strategies                       |
| **LLM cost at scale**                                       | Medium   | High       | Optimize conversation length; use smaller models for screening, larger for deep evaluation; caching and batching |
| **Adversarial custom prompts**                              | Medium   | Medium     | Sandbox prompt execution; content filtering; prompt injection detection                                          |
| **Bias in matching**                                        | Critical | Medium     | Regular bias audits; diverse training/testing data; third-party fairness assessments                             |
| **User trust in fully automated agents**                    | High     | Medium     | Transparent conversation logs; match explanations; gradual trust-building through accuracy                       |

---

## 16. Open Questions & Future Considerations

### Open Questions

1. ~~**Platform Name:**~~ → **Resolved: JobBobber**
2. ~~**Pricing:**~~ → **Resolved: See Section 12** (à la carte posting price TBD)
3. ~~**LLM Selection:**~~ → **Resolved: Claude Max for development; OpenAI or TBD for agentic API**
4. **Agent Framework:** LangChain, LangGraph, CrewAI, or custom orchestration? (TBD)
5. **Conversation Limits:** How many agent conversations per match attempt? What's the max depth?
6. ~~**Rejection Transparency:**~~ → **Resolved: No individual rejection notifications. Aggregate feedback insights provided privately (see Section 7.2.1)**
7. **Profile Verification:** Should the platform offer identity or credential verification (e.g., LinkedIn import, education verification)?
8. ~~**Geography:**~~ → **Resolved: US-only initial launch with global integration potential**
9. **Industry Focus:** Should MVP target a specific industry vertical or go horizontal? (TBD — leaning toward targeted vertical)
10. ~~**Interview Scheduling:**~~ → **Resolved: TBD — either integrate with Calendly/similar or provide data export for employer-managed scheduling (see Section 6.6)**

### Future Considerations

- **Skills Assessments:** Integrate optional coding challenges, case studies, or domain assessments that agents can reference.
- **Employer Reviews:** Allow hired candidates to review employers (Glassdoor-like, but verified).
- **Career Coaching Agent:** A separate AI agent that helps job seekers improve their profiles, identify skill gaps, and suggest development paths.
- **Networking (Non-Social):** Facilitate professional introductions between non-competing professionals based on mutual benefit — without the social media noise.
- **ATS Integration:** Allow employers to sync matches directly into their existing applicant tracking systems.
- **Mobile Apps:** Native iOS and Android applications.
- **Referral System:** Allow users to refer candidates with referral context that agents can use.

---

## Appendix A: Competitive Landscape

| Platform                                | Strength                           | Weakness vs. JobBobber                                      |
| --------------------------------------- | ---------------------------------- | ----------------------------------------------------------- |
| **LinkedIn**                            | Massive network, brand recognition | Noise-heavy, static profiles, manual search, no AI matching |
| **Indeed / ZipRecruiter**               | Large job board, resume matching   | Keyword-based matching, no deep evaluation, one-directional |
| **Hired / Vettery**                     | Curated matching, employer-pays    | Limited to tech, human curation doesn't scale               |
| **AI Recruiting Tools (HireVue, etc.)** | AI-assisted screening              | Employer-side only, no candidate advocacy agent             |

JobBobber's differentiator is **dual-agent advocacy** — both sides have an AI agent working in their interest, creating a balanced, intelligent, and efficient matching marketplace.

---

## Appendix B: Glossary

| Term                            | Definition                                                                                                                                                                                                   |
| ------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| **Job Seeker Agent**            | AI agent that represents and advocates for a job seeker during the matching process                                                                                                                          |
| **Employer Agent**              | AI agent that represents an employer and its job postings during the matching process                                                                                                                        |
| **Agent-to-Agent Conversation** | An automated dialogue between a Job Seeker Agent and an Employer Agent to evaluate match potential                                                                                                           |
| **Match**                       | A platform-generated recommendation that a job seeker and employer should proceed to a human interview                                                                                                       |
| **Private Settings**            | User-configured parameters visible only to their own AI agent, never disclosed to other parties                                                                                                              |
| **Custom Agent Prompt**         | User-authored instructions that influence their agent's behavior and strategy                                                                                                                                |
| **Match Summary**               | AI-generated explanation of why a match was recommended, including key alignment points                                                                                                                      |
| **Confidence Score**            | Platform rating of match quality (Strong, Good, Potential)                                                                                                                                                   |
| **Aggregate Feedback Insights** | Private, AI-generated summary derived from all agent conversations showing a user what makes them attractive and what patterns cause rejections — without revealing specifics of any individual conversation |

---

_This is a living document. It will be updated as decisions are made on open questions and as the product evolves through each phase._
