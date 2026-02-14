# JobBobber - Project-Specific Claude Instructions

This file contains project-specific patterns, conventions, and instructions for working on the JobBobber codebase.

## Architecture Overview

**Stack**: Hybrid T3 Stack (Next.js + tRPC + Prisma + Inngest)

**Key Principles**:
1. **Full-stack type safety**: tRPC + Prisma ensure types flow from database to UI
2. **Long-running workflows**: Inngest handles AI agent conversations (no timeout limits)
3. **Organization support**: Clerk provides built-in multi-tenant auth for employer teams
4. **Vector search**: pgvector extension in NeonDB (no separate vector DB)

## Directory Structure Patterns

### tRPC Router Organization

```typescript
src/server/api/
├── root.ts              // Main router composition
├── trpc.ts              // tRPC context & middleware setup
└── routers/
    ├── user.ts          // User management
    ├── profile.ts       // Job seeker/employer profiles
    ├── job.ts           // Job postings
    ├── match.ts         // Matching logic
    └── agent.ts         // AI agent interactions
```

**Convention**: One router per domain entity, compose in `root.ts`

### Inngest Functions

```typescript
src/server/inngest/
├── client.ts            // Inngest client setup
└── functions/
    ├── match-agent.ts   // Run matching algorithm
    ├── conversation.ts  // Multi-turn agent conversations
    └── embeddings.ts    // Generate/update vector embeddings
```

**Convention**: Each Inngest function is a separate file with typed step functions

### Component Organization

```typescript
src/components/
├── ui/                  // shadcn/ui primitives
├── forms/               // Form components with zod validation
├── layouts/             // Layout wrappers
├── profile/             // Profile-specific components
├── matching/            // Matching-related components
└── dashboard/           // Dashboard components
```

**Convention**: Feature-based organization, colocate related components

## Code Patterns

### 1. tRPC Procedures

**Always use Zod for input validation:**

```typescript
// src/server/api/routers/profile.ts
import { z } from "zod";
import { createTRPCRouter, protectedProcedure } from "~/server/api/trpc";

export const profileRouter = createTRPCRouter({
  create: protectedProcedure
    .input(z.object({
      title: z.string().min(1).max(100),
      bio: z.string().max(500),
      skills: z.array(z.string()),
    }))
    .mutation(async ({ ctx, input }) => {
      return ctx.db.profile.create({
        data: {
          ...input,
          userId: ctx.session.user.id,
        },
      });
    }),
});
```

### 2. Inngest Workflows

**Use typed step functions for resumable workflows:**

```typescript
// src/server/inngest/functions/conversation.ts
import { inngest } from "../client";

export const agentConversation = inngest.createFunction(
  { id: "agent-conversation" },
  { event: "agent/conversation.start" },
  async ({ event, step }) => {
    // Step 1: Load profiles (resumable)
    const profiles = await step.run("load-profiles", async () => {
      return db.profile.findMany({
        where: { id: { in: [event.data.seekerId, event.data.employerId] } }
      });
    });

    // Step 2: Generate embeddings
    const embeddings = await step.run("generate-embeddings", async () => {
      return generateEmbeddings(profiles);
    });

    // Step 3: Multi-turn conversation (can take minutes)
    const result = await step.run("run-conversation", async () => {
      return runAgentConversation(profiles, embeddings);
    });

    return result;
  }
);
```

**Why**: Each `step.run()` is resumable - if function times out, it resumes from last completed step

### 3. Prisma Queries

**Use Prisma Client Extensions for common patterns:**

```typescript
// src/server/db/client.ts
import { PrismaClient } from "@prisma/client";

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

export const db = globalForPrisma.prisma ?? new PrismaClient({
  log: process.env.NODE_ENV === "development"
    ? ["query", "error", "warn"]
    : ["error"],
});

if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = db;
```

**Include patterns for vector search:**

```typescript
// Vector similarity search using pgvector
const similarProfiles = await db.$queryRaw`
  SELECT id, title,
    1 - (embedding <=> ${embedding}::vector) as similarity
  FROM profiles
  WHERE 1 - (embedding <=> ${embedding}::vector) > 0.8
  ORDER BY similarity DESC
  LIMIT 10
`;
```

### 4. Clerk Authentication

**Access user organizations in tRPC context:**

```typescript
// src/server/api/trpc.ts
export const createTRPCContext = async (opts: { headers: Headers }) => {
  const session = await auth();

  return {
    session,
    db,
    userId: session?.userId,
    orgId: session?.orgId,  // For employer teams
  };
};
```

**Protect employer-only routes:**

```typescript
export const employerProcedure = protectedProcedure.use(async ({ ctx, next }) => {
  if (!ctx.session?.orgId) {
    throw new TRPCError({ code: "FORBIDDEN" });
  }
  return next({ ctx: { ...ctx, orgId: ctx.session.orgId } });
});
```

## AI Agent Architecture

### Overview: Three-Layer Agent System

```
┌─────────────────────────────────────────────────────────────┐
│  Layer 1: User-Facing Chat (Vercel AI SDK)                  │
│  • Real-time streaming responses                             │
│  • React hooks (useChat, useCompletion)                      │
│  • User <-> Their Agent conversations                        │
└─────────────────────────────────────────────────────────────┘
                              │
┌─────────────────────────────▼───────────────────────────────┐
│  Layer 2: API Orchestration (tRPC + Route Handlers)         │
│  • Trigger Inngest workflows                                 │
│  • Stream responses to UI                                    │
│  • Type-safe endpoints                                       │
└─────────────────────────────────────────────────────────────┘
                              │
┌─────────────────────────────▼───────────────────────────────┐
│  Layer 3: Agent-to-Agent (Inngest + OpenAI SDK)             │
│  • Multi-turn negotiations                                   │
│  • Structured outputs with Zod                               │
│  • No timeout limits                                         │
└─────────────────────────────────────────────────────────────┘
```

### 1. User-Facing Chat (Vercel AI SDK)

**Setup Vercel AI SDK route handler:**

```typescript
// src/app/api/chat/seeker/route.ts
import { OpenAIStream, StreamingTextResponse } from 'ai';
import { openai } from '~/lib/openai';
import { auth } from '@clerk/nextjs';

export const runtime = 'edge'; // Optional: use edge runtime

export async function POST(req: Request) {
  const { userId } = auth();
  if (!userId) {
    return new Response('Unauthorized', { status: 401 });
  }

  const { messages } = await req.json();

  // Get user's profile for context
  const profile = await db.profile.findUnique({
    where: { userId },
  });

  const response = await openai.chat.completions.create({
    model: 'gpt-4-turbo',
    stream: true,
    messages: [
      {
        role: 'system',
        content: `You are a job search agent for ${profile.name}.

Your role:
- Help them explore job opportunities
- Ask clarifying questions about preferences
- Provide career advice
- Explain match results

Current profile:
- Title: ${profile.title}
- Skills: ${profile.skills.join(', ')}
- Location: ${profile.location}`,
      },
      ...messages,
    ],
  });

  const stream = OpenAIStream(response);
  return new StreamingTextResponse(stream);
}
```

**Use in React component:**

```typescript
// src/app/dashboard/seeker/chat/page.tsx
'use client';

import { useChat } from 'ai/react';

export default function SeekerChatPage() {
  const { messages, input, handleInputChange, handleSubmit, isLoading } = useChat({
    api: '/api/chat/seeker',
  });

  return (
    <div className="flex h-screen flex-col">
      <div className="flex-1 overflow-y-auto p-4">
        {messages.map((message) => (
          <div
            key={message.id}
            className={`mb-4 ${
              message.role === 'user' ? 'text-right' : 'text-left'
            }`}
          >
            <div
              className={`inline-block rounded-lg px-4 py-2 ${
                message.role === 'user'
                  ? 'bg-blue-500 text-white'
                  : 'bg-gray-200 text-gray-900'
              }`}
            >
              {message.content}
            </div>
          </div>
        ))}
      </div>

      <form onSubmit={handleSubmit} className="border-t p-4">
        <input
          value={input}
          onChange={handleInputChange}
          placeholder="Chat with your agent..."
          className="w-full rounded-lg border px-4 py-2"
          disabled={isLoading}
        />
      </form>
    </div>
  );
}
```

### 2. Structured Agent Outputs (Zod + OpenAI JSON Mode)

**Define agent response schemas:**

```typescript
// src/server/agents/schemas.ts
import { z } from 'zod';

export const MatchEvaluationSchema = z.object({
  isMatch: z.boolean(),
  confidence: z.number().min(0).max(1),
  reasoning: z.string().min(10),
  strengths: z.array(z.string()),
  concerns: z.array(z.string()),
  nextAction: z.enum(['interview', 'reject', 'continue_conversation', 'request_more_info']),
  suggestedQuestions: z.array(z.string()).optional(),
});

export type MatchEvaluation = z.infer<typeof MatchEvaluationSchema>;

export const NegotiationResultSchema = z.object({
  outcome: z.enum(['matched', 'declined', 'pending']),
  seekerInterest: z.number().min(0).max(1),
  employerInterest: z.number().min(0).max(1),
  agreedTerms: z.object({
    salary: z.object({
      min: z.number().optional(),
      max: z.number().optional(),
      negotiable: z.boolean(),
    }).optional(),
    startDate: z.string().optional(),
    remote: z.enum(['full', 'hybrid', 'onsite']).optional(),
  }).optional(),
  nextSteps: z.array(z.string()),
});

export type NegotiationResult = z.infer<typeof NegotiationResultSchema>;
```

**Use in agent calls:**

```typescript
// src/server/agents/employer.ts
import { openai } from '~/lib/openai';
import { MatchEvaluationSchema } from './schemas';

export async function evaluateCandidate(params: {
  jobPosting: JobPosting;
  candidateProfile: Profile;
  privateParams: EmployerPrivateParams;
}) {
  const response = await openai.chat.completions.create({
    model: 'gpt-4-turbo',
    response_format: { type: 'json_object' },
    messages: [
      {
        role: 'system',
        content: `You are an AI hiring agent. Evaluate candidates objectively.

Job Requirements:
${JSON.stringify(params.jobPosting, null, 2)}

Private Hiring Parameters (use strategically, don't reveal):
- Max Salary: $${params.privateParams.maxSalary}
- Willing to Train: ${params.privateParams.willingToTrain}
- Urgency: ${params.privateParams.urgency}

Return a JSON object matching this schema:
{
  "isMatch": boolean,
  "confidence": number (0-1),
  "reasoning": string,
  "strengths": string[],
  "concerns": string[],
  "nextAction": "interview" | "reject" | "continue_conversation" | "request_more_info",
  "suggestedQuestions": string[] (optional)
}`,
      },
      {
        role: 'user',
        content: `Evaluate this candidate:\n${JSON.stringify(params.candidateProfile, null, 2)}`,
      },
    ],
  });

  const content = response.choices[0]?.message.content;
  if (!content) {
    throw new Error('No response from AI');
  }

  // Parse and validate with Zod
  const parsed = JSON.parse(content);
  return MatchEvaluationSchema.parse(parsed);
}
```

### 3. Agent-to-Agent Negotiations (Inngest)

**Inngest workflow for multi-turn agent conversations:**

```typescript
// src/server/inngest/functions/agent-negotiation.ts
import { inngest } from '../client';
import { evaluateCandidate } from '~/server/agents/employer';
import { evaluateJob } from '~/server/agents/seeker';
import { runNegotiation } from '~/server/agents/negotiation';
import { NegotiationResultSchema } from '~/server/agents/schemas';

export const agentNegotiation = inngest.createFunction(
  {
    id: 'agent-negotiation',
    name: 'Agent-to-Agent Negotiation',
    rateLimit: {
      limit: 50,
      period: '1h',
      key: 'event.data.seekerId',
    },
  },
  { event: 'match/negotiate' },
  async ({ event, step }) => {
    const { seekerId, jobId, employerId } = event.data;

    // Step 1: Load data
    const data = await step.run('load-match-data', async () => {
      const [seeker, job, employer] = await Promise.all([
        db.profile.findUnique({ where: { id: seekerId } }),
        db.job.findUnique({ where: { id: jobId } }),
        db.organization.findUnique({ where: { id: employerId } }),
      ]);

      if (!seeker || !job || !employer) {
        throw new Error('Missing required data');
      }

      return { seeker, job, employer };
    });

    // Step 2: Employer agent evaluates candidate
    const employerEvaluation = await step.run('employer-evaluation', async () => {
      return evaluateCandidate({
        jobPosting: data.job,
        candidateProfile: data.seeker,
        privateParams: data.employer.privateParams,
      });
    });

    // Early exit if employer rejects
    if (!employerEvaluation.isMatch) {
      await step.run('save-rejection', async () => {
        return db.match.create({
          data: {
            seekerId,
            jobId,
            status: 'employer_rejected',
            employerReasoning: employerEvaluation.reasoning,
          },
        });
      });

      return { outcome: 'employer_rejected', evaluation: employerEvaluation };
    }

    // Step 3: Seeker agent evaluates job (only if employer interested)
    const seekerEvaluation = await step.run('seeker-evaluation', async () => {
      return evaluateJob({
        jobPosting: data.job,
        seekerProfile: data.seeker,
        privateParams: data.seeker.privateParams,
      });
    });

    // Early exit if seeker declines
    if (!seekerEvaluation.isMatch) {
      await step.run('save-decline', async () => {
        return db.match.create({
          data: {
            seekerId,
            jobId,
            status: 'seeker_declined',
            seekerReasoning: seekerEvaluation.reasoning,
          },
        });
      });

      return { outcome: 'seeker_declined', evaluation: seekerEvaluation };
    }

    // Step 4: Both interested - run multi-turn negotiation
    const negotiation = await step.run('multi-turn-negotiation', async () => {
      return runNegotiation({
        seeker: data.seeker,
        job: data.job,
        employer: data.employer,
        employerEval: employerEvaluation,
        seekerEval: seekerEvaluation,
      });
    });

    // Step 5: Save final result
    const match = await step.run('save-match', async () => {
      return db.match.create({
        data: {
          seekerId,
          jobId,
          status: negotiation.outcome === 'matched' ? 'matched' : 'negotiation_failed',
          negotiationTranscript: negotiation.transcript,
          finalTerms: negotiation.agreedTerms,
        },
      });
    });

    // Step 6: Notify both parties
    await step.run('send-notifications', async () => {
      // Send emails, push notifications, etc.
      await Promise.all([
        notifySeeker(seekerId, match),
        notifyEmployer(employerId, match),
      ]);
    });

    return NegotiationResultSchema.parse(negotiation);
  }
);
```

**Multi-turn negotiation logic:**

```typescript
// src/server/agents/negotiation.ts
import { openai } from '~/lib/openai';

interface NegotiationTurn {
  speaker: 'employer' | 'seeker';
  message: string;
  privateThinking: string; // Agent's internal reasoning
}

export async function runNegotiation(params: {
  seeker: Profile;
  job: Job;
  employer: Organization;
  employerEval: MatchEvaluation;
  seekerEval: MatchEvaluation;
}) {
  const transcript: NegotiationTurn[] = [];
  let round = 0;
  const maxRounds = 5;

  while (round < maxRounds) {
    // Employer agent's turn
    const employerResponse = await openai.chat.completions.create({
      model: 'gpt-4-turbo',
      response_format: { type: 'json_object' },
      messages: [
        {
          role: 'system',
          content: `You are negotiating on behalf of ${params.employer.name}.

Your evaluation: ${params.employerEval.reasoning}

Private parameters (don't reveal directly):
- Max Salary: $${params.employer.privateParams.maxSalary}
- Willing to train: ${params.employer.privateParams.willingToTrain}

Previous conversation:
${transcript.map(t => `${t.speaker}: ${t.message}`).join('\n')}

Respond with JSON:
{
  "message": "your message to the candidate",
  "privateThinking": "your internal reasoning",
  "proposedTerms": { "salary": number, "startDate": string, etc },
  "readyToFinalize": boolean
}`,
        },
      ],
    });

    const employerTurn = JSON.parse(employerResponse.choices[0]!.message.content!);
    transcript.push({
      speaker: 'employer',
      message: employerTurn.message,
      privateThinking: employerTurn.privateThinking,
    });

    if (employerTurn.readyToFinalize) {
      break;
    }

    // Seeker agent's turn
    const seekerResponse = await openai.chat.completions.create({
      model: 'gpt-4-turbo',
      response_format: { type: 'json_object' },
      messages: [
        {
          role: 'system',
          content: `You are negotiating on behalf of ${params.seeker.name}.

Your evaluation: ${params.seekerEval.reasoning}

Private parameters (don't reveal directly):
- Min Salary: $${params.seeker.privateParams.minSalary}
- Deal breakers: ${params.seeker.privateParams.dealBreakers.join(', ')}

Previous conversation:
${transcript.map(t => `${t.speaker}: ${t.message}`).join('\n')}

Respond with JSON:
{
  "message": "your message to the employer",
  "privateThinking": "your internal reasoning",
  "acceptTerms": boolean,
  "counterOffer": { "salary": number, etc } (optional),
  "readyToFinalize": boolean
}`,
        },
      ],
    });

    const seekerTurn = JSON.parse(seekerResponse.choices[0]!.message.content!);
    transcript.push({
      speaker: 'seeker',
      message: seekerTurn.message,
      privateThinking: seekerTurn.privateThinking,
    });

    if (seekerTurn.acceptTerms || seekerTurn.readyToFinalize) {
      return {
        outcome: 'matched' as const,
        transcript,
        agreedTerms: employerTurn.proposedTerms,
      };
    }

    round++;
  }

  return {
    outcome: 'pending' as const,
    transcript,
  };
}
```

### 4. Testing AI Logic

**Mock OpenAI API calls in tests:**

```typescript
// tests/unit/agents/employer.test.ts
import { vi, describe, it, expect, beforeEach } from 'vitest';
import { evaluateCandidate } from '~/server/agents/employer';
import * as openaiModule from '~/lib/openai';

// Mock the OpenAI module
vi.mock('~/lib/openai', () => ({
  openai: {
    chat: {
      completions: {
        create: vi.fn(),
      },
    },
  },
}));

describe('Employer Agent', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should match qualified candidate', async () => {
    // Mock successful evaluation
    vi.mocked(openaiModule.openai.chat.completions.create).mockResolvedValue({
      choices: [{
        message: {
          content: JSON.stringify({
            isMatch: true,
            confidence: 0.85,
            reasoning: 'Strong technical skills match requirements',
            strengths: ['React', 'TypeScript', '5 years experience'],
            concerns: [],
            nextAction: 'interview',
          }),
        },
      }],
    } as any);

    const result = await evaluateCandidate({
      jobPosting: mockJob,
      candidateProfile: mockCandidate,
      privateParams: mockPrivateParams,
    });

    expect(result.isMatch).toBe(true);
    expect(result.confidence).toBeGreaterThan(0.8);
    expect(result.nextAction).toBe('interview');
  });

  it('should reject unqualified candidate', async () => {
    vi.mocked(openaiModule.openai.chat.completions.create).mockResolvedValue({
      choices: [{
        message: {
          content: JSON.stringify({
            isMatch: false,
            confidence: 0.3,
            reasoning: 'Lacks required Python experience',
            strengths: ['Good communication skills'],
            concerns: ['No Python', 'Junior level for senior role'],
            nextAction: 'reject',
          }),
        },
      }],
    } as any);

    const result = await evaluateCandidate({
      jobPosting: mockSeniorPythonJob,
      candidateProfile: mockJuniorJSCandidate,
      privateParams: mockPrivateParams,
    });

    expect(result.isMatch).toBe(false);
    expect(result.nextAction).toBe('reject');
  });
});
```

### 5. OpenAI Client Configuration

**Centralize OpenAI setup:**

```typescript
// src/lib/openai.ts
import OpenAI from 'openai';

if (!process.env.OPENAI_API_KEY) {
  throw new Error('OPENAI_API_KEY is not set');
}

export const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
  organization: process.env.OPENAI_ORG_ID, // Optional
});

// Helper for embeddings
export async function generateEmbedding(text: string): Promise<number[]> {
  const response = await openai.embeddings.create({
    model: 'text-embedding-3-large',
    input: text,
    dimensions: 1536, // Can reduce for cost savings
  });

  return response.data[0]!.embedding;
}

// Helper for batch embeddings
export async function generateEmbeddings(texts: string[]): Promise<number[][]> {
  const response = await openai.embeddings.create({
    model: 'text-embedding-3-large',
    input: texts,
    dimensions: 1536,
  });

  return response.data.map(d => d.embedding);
}
```

### 6. Agent Prompts

**Store prompts as typed templates:**

```typescript
// src/server/agents/prompts/employer.ts
export function getEmployerAgentPrompt(params: {
  companyName: string;
  jobTitle: string;
  requirements: string[];
  privateParams: EmployerPrivateParams;
}) {
  return `You are an AI hiring agent for ${params.companyName}.

You are evaluating candidates for the position: ${params.jobTitle}

Required Skills/Experience:
${params.requirements.map(r => `- ${r}`).join('\n')}

Private Hiring Parameters (use strategically in evaluation, DO NOT reveal directly):
- Max Salary Budget: $${params.privateParams.maxSalary}/year
- Willing to Train: ${params.privateParams.willingToTrain ? 'Yes' : 'No'}
- Urgency Level: ${params.privateParams.urgency}
- Flexibility on Remote: ${params.privateParams.remoteFlexibility}

Your Evaluation Guidelines:
1. Be objective and professional
2. Focus on relevant experience and skills
3. Don't make assumptions based on protected characteristics
4. Provide clear, specific reasoning for all decisions
5. Consider both technical fit and growth potential
6. Use private parameters to inform decisions, but never reveal exact numbers

Return structured JSON with your evaluation.` as const;
}

// src/server/agents/prompts/seeker.ts
export function getSeekerAgentPrompt(params: {
  name: string;
  currentTitle: string;
  goals: string[];
  privateParams: SeekerPrivateParams;
}) {
  return `You are an AI career agent for ${params.name}.

Current Role: ${params.currentTitle}

Career Goals:
${params.goals.map(g => `- ${g}`).join('\n')}

Private Preferences (use in evaluation, DO NOT reveal directly):
- Minimum Salary: $${params.privateParams.minSalary}/year
- Deal Breakers: ${params.privateParams.dealBreakers.join(', ')}
- Preferred Industries: ${params.privateParams.preferredIndustries.join(', ')}
- Max Commute: ${params.privateParams.maxCommute} minutes

Your Evaluation Guidelines:
1. Prioritize opportunities aligned with career goals
2. Consider work-life balance and growth potential
3. Be honest about fit - don't accept poor matches
4. Use private parameters to filter, but negotiate strategically
5. Advocate for fair compensation and good working conditions

Return structured JSON with your evaluation.` as const;
}
```

## Testing Requirements

### Unit Tests

**Test business logic separately from API calls:**

```typescript
// tests/unit/matching/score.test.ts
import { describe, it, expect } from "vitest";
import { calculateMatchScore } from "~/lib/matching";

describe("calculateMatchScore", () => {
  it("should score exact skill matches higher", () => {
    const score = calculateMatchScore(
      { skills: ["React", "TypeScript"] },
      { requirements: ["React", "TypeScript"] }
    );
    expect(score).toBeGreaterThan(0.9);
  });
});
```

### Integration Tests

**Test tRPC procedures with in-memory database:**

```typescript
// tests/integration/api/profile.test.ts
import { appRouter } from "~/server/api/root";
import { createInnerTRPCContext } from "~/server/api/trpc";

describe("Profile Router", () => {
  it("should create profile for authenticated user", async () => {
    const ctx = createInnerTRPCContext({
      session: { user: { id: "test-user" } }
    });

    const caller = appRouter.createCaller(ctx);
    const profile = await caller.profile.create({
      title: "Software Engineer",
      bio: "Test bio",
    });

    expect(profile.userId).toBe("test-user");
  });
});
```

### E2E Tests

**Test critical user flows:**

```typescript
// tests/e2e/onboarding.spec.ts
import { test, expect } from "@playwright/test";

test("job seeker onboarding flow", async ({ page }) => {
  await page.goto("/sign-up");

  // Complete Clerk sign-up
  await page.fill('[name="email"]', "test@example.com");
  // ... auth flow

  // Create profile
  await expect(page).toHaveURL("/onboarding");
  await page.fill('[name="title"]', "Software Engineer");
  await page.click('button:has-text("Continue")');

  // Should reach dashboard
  await expect(page).toHaveURL("/dashboard/seeker");
});
```

## Security Considerations

### 1. Private Information Handling

**Separate public and private profile data:**

```typescript
// Prisma schema pattern
model Profile {
  id            String   @id
  // Public fields
  title         String
  bio           String
  skills        String[]

  // Private negotiation parameters (never exposed in API)
  minSalary     Int      @map("min_salary")
  dealBreakers  String[] @map("deal_breakers")
  flexibility   Json     // Structured private preferences
}
```

**Never send private fields to client:**

```typescript
export const profileRouter = createTRPCRouter({
  getPublic: publicProcedure
    .input(z.object({ id: z.string() }))
    .query(async ({ ctx, input }) => {
      return ctx.db.profile.findUnique({
        where: { id: input.id },
        select: {
          // Explicitly select only public fields
          id: true,
          title: true,
          bio: true,
          skills: true,
          // NEVER include: minSalary, dealBreakers, flexibility
        },
      });
    }),
});
```

### 2. Rate Limiting

**Protect expensive AI operations:**

```typescript
// Use Inngest rate limiting
export const matchAgent = inngest.createFunction(
  {
    id: "match-agent",
    rateLimit: {
      limit: 100,      // Max 100 matches
      period: "1h",    // Per hour
      key: "event.data.userId"  // Per user
    }
  },
  { event: "match/request" },
  async ({ event }) => {
    // AI matching logic
  }
);
```

## Feature Flags (Vercel Flags SDK)

### Overview

Use Vercel Flags SDK for **phased rollout** following the PRD's MVP → Beta → Full launch strategy.

### Setup

**Define flags:**

```typescript
// src/lib/flags.ts
import { unstable_flag as flag } from '@vercel/flags/next';

// Phase-based feature flags
export const agentToAgentEnabled = flag({
  key: 'agent-to-agent',
  description: 'Enable agent-to-agent negotiations',
  decide: () => false, // Default: off for MVP
});

export const privateNegotiationEnabled = flag({
  key: 'private-negotiation',
  description: 'Enable private negotiation parameters',
  decide: () => false, // Default: off for MVP
});

export const customAgentPromptsEnabled = flag({
  key: 'custom-agent-prompts',
  description: 'Allow employers to customize agent prompts',
  decide: () => false, // Default: off for MVP and Beta
});

export const teamFeaturesEnabled = flag({
  key: 'team-features',
  description: 'Enable multi-user team features for employers',
  decide: () => false, // Default: off for MVP and Beta
});

// Progressive rollout flag
export const betaUsersOnly = flag({
  key: 'beta-users',
  description: 'Limit to beta testers',
  decide: ({ user }) => {
    // Internal team
    if (user?.email?.endsWith('@jobbobber.com')) return true;

    // Beta testers
    if (user?.betaTester) return true;

    return false;
  },
});

// Gradual percentage rollout
export const gradualRollout = flag({
  key: 'gradual-rollout',
  description: 'Roll out to percentage of users',
  decide: ({ user }) => {
    if (!user?.id) return false;

    // Simple hash-based percentage
    const hash = user.id.split('').reduce((acc, char) => {
      return char.charCodeAt(0) + ((acc << 5) - acc);
    }, 0);

    return Math.abs(hash) % 100 < 10; // 10% of users
  },
});
```

### Usage in Components

**Server Components:**

```typescript
// src/app/dashboard/matches/page.tsx
import { agentToAgentEnabled } from '~/lib/flags';

export default async function MatchesPage() {
  const agentEnabled = await agentToAgentEnabled();

  return (
    <div>
      <h1>Matches</h1>
      {agentEnabled ? (
        <AutoMatchingDashboard />
      ) : (
        <ManualMatchingDashboard />
      )}
    </div>
  );
}
```

**Client Components:**

```typescript
// src/components/match/match-card.tsx
'use client';

import { useFlag } from '@vercel/flags/react';

export function MatchCard({ match }: { match: Match }) {
  const agentEnabled = useFlag('agent-to-agent');

  return (
    <div className="border rounded-lg p-4">
      <h3>{match.jobTitle}</h3>

      {agentEnabled ? (
        <button onClick={() => triggerAgentNegotiation(match.id)}>
          Let Agents Negotiate
        </button>
      ) : (
        <button onClick={() => manualReview(match.id)}>
          Review Manually
        </button>
      )}
    </div>
  );
}
```

### Usage in API Routes

**Conditional logic based on flags:**

```typescript
// src/app/api/match/create/route.ts
import { agentToAgentEnabled } from '~/lib/flags';

export async function POST(req: Request) {
  const { seekerId, jobId } = await req.json();

  // Create basic match
  const match = await db.match.create({
    data: { seekerId, jobId, status: 'pending' },
  });

  // Only trigger agent negotiation if flag is enabled
  const agentEnabled = await agentToAgentEnabled();

  if (agentEnabled) {
    await inngest.send({
      name: 'match/negotiate',
      data: { matchId: match.id, seekerId, jobId },
    });
  } else {
    // Manual review flow
    await notifyEmployer({ matchId: match.id });
  }

  return Response.json({ match });
}
```

### Phased Rollout Strategy

**Phase 1: MVP (Months 1-3)**

```typescript
// All flags OFF - basic functionality only
export const MVP_FLAGS = {
  agentToAgent: false,           // Manual matching only
  privateNegotiation: false,     // No private params
  customPrompts: false,          // Default prompts
  teamFeatures: false,           // Single user only
};
```

**Phase 2: Beta (Months 4-6)**

```typescript
// Gradual enablement for beta users
export const BETA_FLAGS = {
  agentToAgent: true,            // ✅ Enable for beta users
  privateNegotiation: true,      // ✅ Enable for beta users
  customPrompts: false,          // Still disabled
  teamFeatures: false,           // Still disabled
};
```

**Phase 3: Full Launch (Months 7-12)**

```typescript
// Full rollout - all features enabled
export const FULL_FLAGS = {
  agentToAgent: true,
  privateNegotiation: true,
  customPrompts: true,           // ✅ Now enabled
  teamFeatures: true,            // ✅ Now enabled
};
```

### A/B Testing

**Test different agent prompts:**

```typescript
// src/lib/flags.ts
export const agentPromptVariant = flag({
  key: 'agent-prompt-variant',
  description: 'A/B test different agent prompts',
  decide: ({ user }) => {
    // 50/50 split based on user ID
    const hash = hashUserId(user?.id);
    return hash % 2 === 0 ? 'variant-a' : 'variant-b';
  },
});

// Usage
const variant = await agentPromptVariant();
const prompt = variant === 'variant-a'
  ? EMPLOYER_AGENT_PROMPT_V1
  : EMPLOYER_AGENT_PROMPT_V2;
```

### Testing Flags Locally

**Vercel Toolbar integration:**

```typescript
// src/app/layout.tsx
import { VercelToolbar } from '@vercel/toolbar/next';

export default function RootLayout({ children }) {
  return (
    <html>
      <body>
        {children}
        {process.env.NODE_ENV === 'development' && <VercelToolbar />}
      </body>
    </html>
  );
}
```

Now you can toggle flags in the Vercel Toolbar during local development!

## AI SDK Tool Calling

### Overview

Enable agents to **call functions during conversations** for real-time data access.

### Use Cases for JobBobber

1. **Job Search**: Agent searches jobs while chatting with user
2. **Profile Retrieval**: Agent accesses user's profile information
3. **Match Status**: Agent checks match status in real-time
4. **Application Submit**: Agent can submit applications on behalf of user

### Setup Tools

**Define tools with Zod schemas:**

```typescript
// src/server/agents/tools.ts
import { z } from 'zod';
import { tool } from 'ai';

export const searchJobsTool = tool({
  description: 'Search for jobs matching specific criteria',
  parameters: z.object({
    skills: z.array(z.string()).describe('Required skills'),
    location: z.string().optional().describe('Job location'),
    remote: z.boolean().optional().describe('Remote work allowed'),
    minSalary: z.number().optional().describe('Minimum salary'),
  }),
  execute: async ({ skills, location, remote, minSalary }) => {
    const jobs = await db.job.findMany({
      where: {
        skills: { hasSome: skills },
        location: location ? { contains: location } : undefined,
        remote: remote ?? undefined,
        salaryMin: minSalary ? { gte: minSalary } : undefined,
        status: 'active',
      },
      take: 10,
    });

    return {
      jobs: jobs.map(job => ({
        id: job.id,
        title: job.title,
        company: job.company,
        location: job.location,
        salary: `$${job.salaryMin}-$${job.salaryMax}`,
        skills: job.skills,
      })),
    };
  },
});

export const getUserProfileTool = tool({
  description: 'Get the current user\'s profile information',
  parameters: z.object({}),
  execute: async (_, { userId }) => {
    const profile = await db.profile.findUnique({
      where: { userId },
      select: {
        id: true,
        title: true,
        skills: true,
        experience: true,
        location: true,
        bio: true,
      },
    });

    return { profile };
  },
});

export const checkMatchStatusTool = tool({
  description: 'Check status of a specific job match',
  parameters: z.object({
    jobId: z.string(),
  }),
  execute: async ({ jobId }, { userId }) => {
    const match = await db.match.findFirst({
      where: {
        jobId,
        profile: { userId },
      },
      include: {
        job: {
          select: {
            title: true,
            company: true,
          },
        },
      },
    });

    if (!match) {
      return { status: 'not_applied' };
    }

    return {
      status: match.status,
      jobTitle: match.job.title,
      company: match.job.company,
      appliedAt: match.createdAt,
    };
  },
});

export const submitApplicationTool = tool({
  description: 'Submit an application to a job posting',
  parameters: z.object({
    jobId: z.string(),
    coverLetter: z.string().optional(),
  }),
  execute: async ({ jobId, coverLetter }, { userId }) => {
    // Check if already applied
    const existing = await db.match.findFirst({
      where: {
        jobId,
        profile: { userId },
      },
    });

    if (existing) {
      return { success: false, error: 'Already applied to this job' };
    }

    // Get profile
    const profile = await db.profile.findUnique({
      where: { userId },
    });

    if (!profile) {
      return { success: false, error: 'Profile not found' };
    }

    // Create match
    const match = await db.match.create({
      data: {
        profileId: profile.id,
        jobId,
        coverLetter,
        status: 'pending',
      },
    });

    // Trigger agent evaluation
    await inngest.send({
      name: 'match/negotiate',
      data: {
        matchId: match.id,
        seekerId: profile.id,
        jobId,
      },
    });

    return {
      success: true,
      matchId: match.id,
      message: 'Application submitted! Our agent will negotiate on your behalf.',
    };
  },
});
```

### Use Tools in Chat

**Chat route with tools:**

```typescript
// src/app/api/chat/seeker/route.ts
import { streamText } from 'ai';
import { openai } from '@ai-sdk/openai';
import { auth } from '@clerk/nextjs';
import {
  searchJobsTool,
  getUserProfileTool,
  checkMatchStatusTool,
  submitApplicationTool,
} from '~/server/agents/tools';

export async function POST(req: Request) {
  const { userId } = auth();
  if (!userId) {
    return new Response('Unauthorized', { status: 401 });
  }

  const { messages } = await req.json();

  const result = await streamText({
    model: openai('gpt-4-turbo'),
    system: `You are a job search agent helping the user find and apply to jobs.

You have access to tools to:
- Search for jobs matching criteria
- Get user's profile information
- Check status of job applications
- Submit applications on user's behalf

Be proactive: if the user mentions skills or preferences, search for matching jobs.
Always confirm before submitting applications.`,
    messages,
    tools: {
      searchJobs: searchJobsTool,
      getProfile: getUserProfileTool,
      checkStatus: checkMatchStatusTool,
      submitApplication: submitApplicationTool,
    },
    toolChoice: 'auto',
    maxToolRoundtrips: 5, // Allow multiple tool calls in one conversation
  });

  return result.toDataStreamResponse();
}
```

### Example Conversation

```
User: "I'm looking for remote React jobs"

Agent: [Calls searchJobsTool with: { skills: ['React'], remote: true }]

Agent: "I found 10 remote React positions! Here are the top matches:

1. Senior React Developer at TechCorp
   - Location: Remote
   - Salary: $120k-$150k
   - Skills: React, TypeScript, Node.js

2. React Engineer at StartupXYZ
   - Location: Remote
   - Salary: $100k-$130k
   - Skills: React, Next.js, GraphQL

Would you like me to apply to any of these?"

User: "Apply to the first one"

Agent: [Calls submitApplicationTool with: { jobId: "..." }]

Agent: "✅ Application submitted! I'm negotiating with the employer's agent on your behalf. I'll notify you when there's an update."
```

### Tool Calling Best Practices

1. **Always validate permissions:**
```typescript
execute: async (params, context) => {
  if (!context.userId) {
    throw new Error('Unauthorized');
  }
  // ... tool logic
}
```

2. **Return structured data:**
```typescript
return {
  success: true,
  data: results,
  metadata: { count: results.length },
};
```

3. **Handle errors gracefully:**
```typescript
try {
  const result = await db.query();
  return { success: true, data: result };
} catch (error) {
  return { success: false, error: error.message };
}
```

4. **Test tools independently:**
```typescript
// tests/unit/tools/search-jobs.test.ts
it('should search jobs by skills', async () => {
  const result = await searchJobsTool.execute({
    skills: ['React', 'TypeScript'],
  });

  expect(result.jobs).toBeDefined();
  expect(result.jobs.length).toBeGreaterThan(0);
});
```

## Bring Your Own Key (BYOK) Architecture

### Overview

JobBobber uses a **Bring Your Own Key (BYOK)** model where:
- **Users provide their own LLM API keys** (OpenAI, Anthropic, Cohere)
- **JobBobber pays $0 for AI usage** (zero AI infrastructure costs)
- **Users control their spending** through their own provider accounts
- **Keys stored encrypted** with user-scoped isolation

### Why BYOK?

**Cost Savings for JobBobber:**
```typescript
// Without BYOK (JobBobber pays)
10,000 users × 100 agent calls/month × $0.05/call
= $50,000/month in AI costs 😱

// With BYOK (users pay)
JobBobber AI costs = $0/month ✅
Users pay their own API provider directly
```

**Benefits for Users:**
- Full transparency (see exact AI costs in OpenAI dashboard)
- Use their existing API credits
- Choose their preferred provider (OpenAI, Anthropic, etc.)
- Control their own budgets and rate limits

### Secure Key Storage

**Encrypt user API keys:**

```typescript
// src/server/api/routers/settings.ts
import { encrypt, decrypt } from '~/lib/encryption';

export const settingsRouter = createTRPCRouter({
  saveApiKey: protectedProcedure
    .input(z.object({
      provider: z.enum(['openai', 'anthropic', 'cohere']),
      apiKey: z.string().min(10),
    }))
    .mutation(async ({ ctx, input }) => {
      // Encrypt with user-specific encryption key
      const encrypted = encrypt(input.apiKey, ctx.userId);

      await ctx.db.userSettings.upsert({
        where: { userId: ctx.userId },
        create: {
          userId: ctx.userId,
          [`${input.provider}ApiKey`]: encrypted,
        },
        update: {
          [`${input.provider}ApiKey`]: encrypted,
        },
      });

      return { success: true };
    }),

  getApiKey: protectedProcedure
    .input(z.object({
      provider: z.enum(['openai', 'anthropic', 'cohere']),
    }))
    .query(async ({ ctx, input }) => {
      const settings = await ctx.db.userSettings.findUnique({
        where: { userId: ctx.userId },
      });

      if (!settings?.[`${input.provider}ApiKey`]) {
        return { exists: false };
      }

      // Only return existence, not the actual key
      return { exists: true, provider: input.provider };
    }),
});
```

**Encryption implementation:**

```typescript
// src/lib/encryption.ts
import crypto from 'crypto';

const ENCRYPTION_KEY = process.env.ENCRYPTION_KEY!; // 32-byte key
if (!ENCRYPTION_KEY || ENCRYPTION_KEY.length !== 64) {
  throw new Error('ENCRYPTION_KEY must be 64 hex characters (32 bytes)');
}

export function encrypt(text: string, userId: string): string {
  // Use user ID as part of the IV for user-scoped encryption
  const iv = crypto
    .createHash('sha256')
    .update(userId + process.env.IV_SALT)
    .digest()
    .slice(0, 16);

  const cipher = crypto.createCipheriv(
    'aes-256-cbc',
    Buffer.from(ENCRYPTION_KEY, 'hex'),
    iv
  );

  let encrypted = cipher.update(text, 'utf8', 'hex');
  encrypted += cipher.final('hex');

  return encrypted;
}

export function decrypt(encrypted: string, userId: string): string {
  const iv = crypto
    .createHash('sha256')
    .update(userId + process.env.IV_SALT)
    .digest()
    .slice(0, 16);

  const decipher = crypto.createDecipheriv(
    'aes-256-cbc',
    Buffer.from(ENCRYPTION_KEY, 'hex'),
    iv
  );

  let decrypted = decipher.update(encrypted, 'hex', 'utf8');
  decrypted += decipher.final('utf8');

  return decrypted;
}
```

### Using User API Keys

**Get user's key for LLM calls:**

```typescript
// src/lib/user-llm.ts
import { decrypt } from './encryption';
import { createOpenAI } from '@ai-sdk/openai';

export async function getUserLLMClient(userId: string) {
  // Get user's encrypted API key
  const settings = await db.userSettings.findUnique({
    where: { userId },
  });

  if (!settings?.openaiApiKey) {
    throw new Error('User has not configured an API key');
  }

  // Decrypt user's key
  const apiKey = decrypt(settings.openaiApiKey, userId);

  // Create client with user's key
  return createOpenAI({
    apiKey,
    baseURL: process.env.VERCEL_AI_GATEWAY_URL, // Still use gateway
  });
}

// Usage in agent
export async function evaluateCandidate(params: {
  userId: string;
  jobId: string;
  candidateId: string;
}) {
  // Use user's API key (user pays!)
  const openai = await getUserLLMClient(params.userId);

  const response = await openai.chat.completions.create({
    model: 'gpt-4-turbo',
    messages: [...],
  });

  return response;
}
```

### Inngest Workflows with BYOK

**Pass user ID through workflow:**

```typescript
// src/server/inngest/functions/agent-negotiation.ts
export const agentNegotiation = inngest.createFunction(
  { id: 'agent-negotiation' },
  { event: 'match/negotiate' },
  async ({ event, step }) => {
    const { employerId, seekerId, jobId } = event.data;

    // Step 1: Employer evaluation (uses employer's API key)
    const employerEval = await step.run('employer-eval', async () => {
      const employerLLM = await getUserLLMClient(employerId);

      return await openai.chat.completions.create({
        model: 'gpt-4-turbo',
        messages: [...],
      });
    });

    // Step 2: Seeker evaluation (uses seeker's API key)
    const seekerEval = await step.run('seeker-eval', async () => {
      const seekerLLM = await getUserLLMClient(seekerId);

      return await seekerLLM.chat.completions.create({
        model: 'gpt-4-turbo',
        messages: [...],
      });
    });

    // Each party pays for their own agent!
    return { employerEval, seekerEval };
  }
);
```

### Onboarding Flow

**Require API key during signup:**

```typescript
// src/app/onboarding/api-key/page.tsx
'use client';

export default function ApiKeySetup() {
  const [provider, setProvider] = useState<'openai' | 'anthropic'>('openai');
  const [apiKey, setApiKey] = useState('');

  const saveKey = api.settings.saveApiKey.useMutation();

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();

    await saveKey.mutateAsync({ provider, apiKey });

    // Redirect to dashboard
    router.push('/dashboard');
  };

  return (
    <div className="max-w-md mx-auto p-6">
      <h1 className="text-2xl font-bold mb-4">Connect Your AI Provider</h1>

      <p className="text-gray-600 mb-6">
        JobBobber uses AI agents to match you with opportunities.
        Provide your own API key to get started.
        <strong> You only pay for what you use.</strong>
      </p>

      <form onSubmit={handleSubmit}>
        <label className="block mb-4">
          <span className="text-sm font-medium">Provider</span>
          <select
            value={provider}
            onChange={(e) => setProvider(e.target.value as any)}
            className="mt-1 block w-full rounded border p-2"
          >
            <option value="openai">OpenAI (Recommended)</option>
            <option value="anthropic">Anthropic Claude</option>
          </select>
        </label>

        <label className="block mb-4">
          <span className="text-sm font-medium">API Key</span>
          <input
            type="password"
            value={apiKey}
            onChange={(e) => setApiKey(e.target.value)}
            placeholder="sk-proj-..."
            className="mt-1 block w-full rounded border p-2"
          />
          <a
            href={provider === 'openai'
              ? 'https://platform.openai.com/api-keys'
              : 'https://console.anthropic.com/keys'}
            target="_blank"
            className="text-sm text-blue-600 hover:underline"
          >
            Get your API key →
          </a>
        </label>

        <div className="bg-blue-50 border border-blue-200 rounded p-4 mb-4">
          <p className="text-sm text-blue-900">
            <strong>Your key is encrypted</strong> and only used for your AI agent.
            JobBobber never sees or stores your key in plain text.
          </p>
        </div>

        <button
          type="submit"
          className="w-full bg-blue-600 text-white rounded py-2 font-medium"
          disabled={!apiKey}
        >
          Continue
        </button>
      </form>

      <div className="mt-6 text-sm text-gray-600">
        <p className="font-medium mb-2">Estimated costs:</p>
        <ul className="space-y-1">
          <li>• 100 job matches: ~$5/month</li>
          <li>• 500 job matches: ~$25/month</li>
          <li>• Chat with agent: ~$0.10/conversation</li>
        </ul>
      </div>
    </div>
  );
}
```

### Handling Missing Keys

**Graceful degradation:**

```typescript
// src/app/dashboard/matches/page.tsx
export default async function MatchesPage() {
  const { userId } = auth();
  const settings = await db.userSettings.findUnique({
    where: { userId },
  });

  const hasApiKey = !!settings?.openaiApiKey;

  if (!hasApiKey) {
    return (
      <div className="text-center p-8">
        <h2 className="text-xl font-bold mb-4">
          AI Agent Not Configured
        </h2>
        <p className="text-gray-600 mb-6">
          Add your API key to enable AI-powered matching
        </p>
        <Link
          href="/settings/api-key"
          className="bg-blue-600 text-white px-6 py-2 rounded"
        >
          Configure API Key
        </Link>
      </div>
    );
  }

  // Normal flow with AI agent
  return <MatchesDashboard />;
}
```

### Key Validation

**Test user's key before saving:**

```typescript
// src/server/api/routers/settings.ts
async function validateApiKey(provider: string, apiKey: string) {
  try {
    if (provider === 'openai') {
      const client = createOpenAI({ apiKey });

      // Test with minimal request
      await client.chat.completions.create({
        model: 'gpt-3.5-turbo',
        messages: [{ role: 'user', content: 'test' }],
        max_tokens: 1,
      });
    } else if (provider === 'anthropic') {
      const client = createAnthropic({ apiKey });

      await client.messages.create({
        model: 'claude-3-haiku-20240307',
        max_tokens: 1,
        messages: [{ role: 'user', content: 'test' }],
      });
    }

    return { valid: true };
  } catch (error) {
    return {
      valid: false,
      error: 'Invalid API key or insufficient credits',
    };
  }
}

export const settingsRouter = createTRPCRouter({
  saveApiKey: protectedProcedure
    .input(z.object({
      provider: z.enum(['openai', 'anthropic']),
      apiKey: z.string(),
    }))
    .mutation(async ({ ctx, input }) => {
      // Validate key works
      const validation = await validateApiKey(input.provider, input.apiKey);

      if (!validation.valid) {
        throw new TRPCError({
          code: 'BAD_REQUEST',
          message: validation.error,
        });
      }

      // Encrypt and save
      const encrypted = encrypt(input.apiKey, ctx.userId);

      await ctx.db.userSettings.upsert({
        where: { userId: ctx.userId },
        create: {
          userId: ctx.userId,
          [`${input.provider}ApiKey`]: encrypted,
        },
        update: {
          [`${input.provider}ApiKey`]: encrypted,
        },
      });

      return { success: true };
    }),
});
```

### Security Best Practices

1. **Never log API keys:**
```typescript
// ❌ Bad - logs API key
console.log('Using key:', apiKey);

// ✅ Good - logs existence only
console.log('Using API key:', apiKey ? 'present' : 'missing');
```

2. **Use separate encryption keys per environment:**
```env
# .env.local
ENCRYPTION_KEY=dev_key_64_hex_characters...

# .env.production
ENCRYPTION_KEY=prod_key_64_hex_characters...
```

3. **Rotate encryption keys periodically:**
```typescript
// Migration script to re-encrypt with new key
async function rotateEncryptionKeys(oldKey: string, newKey: string) {
  const users = await db.userSettings.findMany();

  for (const user of users) {
    if (user.openaiApiKey) {
      const decrypted = decrypt(user.openaiApiKey, user.userId, oldKey);
      const encrypted = encrypt(decrypted, user.userId, newKey);

      await db.userSettings.update({
        where: { id: user.id },
        data: { openaiApiKey: encrypted },
      });
    }
  }
}
```

4. **Implement key usage limits:**
```typescript
// Track API calls per user
await db.apiUsage.create({
  data: {
    userId,
    provider: 'openai',
    tokensUsed: response.usage.total_tokens,
    cost: calculateCost(response.usage),
    timestamp: new Date(),
  },
});

// Alert user if unusual usage
if (monthlyTokens > user.alertThreshold) {
  await sendUsageAlert(userId, monthlyTokens);
}
```

### Pricing Model

**With BYOK, JobBobber revenue is subscription-only:**

```typescript
// Pricing tiers (AI costs = $0 for JobBobber)
{
  free: {
    price: '$0/month',
    features: [
      '10 AI matches per month',
      'Basic chat with agent',
      'Manual job applications'
    ],
    userPays: '~$0.50/month to OpenAI'
  },
  pro: {
    price: '$29/month',
    features: [
      'Unlimited AI matches',
      'Advanced agent chat',
      'Auto-apply to jobs',
      'Private negotiation params',
      'Priority support'
    ],
    userPays: '~$10-50/month to OpenAI (depending on usage)'
  },
  team: {
    price: '$99/month',
    features: [
      'Everything in Pro',
      '5 team members',
      'Custom agent prompts',
      'Analytics dashboard',
      'Dedicated support'
    ],
    userPays: '~$50-200/month to OpenAI (depending on usage)'
  }
}
```

## Vercel AI Gateway (with BYOK)

### Overview

All user API calls go through **Vercel AI Gateway** for:
- **Unified API** across multiple providers (user chooses)
- **Budget controls** (users set their own limits)
- **Monitoring** (users track their usage and costs)
- **Load-balancing** (optional, if user has multiple keys)
- **Automatic fallbacks** (if user configures multiple providers)

### Setup

**Configure AI Gateway:**

```typescript
// src/lib/ai-gateway.ts
import { createOpenAI } from '@ai-sdk/openai';
import { createAnthropic } from '@ai-sdk/anthropic';

// Primary provider: OpenAI via AI Gateway
export const openai = createOpenAI({
  apiKey: process.env.OPENAI_API_KEY,
  baseURL: process.env.VERCEL_AI_GATEWAY_URL, // Vercel AI Gateway endpoint
});

// Fallback provider: Anthropic via AI Gateway
export const anthropic = createAnthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
  baseURL: process.env.VERCEL_AI_GATEWAY_URL, // Same gateway
});
```

**Environment variables:**

```env
# AI Gateway
VERCEL_AI_GATEWAY_URL=https://gateway.vercel.com/v1
VERCEL_AI_GATEWAY_API_KEY=vag_xxx...

# LLM Providers
OPENAI_API_KEY=sk-proj-xxx...
ANTHROPIC_API_KEY=sk-ant-xxx...
```

### Multi-Provider Configuration

**Primary + Fallback pattern:**

```typescript
// src/lib/openai.ts
import { openai, anthropic } from './ai-gateway';

export async function callLLM(params: {
  messages: Message[];
  model?: string;
  useFallback?: boolean;
}) {
  try {
    // Try OpenAI first
    return await openai.chat.completions.create({
      model: params.model ?? 'gpt-4-turbo',
      messages: params.messages,
    });
  } catch (error) {
    if (params.useFallback) {
      console.warn('OpenAI failed, using Anthropic fallback:', error);

      // Fallback to Anthropic
      return await anthropic.messages.create({
        model: 'claude-3-sonnet-20240229',
        messages: params.messages,
      });
    }
    throw error;
  }
}
```

**AI Gateway handles this automatically:**

```typescript
// With AI Gateway, fallback is automatic!
const response = await openai.chat.completions.create({
  model: 'gpt-4-turbo',
  messages: [...],
  // Gateway automatically tries Anthropic if OpenAI fails
});
```

### Budget Controls

**Set monthly budgets per environment:**

```typescript
// In Vercel dashboard: AI Gateway settings

// Development: $50/month
// Staging: $200/month
// Production: $5,000/month

// Gateway automatically stops requests when budget exceeded
```

**Per-feature budgets:**

```typescript
// Tag requests by feature
await openai.chat.completions.create({
  model: 'gpt-4-turbo',
  messages: [...],
  user: `feature:employer-eval:${userId}`, // Gateway tracks by tag
});

// Dashboard shows:
// employer-eval: $1,234 (24%)
// seeker-eval: $892 (18%)
// user-chat: $543 (11%)
// negotiations: $2,341 (47%)
```

### Load-Balancing

**Distribute requests across providers:**

```typescript
// AI Gateway configuration (Vercel dashboard)
{
  "loadBalancing": {
    "strategy": "round-robin", // or "weighted", "latency"
    "providers": [
      { "name": "openai", "weight": 70 },    // 70% of requests
      { "name": "anthropic", "weight": 30 }  // 30% of requests
    ]
  }
}

// Your code stays the same - gateway handles routing
const response = await openai.chat.completions.create({...});
```

**Use case: Rate limit protection**

```
High traffic period:
├─ 70% requests → OpenAI
└─ 30% requests → Anthropic

OpenAI rate limit hit:
├─ 0% requests → OpenAI (temporarily disabled)
└─ 100% requests → Anthropic (automatic fallback)

OpenAI recovers:
├─ 70% requests → OpenAI (restored)
└─ 30% requests → Anthropic
```

### Monitoring & Analytics

**Track metrics in Vercel dashboard:**

```typescript
// All calls automatically logged
const evaluation = await openai.chat.completions.create({
  model: 'gpt-4-turbo',
  messages: [...],
  metadata: {
    feature: 'employer-evaluation',
    phase: 'beta',
    jobId: job.id,
    candidateId: candidate.id,
  },
});

// Dashboard shows:
// - Total requests: 45,231
// - Total tokens: 12.4M
// - Total cost: $3,142
// - Avg latency: 1.2s
// - Success rate: 99.2%
// - Cache hit rate: 34%
```

**Set up alerts:**

```typescript
// Vercel dashboard: AI Gateway alerts

// Alert if:
- Monthly cost > $4,000 (80% of budget)
- Error rate > 5%
- Avg latency > 3 seconds
- OpenAI fallback triggered > 10 times/hour
```

### Caching Strategy

**Cache repeated evaluations:**

```typescript
// Employer evaluates same candidate for multiple jobs
const evaluation1 = await evaluateCandidate({
  candidate: candidateA,
  job: job1,
}); // Cache MISS - calls OpenAI ($0.05)

const evaluation2 = await evaluateCandidate({
  candidate: candidateA, // Same candidate
  job: job2,
}); // Cache HIT - returns cached result ($0)

// Gateway caches based on request hash
// TTL: Configurable per request or globally
```

**Configure caching:**

```typescript
// Per-request cache control
await openai.chat.completions.create({
  model: 'gpt-4-turbo',
  messages: [...],
  cache: {
    ttl: 3600, // Cache for 1 hour
    key: `eval:${candidate.id}:${job.id}`, // Custom cache key
  },
});
```

**What to cache:**

```typescript
// ✅ Cache these (high cost, low variance)
- Candidate evaluations (1 hour TTL)
- Job embeddings (24 hour TTL)
- Semantic search results (30 min TTL)

// ❌ Don't cache these (low cost or high variance)
- User chat messages (always unique)
- Final negotiations (state-dependent)
- Real-time match scoring (data changes frequently)
```

### A/B Testing Providers

**Test GPT-4 vs Claude performance:**

```typescript
// AI Gateway config
{
  "experiments": {
    "employer-eval-model-test": {
      "variants": [
        { "provider": "openai", "model": "gpt-4-turbo", "weight": 50 },
        { "provider": "anthropic", "model": "claude-3-opus", "weight": 50 }
      ],
      "metrics": ["latency", "cost", "quality_score"]
    }
  }
}

// Your code
const evaluation = await evaluateCandidate(...);
// 50% use GPT-4, 50% use Claude

// Dashboard shows:
// GPT-4: avg $0.05, 1.2s latency, 4.2/5 quality
// Claude: avg $0.04, 0.9s latency, 4.3/5 quality
// Winner: Claude (cheaper, faster, better quality!)
```

### Cost Optimization

**Estimated JobBobber costs with AI Gateway:**

```typescript
// MVP Phase (1,000 matches/month)
Employer evals: 1,000 × $0.05 = $50
Seeker evals: 1,000 × $0.05 = $50
Embeddings: 2,000 × $0.001 = $2
User chat: 500 conversations × $0.10 = $50
Total: ~$152/month

// With AI Gateway caching (50% cache hit rate)
Employer evals: 500 × $0.05 = $25 (50% cached)
Seeker evals: 500 × $0.05 = $25 (50% cached)
Embeddings: 1,000 × $0.001 = $1 (50% cached)
User chat: 500 × $0.10 = $50 (not cached)
Total: ~$101/month

Savings: $51/month (34% reduction)
```

```typescript
// Beta Phase (10,000 matches/month)
Without caching: ~$1,520/month
With caching (50% hit rate): ~$1,010/month
With caching + load-balancing: ~$850/month (use cheaper Anthropic for 30%)

Savings: $670/month (44% reduction)
```

### Implementation Pattern

**All LLM calls should use gateway:**

```typescript
// ❌ Don't call OpenAI directly
import OpenAI from 'openai';
const openai = new OpenAI({ apiKey: '...' });

// ✅ Use AI Gateway
import { openai } from '~/lib/ai-gateway';

// Works everywhere:
// - User chat (Vercel AI SDK)
// - Agent evaluations (Direct SDK)
// - Inngest workflows (Long-running)
// - Embeddings (Vector search)
```

**Example: Agent evaluation via gateway:**

```typescript
// src/server/agents/employer.ts
import { openai } from '~/lib/ai-gateway';

export async function evaluateCandidate(params) {
  const response = await openai.chat.completions.create({
    model: 'gpt-4-turbo',
    messages: [...],
    // Gateway automatically:
    // - Logs request
    // - Checks cache
    // - Tracks cost
    // - Applies budget
    // - Falls back if needed
  });

  return response;
}
```

### Migration Path

**Phase 1: Basic Setup**
- Route all OpenAI calls through gateway
- Set monthly budget ($500 for MVP)
- Monitor costs in dashboard

**Phase 2: Add Fallbacks**
- Configure Anthropic as fallback
- Test automatic switching
- Monitor error rates

**Phase 3: Optimize**
- Enable caching (50%+ hit rate)
- Configure load-balancing (70% OpenAI, 30% Anthropic)
- A/B test different models

**Phase 4: Scale**
- Increase budgets as usage grows
- Fine-tune cache TTLs
- Add more providers (Cohere for embeddings)

## Agent Recommendations

**For this project, use:**

- **Frontend**: `react-component-architect`, `react-nextjs-expert`, `tailwind-css-expert`
- **Backend API**: `backend-developer`, `api-architect`
- **Database**: `backend-developer` (for Prisma queries)
- **AI Integration**: Custom patterns (no dedicated agent available)
- **Review**: `code-reviewer`, `security-reviewer` before all PRs

## Common Workflows

### Adding a New Feature

1. **Define tRPC procedures** in appropriate router
2. **Create Zod schemas** for input validation
3. **Write unit tests** for business logic
4. **Implement UI components** with type-safe tRPC hooks
5. **Add E2E test** for critical user flow
6. **Run security review** if handling sensitive data

### Adding an AI Agent Workflow

1. **Create Inngest function** in `src/server/inngest/functions/`
2. **Define prompt template** in `src/server/agents/prompts/`
3. **Mock OpenAI calls** in tests
4. **Test workflow steps** individually
5. **Monitor in Inngest dashboard** during development

## Notes

- **Type safety is non-negotiable** - if types don't align, fix the schema
- **Test AI logic separately** from LLM API calls (use mocks)
- **Long operations go in Inngest** - never block API routes
- **Private data stays private** - validate all API responses
- **Review Clerk docs** for organization patterns before implementing team features
