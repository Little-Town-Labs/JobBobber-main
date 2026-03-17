# Feature Specification: Advanced Chat with Tools

**Feature:** 21-advanced-chat-with-tools
**Branch:** 21-advanced-chat-with-tools
**PRD Sections:** §8.1 Advanced Seeker Flow, §8.2 Advanced Employer Flow
**Roadmap:** Phase 4 — Growth
**Priority:** P1
**Status:** Draft
**Created:** 2026-03-17
**Dependencies:** Feature 19 (User Chat Basic), Feature 20 (Agent Tool Calling)

---

## Overview

Features 19 and 20 deliver a functional chat with tool calling, but tool results are rendered as plain text summaries by the LLM. This feature upgrades the presentation: tool results are rendered as structured UI components — job cards, match tables, profile previews — instead of text blobs.

It also adds "suggested actions" after relevant tool results. When the agent shows a match, it offers quick-action buttons like "Accept" or "Decline." When it shows search results, it offers "Tell me more about this one." These suggestions don't execute actions yet (that requires a future action-tools feature) — they submit a follow-up chat message on the user's behalf.

This is a UX polish feature, not a capability feature. No new backend work — only frontend rendering improvements on top of existing tool infrastructure.

**Business Value:**

- Makes tool results scannable and visually differentiated from conversation text
- Suggested actions reduce friction — users don't have to type follow-up questions
- Professional UI makes the platform feel production-ready, not prototype-grade
- Increases engagement by guiding users to natural next steps

---

## User Scenarios & Testing

### User Story 1 - Job Search Results as Cards (Priority: P1)

When the agent returns job search results via the `searchJobs` tool, results render as individual job cards with title, company, location, salary range, and a "Tell me more" button.

**Why this priority:** Search results are the most common tool output and benefit most from structured rendering.

**Independent Test:** Can be tested by triggering a search tool result and verifying cards render with correct data and interactive elements.

**Acceptance Scenarios:**

1. **Given** the agent calls `searchJobs` and returns 5 results, **When** the results render in chat, **Then** each result appears as a distinct card with job title, company name, location, and salary range.
2. **Given** a job card, **When** the user clicks "Tell me more," **Then** a follow-up message is sent on the user's behalf: "Tell me more about [job title] at [company]."
3. **Given** a search with 0 results, **When** the response renders, **Then** an empty-state message appears (no empty card grid).

---

### User Story 2 - Match Status as Summary Table (Priority: P1)

When the agent returns match data via `getMyMatches` or `getCandidates`, results render as a compact table with confidence badges, status chips, and row-level interaction.

**Why this priority:** Match data is tabular by nature — rendering it as prose makes it harder to scan.

**Independent Test:** Can be tested by triggering a match-status tool result and verifying a table renders with correct columns and interactive elements.

**Acceptance Scenarios:**

1. **Given** the agent calls `getMyMatches` with 3 matches, **When** results render, **Then** a table appears with columns: Job/Candidate, Confidence, Your Status, Their Status.
2. **Given** a match row, **When** the user clicks the row or an action button, **Then** a follow-up message is sent: "Tell me more about my match with [company/candidate]."
3. **Given** a match with "STRONG" confidence, **When** it renders, **Then** the confidence shows as a colored badge (same style as the match dashboard).

---

### User Story 3 - Profile Preview (Priority: P2)

When the agent returns profile data via `getMyProfile`, it renders as a structured profile card showing key fields with completeness score.

**Why this priority:** Lower priority — users already see their profile on the profile page. But useful for quick reference during chat.

**Independent Test:** Can be tested by triggering a profile tool result and verifying a structured preview renders.

**Acceptance Scenarios:**

1. **Given** the agent calls `getMyProfile`, **When** results render, **Then** a profile card shows name, headline, skills (as tags), location, and completeness percentage.
2. **Given** a profile with 60% completeness, **When** the card renders, **Then** it highlights missing sections with a "Complete your profile" suggestion.

---

### User Story 4 - Suggested Actions After Tool Results (Priority: P1)

After the agent presents tool results, contextual action buttons appear below the response. Clicking a button sends a pre-written follow-up message.

**Why this priority:** Reduces typing friction and guides users to productive next steps.

**Independent Test:** Can be tested by triggering any tool result and verifying suggestion buttons appear and produce correct follow-up messages.

**Acceptance Scenarios:**

1. **Given** a match result showing a pending match, **When** suggestions render, **Then** buttons appear: "Accept this match" and "Tell me why we matched."
2. **Given** a job search result, **When** suggestions render, **Then** a button appears: "Tell me more about [top result]."
3. **Given** the user clicks a suggestion button, **When** the button is clicked, **Then** the button text is sent as a user message in the chat (the agent processes it like any other message).
4. **Given** a suggestion that implies an action ("Accept this match"), **When** the agent receives it, **Then** the agent explains that accepting must be done from the dashboard (no action tools yet).

---

### Edge Cases

- **What happens when tool results contain no data?** Empty-state components render (e.g., "No matches found" card instead of an empty table).
- **What happens on mobile viewports?** Tables become stacked cards on screens <768px. Job cards stack vertically.
- **What happens when the user scrolls past old tool results?** Tool result components persist in chat history like any other message. They are not interactive after the session ends (suggestions become static text on reload).
- **What happens when tool result data is unexpectedly shaped?** Components have fallback rendering — if expected fields are missing, show available data with "—" for missing fields.

---

## Requirements

### Functional Requirements

- **FR-001**: System MUST render `searchJobs` tool results as individual job cards with title, company, location, and salary range.
- **FR-002**: System MUST render `getMyMatches` and `getCandidates` tool results as a summary table with confidence badges and status chips.
- **FR-003**: System MUST render `getMyProfile` tool results as a structured profile card.
- **FR-004**: System MUST display contextual suggestion buttons after tool results.
- **FR-005**: Clicking a suggestion button MUST send the button text as a user chat message.
- **FR-006**: Suggestion buttons MUST NOT execute actions directly — they only generate follow-up chat messages.
- **FR-007**: Tool result components MUST be responsive — tables become stacked cards on mobile viewports (<768px).
- **FR-008**: Tool result components MUST handle missing/null fields gracefully (display "—" or hide the field).
- **FR-009**: Tool result components MUST be visually distinct from plain text chat messages.
- **FR-010**: On chat history reload, tool results MUST render as static text (suggestions not re-interactive).

### Key Entities

- **ToolResultCard**: A structured UI component that renders tool output. Different card types for search results, matches, and profiles.
- **SuggestionAction**: A button displayed after tool results. Contains label text and the message to send when clicked.

---

## Success Criteria

### Measurable Outcomes

- **SC-001**: Tool results render as structured components in under 100ms after the LLM response completes.
- **SC-002**: Suggestion buttons are clicked in 30%+ of tool-result interactions (measured via PostHog, once Feature 23 is live).
- **SC-003**: Responsive layout works on viewports from 375px to 1920px.
- **SC-004**: 80%+ test coverage on tool result components (constitutional requirement).
