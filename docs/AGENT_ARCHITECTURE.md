# JobBobber Agent Architecture

## Overview

JobBobber uses a **three-layer agent system** that avoids heavy frameworks (LangChain, LangGraph) in favor of explicit, type-safe code using **Vercel AI SDK** + **Inngest** + **Direct OpenAI SDK calls**.

## Architecture Diagram

```
┌─────────────────────────────────────────────────────────────────┐
│                    Layer 1: User Interface                       │
│  • Job Seeker chats with their agent                            │
│  • Employer reviews agent-generated candidate evaluations       │
│  • Real-time streaming responses via Vercel AI SDK              │
└──────────────────────┬──────────────────────────────────────────┘
                       │
                       │ (tRPC calls / Route Handlers)
                       │
┌──────────────────────▼──────────────────────────────────────────┐
│                  Layer 2: API Orchestration                      │
│  • Next.js API Routes with Vercel AI SDK                        │
│  • tRPC procedures for type-safe calls                          │
│  • Trigger Inngest workflows for agent-to-agent                 │
│  • Stream responses to UI (useChat hook)                        │
└──────────────────────┬──────────────────────────────────────────┘
                       │
                       │ (Inngest events)
                       │
┌──────────────────────▼──────────────────────────────────────────┐
│              Layer 3: Agent-to-Agent Workflows                   │
│  • Inngest step functions (resumable, no timeout)               │
│  • Direct OpenAI SDK calls                                       │
│  • Zod schema validation for structured outputs                 │
│  • Multi-turn negotiations between employer & seeker agents     │
│  • Private parameter handling (strategic negotiation)           │
└──────────────────────────────────────────────────────────────────┘
```

## Why This Architecture?

### ✅ Advantages

1. **No Heavy Abstractions**
   - Direct control over AI calls
   - Easy to debug and understand
   - No "magic" happening behind the scenes

2. **Full TypeScript Safety**
   - Zod schemas for agent outputs
   - tRPC for API calls
   - Prisma for database queries
   - End-to-end type safety

3. **Perfect Next.js Integration**
   - Vercel AI SDK built for Next.js
   - Streaming responses work out of the box
   - React hooks (`useChat`, `useCompletion`)

4. **No Timeout Limits**
   - Inngest handles long-running agent conversations
   - Each step is resumable
   - Can negotiate for hours if needed

5. **Cost Efficient**
   - Only pay for what you use
   - No framework overhead
   - Direct OpenAI SDK calls

### ❌ Trade-offs

1. **More Boilerplate**
   - Need to build agent patterns yourself
   - No built-in memory management
   - Manual conversation state handling

2. **Limited Built-in Tools**
   - LangChain has extensive tool ecosystem
   - We build only what we need

## Three Use Cases

### 1. User Chats with Their Agent (Vercel AI SDK)

**User Flow:** Job seeker asks their agent "What jobs match my skills?"

**Implementation:**

```typescript
// src/app/api/chat/seeker/route.ts
export async function POST(req: Request) {
  const { messages } = await req.json();

  const response = await openai.chat.completions.create({
    model: 'gpt-4-turbo',
    stream: true,
    messages: [
      { role: 'system', content: 'You are a job search agent...' },
      ...messages,
    ],
  });

  const stream = OpenAIStream(response);
  return new StreamingTextResponse(stream);
}
```

```typescript
// src/app/dashboard/seeker/chat/page.tsx
const { messages, input, handleSubmit } = useChat({
  api: '/api/chat/seeker',
});
```

**Why:** Fast, real-time streaming, great UX

---

### 2. Agent Evaluates Profile/Job (Structured Output)

**User Flow:** New job posting created → Employer agent evaluates all matching candidates

**Implementation:**

```typescript
// Zod schema for structured output
const EvaluationSchema = z.object({
  isMatch: z.boolean(),
  confidence: z.number().min(0).max(1),
  reasoning: z.string(),
  nextAction: z.enum(['interview', 'reject', 'continue']),
});

// Agent function
export async function evaluateCandidate(params) {
  const response = await openai.chat.completions.create({
    model: 'gpt-4-turbo',
    response_format: { type: 'json_object' }, // JSON mode
    messages: [...],
  });

  const parsed = JSON.parse(response.choices[0].message.content);
  return EvaluationSchema.parse(parsed); // Type-safe!
}
```

**Why:** Type-safe outputs, validation, structured data for DB storage

---

### 3. Agent-to-Agent Negotiation (Inngest)

**User Flow:** Both agents interested → Multi-turn negotiation to agree on terms

**Implementation:**

```typescript
// Inngest function (can run for hours)
export const agentNegotiation = inngest.createFunction(
  { id: 'agent-negotiation' },
  { event: 'match/negotiate' },
  async ({ event, step }) => {
    // Step 1: Employer evaluates (resumable)
    const employerEval = await step.run('employer-eval', async () => {
      return evaluateCandidate(...);
    });

    if (!employerEval.isMatch) return { outcome: 'rejected' };

    // Step 2: Seeker evaluates (resumable)
    const seekerEval = await step.run('seeker-eval', async () => {
      return evaluateJob(...);
    });

    if (!seekerEval.isMatch) return { outcome: 'declined' };

    // Step 3: Multi-turn negotiation (resumable)
    const negotiation = await step.run('negotiate', async () => {
      return runMultiTurnNegotiation(...);
    });

    return negotiation;
  }
);
```

**Why:** No timeout limits, resumable, perfect for complex workflows

## Data Flow Example

### Scenario: New Candidate Applies to Job

```
1. User clicks "Apply" button
   ↓
2. tRPC mutation triggered
   src/app/dashboard/jobs/[id]/apply/page.tsx
   ↓
3. tRPC procedure creates match record
   src/server/api/routers/match.ts
   ↓
4. Trigger Inngest event
   await inngest.send({ name: 'match/negotiate', data: {...} })
   ↓
5. Inngest workflow starts
   src/server/inngest/functions/agent-negotiation.ts
   ↓
6. Step 1: Employer agent evaluates
   OpenAI API call → Zod validation → Structured result
   ↓
7. If match → Step 2: Seeker agent evaluates
   OpenAI API call → Zod validation → Structured result
   ↓
8. If both match → Step 3: Multi-turn negotiation
   Multiple OpenAI calls back and forth
   ↓
9. Save final result to database
   Prisma mutation
   ↓
10. Notify both parties
    Send emails, push notifications
    ↓
11. Update UI via tRPC subscription
    Real-time update in dashboard
```

## File Structure

```
src/
├── app/
│   ├── api/
│   │   └── chat/
│   │       ├── seeker/route.ts      # Vercel AI SDK streaming endpoint
│   │       └── employer/route.ts    # Vercel AI SDK streaming endpoint
│   └── dashboard/
│       ├── seeker/chat/page.tsx     # useChat() hook
│       └── employer/matches/page.tsx
│
├── server/
│   ├── agents/
│   │   ├── schemas.ts               # Zod schemas for agent outputs
│   │   ├── employer.ts              # Employer agent logic
│   │   ├── seeker.ts                # Seeker agent logic
│   │   ├── negotiation.ts           # Multi-turn negotiation
│   │   └── prompts/
│   │       ├── employer.ts          # Prompt templates
│   │       └── seeker.ts
│   │
│   ├── inngest/
│   │   ├── client.ts                # Inngest client setup
│   │   └── functions/
│   │       ├── agent-negotiation.ts # Main negotiation workflow
│   │       ├── embeddings.ts        # Vector embedding generation
│   │       └── match-scoring.ts     # Calculate match scores
│   │
│   └── api/
│       └── routers/
│           └── match.ts             # tRPC procedures for matches
│
└── lib/
    ├── openai.ts                    # OpenAI client + helpers
    └── vector.ts                    # pgvector utilities
```

## Key Patterns

### Pattern 1: Structured Outputs with Zod

```typescript
// 1. Define schema
const schema = z.object({
  decision: z.enum(['accept', 'reject']),
  reasoning: z.string(),
});

// 2. Call OpenAI with JSON mode
const response = await openai.chat.completions.create({
  response_format: { type: 'json_object' },
  messages: [...],
});

// 3. Parse and validate
const result = schema.parse(JSON.parse(response.choices[0].message.content));
// TypeScript knows the shape now!
```

### Pattern 2: Resumable Workflows

```typescript
// Each step is resumable - if function times out, resumes from last completed step
const result = await step.run('step-name', async () => {
  return expensiveOperation();
});
```

### Pattern 3: Private Information Handling

```typescript
// Include in agent prompt, but never in responses
const prompt = `
Private Parameters (use strategically, DO NOT reveal):
- Max Salary: $${privateParams.maxSalary}

Public Message: Respond to the candidate without revealing exact budget.
`;
```

## Testing Strategy

### 1. Mock OpenAI Calls

```typescript
vi.mock('~/lib/openai', () => ({
  openai: {
    chat: {
      completions: {
        create: vi.fn().mockResolvedValue({
          choices: [{ message: { content: JSON.stringify(mockResponse) } }]
        })
      }
    }
  }
}));
```

### 2. Test Agent Logic Separately

```typescript
// Don't test OpenAI API - test YOUR logic
it('should reject if confidence < threshold', () => {
  const evaluation = { confidence: 0.3, isMatch: true };
  const result = applyConfidenceThreshold(evaluation, 0.5);
  expect(result.isMatch).toBe(false);
});
```

### 3. Integration Tests with Inngest

```typescript
// Inngest provides testing utilities
import { InngestTestEngine } from 'inngest';

const t = new InngestTestEngine({ functions: [agentNegotiation] });
await t.execute('match/negotiate', { data: mockEvent });
```

## Migration Path from LangChain

If we later need LangChain features:

1. **Keep Vercel AI SDK** for user-facing chat
2. **Add LangGraph** for complex multi-agent patterns
3. **Keep Inngest** for orchestration
4. **Mix and match** - use each tool where it's best

Our architecture doesn't lock us in - we can add LangChain selectively.

## Resources

- **Vercel AI SDK**: https://sdk.vercel.ai/docs
- **Inngest**: https://www.inngest.com/docs
- **OpenAI API**: https://platform.openai.com/docs
- **Zod**: https://zod.dev

## Feature Flags Integration

### Phased Rollout with Vercel Flags

JobBobber uses Vercel Flags SDK for progressive feature rollout:

```typescript
// src/lib/flags.ts
export const agentToAgentEnabled = flag({
  key: 'agent-to-agent',
  decide: () => false, // Start with MVP features only
});
```

**MVP → Beta → Full rollout:**

1. **MVP**: Flags all OFF - manual matching only
2. **Beta**: Enable agent-to-agent for beta users
3. **Full**: Gradual rollout (10% → 50% → 100%)

See `.claude/rules.md` for complete flag patterns.

## Tool Calling for Interactive Agents

### Agents Can Search Jobs During Chat

```typescript
// Agent automatically calls searchJobs tool
User: "Find me React jobs"
Agent: [searchJobsTool({ skills: ['React'] })]
Agent: "Found 10 matches! Here are the top 3..."
```

### Available Tools

1. **searchJobs** - Real-time job search
2. **getProfile** - Access user profile
3. **checkStatus** - Check application status
4. **submitApplication** - Apply on user's behalf

See `.claude/rules.md` for tool implementation patterns.

## Quick Start Checklist

- [ ] Install: `pnpm add ai @ai-sdk/openai inngest zod @vercel/flags`
- [ ] Create agent schemas in `src/server/agents/schemas.ts`
- [ ] Set up OpenAI client in `src/lib/openai.ts`
- [ ] Create Inngest client in `src/server/inngest/client.ts`
- [ ] Define feature flags in `src/lib/flags.ts`
- [ ] Create tools in `src/server/agents/tools.ts`
- [ ] Build first agent function in `src/server/agents/employer.ts`
- [ ] Create Inngest workflow in `src/server/inngest/functions/`
- [ ] Add chat route with tools in `src/app/api/chat/*/route.ts`
- [ ] Use `useChat()` hook in React component
- [ ] Write tests with mocked OpenAI responses and tools

---

**Philosophy**: Simple, explicit, type-safe. Build only what we need. Add complexity when needed, not before.
