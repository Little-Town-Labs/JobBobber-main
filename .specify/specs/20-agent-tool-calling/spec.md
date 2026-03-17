# Feature Specification: Agent Tool Calling

**Feature:** 20-agent-tool-calling
**Branch:** 20-agent-tool-calling
**PRD Sections:** §7.3 Tool Calling, §8.1 Job Seeker Flow, §8.2 Employer Flow
**Roadmap:** Phase 4 — Growth
**Priority:** P0
**Status:** Draft
**Created:** 2026-03-17
**Dependencies:** Feature 19 (User Chat Basic) — complete

---

## Overview

Feature 19 gave users a chat interface with their AI agent, but the agent can only answer questions using the static context assembled at the start of each message. It cannot look up specific data on demand.

This feature adds callable tools that the LLM can invoke during a conversation to retrieve live data: search job postings, look up the user's profile details, check match statuses, and read agent conversation summaries. When the user asks "show me my matches" or "find remote React jobs," the agent calls the appropriate tool and returns structured results.

Tools are role-scoped: seekers get job-search and match tools, employers get candidate-pipeline and posting tools. No tool can access data belonging to another user.

**Business Value:**

- Transforms chat from passive Q&A into an active assistant that can fetch real-time data
- Reduces navigation — users get answers without leaving the chat
- Foundation for action tools in the future (accept match, update profile)
- Differentiator: the agent doesn't just know your data, it can actively query the platform for you

---

## User Scenarios & Testing

### User Story 1 - Seeker Searches for Jobs (Priority: P1)

A job seeker asks their agent to find jobs matching specific criteria. The agent invokes a search tool and returns matching postings inline in the chat.

**Why this priority:** This is the highest-value tool — seekers can discover opportunities through natural language instead of navigating to a separate search page.

**Independent Test:** Can be tested by asking "find remote TypeScript jobs" and verifying the agent returns actual active postings matching that query.

**Acceptance Scenarios:**

1. **Given** 3 active postings with "TypeScript" in required skills, **When** a seeker asks "find TypeScript jobs," **Then** the agent invokes the search tool and returns those 3 postings with titles, companies, and locations.
2. **Given** no postings match the query, **When** the seeker asks "find Rust blockchain jobs," **Then** the agent responds that no matching positions were found and suggests broadening criteria.
3. **Given** 50 matching postings, **When** the seeker searches, **Then** the tool returns the top 10 most relevant results, not all 50.

---

### User Story 2 - Seeker Checks Match Status (Priority: P1)

A job seeker asks about their current matches. The agent invokes a match-status tool and returns a summary of all matches with their current statuses.

**Why this priority:** Users currently have to navigate to the match dashboard to see this. Chat should surface the same data.

**Independent Test:** Can be tested by asking "what are my matches?" and verifying the response includes actual match data with statuses.

**Acceptance Scenarios:**

1. **Given** a seeker with 5 matches (2 pending, 2 accepted, 1 declined), **When** they ask "what are my matches?", **Then** the agent returns all 5 with job titles, companies, confidence scores, and statuses.
2. **Given** a seeker asks about a specific match, **When** they say "tell me about my Acme Corp match," **Then** the agent returns the detailed match summary and reasoning for that specific match.
3. **Given** a seeker with no matches, **When** they ask about matches, **Then** the agent says no matches exist yet and suggests ensuring their profile is complete.

---

### User Story 3 - Employer Views Candidate Pipeline (Priority: P1)

An employer asks about candidates for a specific posting. The agent invokes a pipeline tool and returns candidate matches with scores and statuses.

**Why this priority:** Employers need quick access to pipeline data without navigating to each posting's match page.

**Independent Test:** Can be tested by asking "how are candidates looking for the Senior Engineer role?" and verifying the response references actual candidates.

**Acceptance Scenarios:**

1. **Given** a posting with 8 candidates (3 strong, 3 good, 2 potential), **When** the employer asks about candidates, **Then** the agent returns a summary grouped by confidence level with candidate names and statuses.
2. **Given** an employer with 3 active postings, **When** they ask "show me all my postings," **Then** the agent invokes the tool and lists all postings with titles, statuses, and match counts.
3. **Given** an employer asks about a closed posting, **When** the posting exists but is closed, **Then** the agent returns the posting info with its closed status and final match count.

---

### User Story 4 - Seeker Views Own Profile (Priority: P2)

A seeker asks the agent to show their profile details. The agent invokes a profile tool to retrieve the latest data rather than relying on the cached context.

**Why this priority:** Useful but lower priority — the agent's system prompt already has profile context. The tool ensures fresh data after recent edits.

**Independent Test:** Can be tested by updating a profile field, then asking "show me my profile" and verifying the updated value appears.

**Acceptance Scenarios:**

1. **Given** a seeker with a complete profile, **When** they ask "show me my profile," **Then** the agent returns name, headline, skills, experience, education, location, and completeness score.
2. **Given** a seeker recently updated their skills, **When** they ask about skills, **Then** the tool returns the current skills (not the stale context from session start).

---

### User Story 5 - Seeker Reads Conversation Summaries (Priority: P2)

A seeker asks what their agent discussed with a specific employer. The agent invokes a conversation-log tool to retrieve the redacted summary.

**Why this priority:** Builds transparency — users can understand why matches succeeded or failed.

**Independent Test:** Can be tested by asking "what did my agent discuss with TechCo?" and verifying the response includes conversation outcome details.

**Acceptance Scenarios:**

1. **Given** a completed conversation with TechCo that resulted in a match, **When** the seeker asks about it, **Then** the agent returns the conversation status, outcome, and a summary.
2. **Given** a conversation that resulted in no match, **When** the seeker asks why, **Then** the agent explains the outcome without revealing the employer's private parameters.
3. **Given** no conversation exists with the specified company, **When** the seeker asks, **Then** the agent says no conversation was found.

---

### Edge Cases

- **What happens when a tool call fails (DB error)?** The agent receives an error result and tells the user: "I couldn't retrieve that data right now. Please try again."
- **What happens when a tool returns too much data?** Tools enforce their own limits (e.g., max 10 search results, max 20 matches) to prevent context window overflow.
- **What happens when the LLM calls a tool it shouldn't have access to?** Tool definitions are role-scoped — seeker tools are not defined for employer sessions and vice versa. The LLM cannot call a tool that wasn't provided.
- **What happens when the user asks the agent to take an action ("accept this match")?** No action tools exist in this feature. The agent explains that actions are not yet available and suggests using the dashboard.
- **What happens if the LLM hallucinates a tool call with invalid parameters?** The Zod schema validation on tool inputs rejects invalid parameters and returns a validation error to the LLM, which can retry or explain the issue.
- **What happens when multiple tools are needed to answer a question?** The LLM can make multiple sequential tool calls in a single turn (e.g., search jobs → then get details on a specific match).
- **What happens when tool results are stale by the time the user reads them?** Tools return live data. Results reflect the database state at the moment of the call. No caching.

---

## Requirements

### Functional Requirements

- **FR-001**: System MUST define a minimum of 4 tools: job search, match status, profile lookup, and conversation log retrieval.
- **FR-002**: Tools MUST be role-scoped — seekers receive seeker tools, employers receive employer tools. No cross-role tool access.
- **FR-003**: Each tool MUST validate its inputs with a schema before execution. Invalid inputs MUST return a structured error to the LLM.
- **FR-004**: Each tool MUST validate that the requesting user owns the data being accessed. No cross-user data access.
- **FR-005**: Tool results MUST be returned to the LLM as structured data that it can summarize in natural language for the user.
- **FR-006**: The LLM MUST be able to make multiple tool calls in a single conversation turn.
- **FR-007**: Tool calls MUST use the user's existing BYOK API key (same as chat — no additional keys).
- **FR-008**: Tool results MUST NOT include other users' private negotiation parameters.
- **FR-009**: Search tools MUST enforce result limits (max 10 results per call) to prevent context window overflow.
- **FR-010**: All tool calls MUST be rate-limited under the existing chat rate limit (10 messages/minute includes tool-calling turns).
- **FR-011**: Tools MUST NOT modify any data. All tools are read-only in this feature.
- **FR-012**: Tool calling MUST be gated behind a feature flag (`AGENT_TOOL_CALLING`).

### Seeker Tools

- **FR-013**: `searchJobs` — search active job postings by keywords, skills, location, employment type. Returns title, company, location, salary range, match confidence (if available).
- **FR-014**: `getMyMatches` — list the seeker's current matches with job title, company, confidence score, seeker status, employer status.
- **FR-015**: `getMyProfile` — return the seeker's current profile data (name, headline, skills, experience, education, location, completeness).
- **FR-016**: `getConversationSummary` — retrieve the outcome and summary of a specific agent-to-agent conversation by posting title or company name.

### Employer Tools

- **FR-017**: `getCandidates` — list matched candidates for a specific posting with candidate name, confidence score, match summary, and status.
- **FR-018**: `getMyPostings` — list all job postings with title, status, and match count.
- **FR-019**: `getPostingDetails` — retrieve full details of a specific posting including description, required skills, and candidate pipeline metrics.
- **FR-020**: `getConversationSummary` — same as seeker version but scoped to employer's postings.

### Key Entities

- **Tool**: A callable function with a name, description, input schema, and output schema. Invoked by the LLM during chat.
- **ToolResult**: The structured data returned by a tool call, consumed by the LLM to generate a natural language response.
- **ToolCall**: A record of a tool invocation including tool name, input parameters, and result.

---

## Success Criteria

### Measurable Outcomes

- **SC-001**: Tool calls complete within 500ms (p90) — tools query existing indexed data, not LLM calls.
- **SC-002**: LLM correctly selects the appropriate tool for the user's query in 90%+ of cases (measured via manual QA sampling).
- **SC-003**: Zero instances of cross-user data access via tool calls (verified via security test suite).
- **SC-004**: All 4+ tools functional for both seeker and employer roles.
- **SC-005**: 80%+ test coverage on tool-related code (constitutional requirement).
