# Feature Specification: Streaming Structured Outputs

**Feature:** 22-streaming-structured-outputs
**Branch:** 22-streaming-structured-outputs
**PRD Sections:** §7.1 Agent Output
**Roadmap:** Phase 4 — Growth
**Priority:** P2
**Status:** Draft
**Created:** 2026-03-17
**Dependencies:** Feature 19 (User Chat Basic) — complete. Independent of Feature 20/21.

---

## Overview

Currently, when the chat agent generates structured data (match evaluations, profile summaries, comparison tables), the user waits for the full response before seeing anything. For complex analyses that take 3-10 seconds, this creates a dead UI.

This feature adds progressive rendering: structured outputs stream field-by-field as the LLM generates them. A match evaluation shows the confidence score first, then strength areas filling in one by one, then gap areas. A profile analysis shows completeness first, then skill-by-skill assessment. The user sees meaningful partial results within the first second.

This is a frontend rendering enhancement. The LLM and backend are unchanged — the improvement is in how structured responses are parsed and displayed during streaming.

**Business Value:**

- Eliminates the "dead screen" problem for complex agent responses
- Users see useful information sooner (first token within 1 second)
- Creates a polished, professional feel matching modern AI chat products
- Reduces perceived latency even when actual latency is unchanged

---

## User Scenarios & Testing

### User Story 1 - Progressive Match Analysis (Priority: P1)

When the user asks the agent to analyze a match, the structured evaluation renders progressively — confidence score appears first, then strengths, then gaps, each filling in as the LLM generates them.

**Why this priority:** Match analysis is the most common structured response and takes the longest to generate (5-10 seconds for multi-dimensional evaluation).

**Independent Test:** Can be tested by asking "analyze my match with Acme Corp" and verifying partial content appears within 1 second, with fields filling in progressively.

**Acceptance Scenarios:**

1. **Given** the user asks for a match analysis, **When** the agent begins streaming, **Then** partial fields appear progressively (e.g., confidence score shows before the full reasoning is complete).
2. **Given** a streaming response with 6 evaluation dimensions, **When** dimensions stream in, **Then** each dimension appears as it's generated (not all at once at the end).
3. **Given** the stream completes, **When** all fields are present, **Then** the final rendered output is identical to what a non-streaming render would produce.

---

### User Story 2 - Progressive Profile Summary (Priority: P2)

When the agent generates a profile improvement summary, sections stream in progressively — overall score first, then missing sections, then recommendations.

**Why this priority:** Profile analysis is a common request but simpler than match evaluation.

**Independent Test:** Can be tested by asking "how can I improve my profile?" and verifying sections appear progressively.

**Acceptance Scenarios:**

1. **Given** the user asks for profile improvement advice, **When** the agent streams a structured response, **Then** the completeness score appears first, followed by individual improvement suggestions.
2. **Given** a partial stream (2 of 5 suggestions generated), **When** the user views the response, **Then** the 2 completed suggestions are readable while a loading indicator shows more are coming.

---

### User Story 3 - Streaming Fallback (Priority: P1)

When streaming fails mid-response (network error, provider timeout), the partial content is preserved and an error message appears — the user doesn't lose what was already rendered.

**Why this priority:** Resilience is critical — a failed stream should degrade gracefully, not blank the screen.

**Independent Test:** Can be tested by simulating a network interruption mid-stream and verifying partial content persists with an error indicator.

**Acceptance Scenarios:**

1. **Given** a streaming response fails after 3 of 6 fields are rendered, **When** the error occurs, **Then** the 3 completed fields remain visible and an error message appears below them.
2. **Given** a complete streaming failure (0 fields rendered), **When** the error occurs, **Then** a standard error message appears (same as current behavior).
3. **Given** the user retries after a failed stream, **When** they send a follow-up message, **Then** a fresh streaming response begins from scratch.

---

### Edge Cases

- **What happens when the LLM produces malformed partial JSON?** The parser skips malformed chunks and waits for the next valid chunk. Partial renders show "..." for fields that haven't parsed yet.
- **What happens when the structured output is very small (1-2 fields)?** Small responses stream so fast that progressive rendering is imperceptible. This is fine — the final result renders instantly with no visual glitch.
- **What happens when the user scrolls away during streaming?** Streaming continues. When the user scrolls back, they see the current state of the progressive render.
- **What happens when text-only responses stream?** Regular text responses continue to stream as they do today (token by token). Structured rendering only activates when the response contains a recognized structured format.

---

## Requirements

### Functional Requirements

- **FR-001**: System MUST render structured agent responses progressively as fields stream in from the LLM.
- **FR-002**: System MUST display partial content within 1 second of stream start for responses that take >2 seconds total.
- **FR-003**: System MUST show a loading indicator for fields that have not yet been generated.
- **FR-004**: The final rendered output MUST be identical whether streamed progressively or rendered all at once.
- **FR-005**: System MUST preserve partial content when streaming fails mid-response, showing an error indicator for incomplete sections.
- **FR-006**: System MUST NOT alter the LLM prompt, model, or backend logic — this is a frontend rendering enhancement only.
- **FR-007**: Regular text-only responses MUST continue to stream token-by-token as before (no regression).
- **FR-008**: Progressive rendering MUST only apply to text parts (`TextUIPart`). Tool result parts (`ToolUIPart`) MUST be rendered by the tool result renderer (Feature 21), not the streaming parser.
- **FR-009**: Progressive rendering MUST work for structured text formats (match evaluations, profile summaries) within text parts.
- **FR-010**: Streaming structured outputs MUST be gated behind the existing `USER_CHAT` feature flag (no separate flag needed).

### Key Entities

- **StreamingField**: A single field within a structured response being progressively rendered. Has states: pending, streaming, complete.
- **StructuredStreamParser**: Client-side parser that identifies structured response chunks and maps them to renderable fields.

---

## Success Criteria

### Measurable Outcomes

- **SC-001**: First meaningful field renders within 1 second of stream start (p90) for structured responses.
- **SC-002**: No visual regression on regular text streaming (baseline comparison).
- **SC-003**: Failed streams preserve 100% of already-rendered partial content.
- **SC-004**: Final render output is pixel-identical to non-streaming render for same content.
- **SC-005**: 80%+ test coverage on streaming parser and progressive render components (constitutional requirement).
