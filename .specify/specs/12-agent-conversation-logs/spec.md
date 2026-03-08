# Feature 12: Agent Conversation Logs

## Overview

Transparency feature enabling users to read full logs of conversations their AI agent participated in. Provides a read-only view in the dashboard with privacy-preserving redaction of sensitive parameters. Users can opt out of their conversation data being used for model improvement.

## User Stories

### User Story 1: Seeker Views Conversation Logs

**As a** job seeker
**I want** to view the full conversation logs of my agent's interactions with employer agents
**So that** I understand what was discussed on my behalf and can verify accuracy

**Acceptance Criteria:**

- [ ] Seeker can access a list of all conversations their agent participated in
- [ ] Each conversation displays messages in chronological order
- [ ] Messages clearly indicate which agent (seeker vs employer) sent each message
- [ ] Timestamps are shown for each message
- [ ] Conversation list is sorted by most recent activity

**Priority:** High

### User Story 2: Employer Views Conversation Logs

**As an** employer
**I want** to view the conversation logs between my agent and candidate agents for a specific job posting
**So that** I can understand the evaluation process and verify agent behavior

**Acceptance Criteria:**

- [ ] Employer can access conversation logs grouped by job posting
- [ ] Each conversation shows the candidate name/identifier alongside the log
- [ ] Employer can filter conversations by job posting
- [ ] Conversation status (active, completed, declined) is visible
- [ ] Messages display in chronological order with agent attribution

**Priority:** High

### User Story 3: Sensitive Data Redaction

**As a** user (seeker or employer)
**I want** private parameters and exact figures to be redacted from conversation logs
**So that** sensitive negotiation details and personal data are protected

**Acceptance Criteria:**

- [ ] Exact salary figures are redacted from displayed logs
- [ ] Private negotiation parameters (minimum acceptable salary, maximum budget) are never shown
- [ ] Redacted content is replaced with a clear placeholder (e.g., "[REDACTED]")
- [ ] Redaction occurs at the API layer before data reaches the client
- [ ] Non-sensitive conversation content remains fully readable

**Priority:** High

### User Story 4: Data Usage Opt-Out

**As a** user
**I want** to opt out of my conversation data being used for model improvement
**So that** I maintain control over how my data is used

**Acceptance Criteria:**

- [ ] User can toggle a data usage preference in their settings
- [ ] Default state is clearly communicated during onboarding
- [ ] Opting out does not affect the user's ability to view their own logs
- [ ] Opt-out preference is respected immediately upon change
- [ ] User receives confirmation when preference is updated

**Priority:** Medium

### User Story 5: Empty and Error States

**As a** user
**I want** clear feedback when no conversations exist or logs cannot be loaded
**So that** I understand the current state without confusion

**Acceptance Criteria:**

- [ ] Empty state message shown when user has no conversations yet
- [ ] Error message displayed if logs fail to load
- [ ] Retry option available on error
- [ ] Loading indicator shown while fetching conversation data

**Priority:** Medium

## Functional Requirements

### FR-001: Conversation Log Retrieval

The system shall provide an API to retrieve conversation logs for an authenticated user, returning only conversations where the user's agent was a participant.

### FR-002: Message Chronological Display

Each conversation log shall display messages in chronological order, with sender attribution (seeker agent or employer agent) and timestamps.

### FR-003: Storage-Time Redaction

Sensitive data (exact salary figures, private negotiation parameters, minimum/maximum thresholds) shall be redacted at the API layer before reaching clients. Raw messages are retained internally for agent reasoning but never exposed via user-facing endpoints.

### FR-004: Redaction Placeholders

Redacted content shall be replaced with a standardized placeholder (e.g., "[REDACTED]") that clearly indicates content was removed for privacy.

### FR-005: Data Usage Opt-Out Setting

Users shall be able to set a preference controlling whether their conversation data may be used for model improvement purposes. This preference shall be stored per-user.

### FR-006: Authorization Scoping

Users shall only access conversations involving their own agent. A seeker cannot view another seeker's conversations. An employer can only view conversations for their own job postings.

### FR-007: Conversation List with Filtering

The system shall support listing conversations with filtering by job posting (employer) and pagination for users with many conversations.

## Non-Functional Requirements

### NFR-001: Performance

- Conversation list loads within 500ms (90th percentile) for users with up to 100 conversations
- Individual conversation log loads within 300ms (90th percentile)

### NFR-002: Security

- Authorization enforced at API layer — no data leakage across users
- Redaction is permanent and server-side; raw sensitive data never reaches the client

### NFR-003: Accessibility

- Conversation logs are screen-reader compatible
- Color is not the sole differentiator between sender agents
- Keyboard navigable

### NFR-004: Scalability

- Pagination required for conversation lists exceeding 20 items
- Message display handles conversations with up to 50 messages without degradation

## Edge Cases & Error Handling

1. **Conversation with no messages**: Display empty conversation state with explanation
2. **All content redacted**: If an entire message is redacted, show placeholder message rather than empty bubble
3. **Concurrent conversation updates**: If a conversation is active while user views it, display a "conversation in progress" indicator
4. **Deleted user on other side**: If the other participant's account is deleted, still show conversation with "[Deleted User]" attribution
5. **Opt-out after conversations stored**: Opt-out applies going forward; already-stored logs remain accessible to the user but are flagged as excluded from model training
6. **Very long messages**: Messages exceeding display area should be scrollable or expandable
7. **Network failure during load**: Show cached data if available, otherwise error with retry

## Success Metrics

- 80%+ of active users view conversation logs at least once per week
- Average time-to-load for conversation list < 500ms
- Zero incidents of cross-user data leakage
- < 1% of users report confusion about redacted content
