# Feature Specification: User Chat (Basic)

**Feature:** 19-user-chat-basic
**Branch:** 19-user-chat-basic
**PRD Sections:** §8.1 Job Seeker Flow, §8.2 Employer Flow
**Roadmap:** Phase 4 — Growth
**Priority:** P0
**Status:** Implemented
**Created:** 2026-03-16
**Dependencies:** Features 1–18 (complete platform), especially Feature 2 (BYOK), Feature 9 (Agent Conversations), Feature 12 (Conversation Logs)

---

## Overview

User Chat is the first user-facing AI interaction in JobBobber. Today, AI agents operate entirely behind the scenes — evaluating candidates, conducting agent-to-agent negotiations, and surfacing matches. Users never directly interact with their agent.

This feature adds a conversational interface where job seekers and employers can ask questions, get advice, and understand their agent's activity. The chat agent has read-only access to the user's profile, matches, and agent conversation summaries. It answers questions, explains match reasoning, and offers job search or hiring guidance — but it does not take actions or modify data (that is Feature 20: Tool Calling).

The chat uses the user's own BYOK API key. No platform API keys are used.

**Business Value:**

- Closes the biggest UX gap: users can finally "talk to" the AI that represents them
- Builds trust by making agent behavior explainable and transparent
- Increases engagement and session duration
- Foundation for tool calling (Feature 20), advanced chat (Feature 21), and streaming outputs (Feature 22)

---

## User Scenarios & Testing

### User Story 1 - Job Seeker Asks About Their Matches (Priority: P1)

A job seeker opens the chat and asks their agent about current matches, why they were matched with certain companies, and what they could do to improve their profile. The agent draws on the user's profile data and match history to give personalized answers.

**Why this priority:** This is the core use case — a user wanting to understand and improve their job search. Delivers immediate standalone value.

**Independent Test:** Can be fully tested by opening chat, sending a question about matches, and receiving a contextual response that references actual match data.

**Acceptance Scenarios:**

1. **Given** a job seeker with 3 active matches, **When** they ask "Why was I matched with Acme Corp?", **Then** the agent responds with specific reasoning drawn from the match summary for that company.
2. **Given** a job seeker with a 65% profile completeness score, **When** they ask "How can I improve my profile?", **Then** the agent identifies missing sections (e.g., "You haven't added education details") based on the actual profile data.
3. **Given** a job seeker with no matches yet, **When** they ask about matches, **Then** the agent explains that no matches have been generated yet and suggests ensuring their profile is complete and their API key is active.

---

### User Story 2 - Employer Asks About Candidate Pipeline (Priority: P1)

An employer opens the chat and asks their agent about the status of candidates for a specific job posting — how many are in the pipeline, which ones look strongest, and why certain candidates were rejected by the agent.

**Why this priority:** Employers are the paying customers. Giving them direct access to their agent's reasoning is critical for trust and retention.

**Independent Test:** Can be fully tested by opening chat, asking about a specific posting's candidates, and receiving a response that references actual pipeline data.

**Acceptance Scenarios:**

1. **Given** an employer with an active posting that has 5 matches, **When** they ask "How are candidates looking for the Senior Engineer role?", **Then** the agent summarizes the match pipeline with candidate counts by status (pending/accepted/declined).
2. **Given** an employer, **When** they ask "Why was candidate X rejected?", **Then** the agent explains using the conversation outcome data, without revealing the candidate's private negotiation parameters.
3. **Given** an employer with no active postings, **When** they ask about candidates, **Then** the agent prompts them to create and activate a posting first.

---

### User Story 3 - Real-Time Streaming Response (Priority: P1)

When a user sends a message, the response streams in token-by-token rather than appearing all at once after a delay. This provides immediate feedback that the system is working.

**Why this priority:** Streaming is table-stakes UX for any chat interface. Without it, users see a blank response area for 3-10 seconds and assume the system is broken.

**Independent Test:** Can be tested by sending a message and verifying that partial response text appears within 500ms of submission.

**Acceptance Scenarios:**

1. **Given** a user sends a message, **When** the agent begins generating a response, **Then** tokens appear in the UI progressively (not all at once).
2. **Given** a slow LLM response (>5 seconds), **When** streaming is active, **Then** the user sees partial content within the first second.
3. **Given** a network interruption during streaming, **When** the connection drops, **Then** the partial response is preserved and an error message is shown.

---

### User Story 4 - Chat History Persistence (Priority: P2)

A user's chat messages persist across sessions. When they return to the chat page, previous messages are loaded so they can continue the conversation or reference past answers.

**Why this priority:** Without persistence, the chat resets on every page load and users lose context. Important but not strictly required for a first interaction.

**Independent Test:** Can be tested by sending messages, navigating away, returning to chat, and verifying previous messages are displayed.

**Acceptance Scenarios:**

1. **Given** a user with 10 previous chat messages, **When** they navigate to the chat page, **Then** the previous messages are displayed in chronological order.
2. **Given** a user returns after 24 hours, **When** they open chat, **Then** their previous conversation is loaded and the agent remembers context from prior messages.
3. **Given** a user with a very long chat history (100+ messages), **When** they open chat, **Then** only the most recent messages are loaded initially, with older messages loadable on demand.

---

### User Story 5 - Agent Context Awareness (Priority: P2)

The chat agent's responses are grounded in the user's actual data — not generic advice. The agent knows the user's profile, skills, location, match history, and (for seekers) private settings like salary expectations. The agent never fabricates data about the user.

**Why this priority:** Generic chatbot responses add no value. Context-aware responses are what differentiate this from ChatGPT.

**Independent Test:** Can be tested by asking a specific question about the user's own data and verifying the response references real values from the database.

**Acceptance Scenarios:**

1. **Given** a seeker with skills ["TypeScript", "React", "Node.js"], **When** they ask "What are my top skills?", **Then** the agent lists those specific skills.
2. **Given** a seeker with a $120k minimum salary setting, **When** they ask about their salary expectations, **Then** the agent references the actual figure (private data is accessible to the user's own agent).
3. **Given** an employer with 3 active postings, **When** they ask "What postings do I have?", **Then** the agent lists the actual posting titles and statuses.
4. **Given** a seeker asks "What did my agent discuss with Acme Corp?", **When** a conversation log exists for that employer, **Then** the agent summarizes the conversation (with PII redaction already applied at storage time).

---

### User Story 6 - BYOK Key Required (Priority: P2)

Chat is only available when the user has a valid BYOK API key configured. If no key is set, the chat interface shows a prompt to configure one rather than a broken input field.

**Why this priority:** Prevents a confusing error experience and drives BYOK onboarding.

**Independent Test:** Can be tested by accessing chat without a configured API key and verifying the setup prompt is shown.

**Acceptance Scenarios:**

1. **Given** a user without a configured API key, **When** they navigate to chat, **Then** they see a message explaining that an API key is required with a link to the key setup page.
2. **Given** a user with an expired/invalid API key, **When** they send a message, **Then** they receive a clear error message suggesting they re-validate their key.
3. **Given** a user with a valid API key, **When** they open chat, **Then** the chat input is active and ready for messages.

---

### Edge Cases

- **What happens when the LLM provider is down?** The chat displays an error message indicating the provider is temporarily unavailable. Previous messages are preserved. The user can retry.
- **What happens when the user's API key runs out of credits?** The chat displays the provider's error message in a user-friendly format (e.g., "Your OpenAI account has insufficient credits").
- **What happens when the user asks the agent to do something (e.g., "Accept all my matches")?** The agent explains that it can only provide information and advice in this version. Actions will be available in a future update (Feature 20).
- **What happens when the user asks about another user's private data?** The agent has no access to other users' data. It responds that it can only discuss the user's own profile and matches.
- **What happens when a seeker asks what an employer's private salary budget is?** The agent does not have access to other parties' private parameters and says so.
- **What happens with very long messages (>5000 characters)?** Input is truncated or rejected with a character limit notice before submission.
- **What happens in concurrent sessions (multiple tabs)?** Messages sent in one tab appear in the other on refresh. No real-time sync required for v1.
- **What happens when chat history exceeds the LLM context window?** Older messages are summarized or truncated to fit within the provider's context limit. The user sees full history in the UI regardless.
- **What happens when a user sends more than 10 messages in a minute?** The input is temporarily disabled with a message: "You're sending messages too quickly. Please wait a moment."
- **What happens when a user asks non-job-related questions?** The agent politely redirects: "I'm best at helping with your job search — try asking about your matches or profile."
- **What happens when a user deletes their account?** All chat messages are cascade-deleted as part of the existing GDPR deletion flow (Feature 18).

---

## Requirements

### Functional Requirements

- **FR-001**: System MUST provide a chat interface accessible from both job seeker and employer dashboards.
- **FR-002**: System MUST stream agent responses token-by-token in real time.
- **FR-003**: System MUST use the user's own BYOK API key for all chat LLM calls. No platform keys.
- **FR-004**: System MUST persist chat messages so they survive page navigation and session restarts.
- **FR-005**: System MUST provide the agent with read-only context of the user's profile data.
- **FR-006**: System MUST provide the agent with read-only context of the user's match history and statuses.
- **FR-007**: System MUST provide the seeker's agent with the seeker's own private settings (salary, deal-breakers) for answering questions about their own preferences.
- **FR-008**: System MUST NOT provide the agent with any other user's data (profiles, private settings, or raw conversation content not already available via the user's conversation logs).
- **FR-009**: System MUST display a setup prompt when the user has no valid BYOK key configured, instead of a non-functional chat input.
- **FR-010**: System MUST gracefully handle LLM provider errors (rate limits, outages, insufficient credits) with user-friendly messages.
- **FR-011**: System MUST enforce a maximum input message length to prevent abuse.
- **FR-011a**: System MUST rate-limit chat messages to 10 per minute per user to prevent spam and excessive BYOK API spend.
- **FR-012**: System MUST NOT allow the chat agent to modify any data (profiles, matches, settings). Chat is read-only in this feature. Data modification comes in Feature 20 (Tool Calling).
- **FR-013**: System MUST load previous chat history when the user returns to the chat page.
- **FR-014**: System MUST manage LLM context window limits by summarizing or truncating older messages while preserving full history in the UI.
- **FR-015**: Chat MUST be gated behind a feature flag (`USER_CHAT`).
- **FR-016**: Chat message data MUST be included in GDPR account deletion cascades (Feature 18). No independent retention policy for v1.
- **FR-017**: The chat agent MUST identify itself as the user's JobBobber agent, stay focused on job search and hiring topics, and politely redirect off-topic questions.

### Key Entities

- **ChatMessage**: Represents a single message in the conversation. Attributes: sender (user or agent), content (text), timestamp. Associated with a user.
- **ChatSession**: A conversation thread for a user. Contains an ordered list of ChatMessages. One active session per user.
- **AgentContext**: Read-only data assembled for the agent before each response: user profile, match summaries, private settings (own user only), conversation log summaries.

---

## Success Criteria

### Measurable Outcomes

- **SC-001**: First token of agent response appears within 1 second of message submission (90th percentile).
- **SC-002**: Chat page loads with history in under 2 seconds (90th percentile).
- **SC-003**: Agent responses reference actual user data (profile, matches) in at least 80% of data-related questions (measured via manual QA sampling).
- **SC-004**: Zero instances of cross-user data leakage in agent responses (verified via security test suite).
- **SC-005**: Chat is functional for both seeker and employer roles with role-appropriate context.
- **SC-006**: 80%+ test coverage on chat-related code (constitutional requirement).
