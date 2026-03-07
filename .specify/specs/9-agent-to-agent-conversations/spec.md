# Feature Specification: Agent-to-Agent Conversations

**Feature:** 9-agent-to-agent-conversations
**Branch:** 9-agent-to-agent-conversations
**PRD Sections:** 7.2 Agent-to-Agent Interaction Model, 7.3 Agent Guardrails
**Priority:** P0
**Status:** Draft
**Created:** 2026-03-06
**Dependencies:** Feature 5 (Basic AI Matching), Feature 8 (Private Negotiation Parameters)

---

## Overview

Agent-to-Agent Conversations is the defining feature of JobBobber's Phase 2. Instead of the MVP's one-directional matching (employer agent evaluates static profiles), this feature enables a full multi-turn automated dialogue between an Employer Agent and a Job Seeker Agent.

The conversation follows a structured flow: discovery, initial screening, deep evaluation, negotiation alignment, and match decision. Each agent operates autonomously using its owner's BYOK API key and private negotiation parameters. Agents strategically use private parameters (salary expectations, deal-breakers, priorities) without disclosing exact values to the other party. All conversations are persisted and linked to a workflow run for observability and resumability.

No human intervention occurs during the conversation. Matches are surfaced to users only after both agents reach consensus. If either agent determines there is insufficient alignment, the conversation terminates silently with no notification to either party.

**Business Value:**

- Transforms matching from static evaluation to dynamic negotiation
- Enables nuanced assessment that considers both sides' preferences
- Protects users' private negotiation leverage through strategic agent behavior
- Maintains full autonomy (no human-in-the-loop until interview stage)

---

## User Stories

### User Story 1: Employer Initiates Agent Conversation

**As an** employer
**I want** my agent to automatically start conversations with promising candidates when I activate a job posting
**So that** my agent can conduct in-depth evaluations beyond a simple score

**Acceptance Criteria:**

- [ ] When a job posting is activated, the Employer Agent identifies eligible candidates (as in Feature 5)
- [ ] For each candidate above a configurable score threshold, the system initiates a conversation between the Employer Agent and the Job Seeker Agent
- [ ] The Employer Agent uses the employer's BYOK API key for all LLM calls
- [ ] The Job Seeker Agent uses the job seeker's BYOK API key for all LLM calls
- [ ] Conversations are created as AgentConversation records with status IN_PROGRESS

**Priority:** High

---

### User Story 2: Multi-Turn Agent Dialogue

**As a** platform user (employer or job seeker)
**I want** my agent to conduct a thorough, multi-turn evaluation
**So that** match decisions are based on substantive back-and-forth rather than a single assessment

**Acceptance Criteria:**

- [ ] Each conversation consists of a minimum of 3 turns before a match decision can be made
- [ ] The conversation follows a structured progression: discovery, screening, deep evaluation, negotiation alignment, match decision
- [ ] Each turn is persisted as a message in the AgentConversation.messages array
- [ ] Each message includes: role (employer_agent or seeker_agent), content, timestamp, and conversation phase
- [ ] The conversation can span multiple workflow steps (resumable after interruption)

**Priority:** High

---

### User Story 3: Private Parameter Protection

**As a** job seeker or employer
**I want** my agent to use my private negotiation parameters strategically without revealing exact values
**So that** my negotiation leverage is preserved

**Acceptance Criteria:**

- [ ] The Employer Agent has access to the employer's private job settings (true max salary, urgency, willingness to train, priority attributes)
- [ ] The Job Seeker Agent has access to the seeker's private settings (minimum salary, deal-breakers, priorities, exclusions)
- [ ] Agents express preferences in qualitative terms (e.g., "salary expectations are within range") rather than disclosing exact figures
- [ ] No private parameter values appear in conversation messages stored in the database
- [ ] Private parameters are injected into agent context via server-side-only prompt construction

**Priority:** High

---

### User Story 4: No-Match Quiet Termination

**As a** job seeker or employer
**I want** to NOT be notified when my agent determines there is no fit
**So that** I am only bothered with genuine opportunities

**Acceptance Criteria:**

- [ ] Either agent can signal a no-match conclusion at any point after the minimum turns
- [ ] When no-match is determined, the conversation status transitions to COMPLETED_NO_MATCH
- [ ] Neither party receives any notification about the no-match conversation
- [ ] The conversation record is retained for analytics but not surfaced in the user's dashboard
- [ ] The no-match decision is logged with a brief reason (for platform analytics only, not shown to users)

**Priority:** High

---

### User Story 5: Conversation Produces a Match

**As a** job seeker and employer
**I want** a match to be generated when both agents agree there is sufficient alignment
**So that** we can proceed to the mutual review and interview stage

**Acceptance Criteria:**

- [ ] Both agents must independently signal "match" for a Match record to be created
- [ ] The match includes an AI-generated summary explaining the alignment from both perspectives
- [ ] The conversation status transitions to COMPLETED_MATCH
- [ ] The Match record references the AgentConversation that produced it
- [ ] Confidence score (STRONG/GOOD/POTENTIAL) is derived from conversation depth and alignment signals

**Priority:** High

---

### User Story 6: Agent Guardrails Enforcement

**As a** platform operator
**I want** both agents to operate within strict ethical and behavioral boundaries
**So that** conversations are fair, non-discriminatory, and protect user privacy

**Acceptance Criteria:**

- [ ] Agents never fabricate qualifications, experience, or other factual claims
- [ ] Agents never reference or evaluate based on protected characteristics (race, gender, age, disability, religion, national origin)
- [ ] Agents never disclose exact private parameter values (salary figures, specific deal-breakers)
- [ ] Agent output is validated against guardrail rules before being stored
- [ ] Conversations that violate guardrails are terminated with status TERMINATED
- [ ] Guardrail instructions are part of the system prompt, not optional

**Priority:** High

---

### User Story 7: Conversation Resilience

**As a** platform operator
**I want** agent conversations to handle interruptions and errors gracefully
**So that** in-progress conversations are never lost

**Acceptance Criteria:**

- [ ] Conversations are managed by a resumable workflow (survives server restarts)
- [ ] If a BYOK key becomes invalid mid-conversation, the conversation pauses and the user is prompted to update their key
- [ ] If one agent's LLM call fails (rate limit, timeout), the system retries with backoff before terminating
- [ ] Conversation state (all messages) is persisted after each turn
- [ ] A conversation that has been paused can resume from the last completed turn
- [ ] Maximum conversation length is configurable (default: 10 turns) to prevent runaway costs

**Priority:** Medium

---

## Functional Requirements

### FR-1: Conversation Initiation

After the initial matching workflow (Feature 5) scores candidates, the system initiates agent-to-agent conversations for candidates scoring above a configurable threshold (default: 40). One conversation is created per candidate-posting pair. The Employer Agent sends the opening message.

### FR-2: Agent Identity and Key Resolution

Each conversation involves two distinct agents:

- **Employer Agent**: Uses the employer's BYOK API key, has access to job posting details and employer's private job settings
- **Job Seeker Agent**: Uses the job seeker's BYOK API key, has access to the seeker's profile and private settings

If either party lacks a valid BYOK key, the conversation cannot proceed for that candidate.

### FR-3: Conversation Flow Phases

Each conversation progresses through defined phases:

1. **Discovery**: Employer Agent introduces the role; Job Seeker Agent presents qualifications
2. **Screening**: Back-and-forth on core requirements, skills alignment, experience fit
3. **Deep Evaluation**: Detailed probing of specific qualifications, cultural fit, role expectations
4. **Negotiation Alignment**: Agents assess alignment on compensation, work arrangement, and priorities — using qualitative signals only
5. **Match Decision**: Each agent independently evaluates whether to recommend a match

Phases are tracked per conversation. The minimum turns requirement applies across phases, not per phase.

### FR-4: Message Schema

Each message in a conversation contains:

- `role`: "employer_agent" or "seeker_agent"
- `content`: The message text
- `phase`: Current conversation phase
- `timestamp`: When the message was generated
- `turnNumber`: Sequential turn counter

### FR-5: Match Decision Protocol

After the minimum turns (default: 3), either agent may signal a match decision:

- **MATCH**: Agent recommends proceeding
- **NO_MATCH**: Agent recommends terminating
- **CONTINUE**: Agent wants more information (extends conversation)

A Match record is created only when both agents signal MATCH. If either signals NO_MATCH, the conversation ends.

### FR-6: Conversation Termination

A conversation ends when:

- Both agents signal MATCH (status: COMPLETED_MATCH)
- Either agent signals NO_MATCH (status: COMPLETED_NO_MATCH)
- Maximum turn limit is reached without consensus (status: COMPLETED_NO_MATCH)
- A guardrail violation is detected (status: TERMINATED)
- An unrecoverable error occurs (status: TERMINATED)

### FR-7: Private Parameter Injection

Private parameters are injected into the agent's system prompt at runtime:

- Server-side only — never sent to the client
- Parameters are provided as structured context, not raw user text
- The system prompt instructs the agent to use parameters strategically without disclosure
- Agent output is filtered to remove any accidental numeric disclosure of private values

### FR-8: Conversation-to-Match Linkage

When a match is produced, the Match record references the AgentConversation via `conversationId`. The match summary is generated from the final conversation state, incorporating perspectives from both agents.

### FR-9: Duplicate Prevention

Only one active conversation (status IN_PROGRESS) can exist per seeker-posting pair. If a conversation already exists for a candidate-posting pair, a new one is not created.

### FR-10: Workflow Integration

Each conversation is managed by a single workflow run. The workflow:

- Creates the AgentConversation record
- Alternates between Employer Agent and Job Seeker Agent turns
- Persists messages after each turn
- Evaluates termination conditions after each turn
- Creates Match record on mutual match
- Updates conversation status on completion

The workflow run ID is stored on the AgentConversation record for bidirectional lookup.

---

## Non-Functional Requirements

### NFR-1: Performance

- Individual agent turn (LLM call + persistence) should complete within 15 seconds
- Full 10-turn conversation should complete within 5 minutes
- Concurrent conversations (up to 50 per posting activation) must not interfere with each other

### NFR-2: Reliability

- Conversations are resumable after workflow interruption
- Message persistence is atomic per turn (no partial messages)
- Workflow state survives server restarts via the workflow engine's persistence
- Failed LLM calls retried 3 times with exponential backoff before marking turn as failed

### NFR-3: Security

- BYOK keys decrypted only at LLM call time, never persisted in workflow state or conversation messages
- Private parameter values never appear in stored messages
- Agent output validated before storage
- No cross-tenant data access (employer cannot see another employer's conversations)

### NFR-4: Cost Control

- Maximum turn limit prevents runaway LLM costs (configurable, default: 10)
- Each conversation logs total LLM calls made (one per turn per agent)
- If a seeker's BYOK key has insufficient credits, the conversation fails gracefully

### NFR-5: Observability

- Each conversation has a traceable workflow run ID
- Conversation status queryable for monitoring dashboards
- Turn count and phase progression trackable per conversation
- Error reasons logged for terminated conversations

---

## Edge Cases & Error Handling

### EC-1: Job Seeker Has No BYOK Key

If a job seeker has not configured a BYOK key, the conversation cannot proceed. The system skips that candidate. No notification is sent (the seeker already sees BYOK setup prompts in their dashboard).

### EC-2: BYOK Key Becomes Invalid Mid-Conversation

If an agent's LLM call fails due to an invalid API key, the conversation is paused (remains IN_PROGRESS). The affected user sees a prompt to update their key. The conversation can resume from the last completed turn once the key is updated.

### EC-3: One Agent Produces Guardrail-Violating Output

If an agent's output references protected characteristics or discloses exact private parameter values:

- The violating message is not stored
- The agent is re-prompted with stronger guardrail instructions (one retry)
- If the retry also violates, the conversation is terminated with status TERMINATED

### EC-4: Maximum Turns Reached Without Decision

If the conversation reaches the maximum turn limit without both agents signaling MATCH, it ends as COMPLETED_NO_MATCH. This prevents infinite or excessively long conversations.

### EC-5: Job Posting Deactivated Mid-Conversation

If the employer deactivates the job posting during an active conversation, in-progress conversations complete their current turn and then terminate with status TERMINATED. No match is generated.

### EC-6: Concurrent Conversation Limit

To prevent excessive cost, a single posting activation can trigger at most 50 concurrent conversations. Additional candidates are queued and processed as earlier conversations complete.

### EC-7: Agent Hallucination or Off-Topic Response

If an agent produces output that does not follow the expected conversation structure (e.g., random content, irrelevant topic), the turn is retried once. If the retry also fails structure validation, the conversation is terminated.

### EC-8: Both Agents Signal NO_MATCH on First Eligible Turn

If both agents signal NO_MATCH after the minimum turns, the conversation ends immediately. This is the most common termination path for poor-fit candidates and should be handled efficiently.

---

## Out of Scope

The following capabilities are explicitly excluded from this feature:

- **Two-way matching consensus** — Both agents evaluating independently is Feature 10 (this feature lays the conversation infrastructure; Feature 10 adds the bidirectional consensus protocol)
- **Vector search for candidate discovery** — Feature 11
- **Conversation log viewing by users** — Feature 12
- **Custom agent prompting** — Feature 15
- **Aggregate feedback insights from conversations** — Feature 14

---

## Success Metrics

| Metric                       | Target                                                                | Measurement                              |
| ---------------------------- | --------------------------------------------------------------------- | ---------------------------------------- |
| Conversation completion rate | >90% of conversations reach a decision (not terminated)               | Monitor conversation status distribution |
| Match quality improvement    | >15% improvement in mutual accept rate vs Feature 5 baseline          | Compare mutual accept rates              |
| Average conversation length  | 4-6 turns (indicates substantive evaluation, not premature decisions) | Track turn counts                        |
| Private parameter protection | 0 instances of exact value disclosure in stored messages              | Automated audit of message content       |
| Guardrail compliance         | <1% of conversations terminated due to guardrail violations           | Monitor TERMINATED status reasons        |
| Conversation throughput      | 50 concurrent conversations per posting without degradation           | Load testing                             |

---

## Glossary

| Term                  | Definition                                                                                                                 |
| --------------------- | -------------------------------------------------------------------------------------------------------------------------- |
| Employer Agent        | AI agent acting on behalf of an employer, using the employer's BYOK key                                                    |
| Job Seeker Agent      | AI agent acting on behalf of a job seeker, using the seeker's BYOK key                                                     |
| Conversation Turn     | One complete message from one agent (alternating between employer and seeker agents)                                       |
| Conversation Phase    | A stage in the structured conversation flow (discovery, screening, deep evaluation, negotiation alignment, match decision) |
| Match Decision Signal | An agent's recommendation: MATCH, NO_MATCH, or CONTINUE                                                                    |
| Quiet Termination     | A no-match outcome that generates no user-facing notification                                                              |
| Guardrail             | A behavioral constraint on agent output (anti-discrimination, no private disclosure, no fabrication)                       |
