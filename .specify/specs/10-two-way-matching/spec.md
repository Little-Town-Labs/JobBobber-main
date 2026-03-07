# Feature Specification: Two-Way Matching

**Feature:** 10-two-way-matching
**Branch:** 10-two-way-matching
**PRD Sections:** 7.2 (Match Decision), Constitution VII (Agent Autonomy)
**Priority:** P0
**Status:** Draft
**Created:** 2026-03-07
**Dependencies:** Feature 9 (Agent-to-Agent Conversations), Feature 8 (Private Negotiation Parameters)

---

## Overview

Two-Way Matching upgrades the agent-to-agent conversation system from a collaborative dialogue into a bidirectional consensus protocol. In Feature 9, agents converse and can signal match decisions, but the evaluation logic is informal — both agents participate in dialogue without a structured independent evaluation step.

This feature adds the Job Seeker Agent's active, independent evaluation of job opportunities against the seeker's private preferences. A match is generated only when both agents independently conclude there is sufficient alignment after their conversation. This prevents one-sided matches where the employer finds a candidate suitable but the opportunity doesn't meet the seeker's needs.

The key distinction from Feature 9: Feature 9 built the conversation infrastructure and basic match signaling. Feature 10 adds structured independent evaluation criteria, confidence scoring, and bidirectional consensus enforcement.

**Business Value:**

- Ensures matches reflect genuine mutual fit, not just employer interest
- Protects job seekers from being matched with opportunities that don't meet their criteria
- Improves match acceptance rates by surfacing only high-quality mutual matches
- Generates richer match summaries that explain alignment from both perspectives
- Enables confidence scoring (Strong/Good/Potential) based on evaluation depth

---

## User Scenarios & Testing

### User Story 1 - Job Seeker Agent Evaluates Opportunities (Priority: P1)

The Job Seeker Agent actively evaluates each job opportunity against the seeker's private preferences during the conversation. Rather than passively responding to employer questions, the seeker agent probes for information relevant to the seeker's priorities — compensation alignment, work arrangement fit, growth opportunities, deal-breaker checks — and forms an independent assessment.

**Why this priority**: Without active seeker-side evaluation, the system degenerates into employer-only matching (Feature 5), which was the MVP baseline. This is the core differentiator.

**Independent Test**: Can be tested by running a conversation where the job posting clearly violates the seeker's private deal-breakers and verifying the seeker agent signals NO_MATCH regardless of employer enthusiasm.

**Acceptance Scenarios:**

1. **Given** a seeker with private settings (min salary $120k, remote-only deal-breaker), **When** the seeker agent converses with an employer agent for an on-site-only role, **Then** the seeker agent signals NO_MATCH with reason citing work arrangement misalignment.
2. **Given** a seeker with private priorities (growth > compensation > culture), **When** the seeker agent evaluates an opportunity, **Then** the agent weights its evaluation according to the seeker's priority ranking.
3. **Given** a seeker with no deal-breakers triggered, **When** the conversation reaches the match decision phase, **Then** the seeker agent produces a structured evaluation scoring each preference dimension.

---

### User Story 2 - Bidirectional Consensus Required for Match (Priority: P1)

A Match record is created only when both the Employer Agent and Job Seeker Agent independently signal MATCH after the conversation. If either agent signals NO_MATCH, the conversation ends silently with no notification to either party. This is the core consensus protocol.

**Why this priority**: Without consensus enforcement, matches would be one-sided and lead to high decline rates. This is equally critical as Story 1.

**Independent Test**: Can be tested by running conversations where one agent signals MATCH and the other NO_MATCH, verifying no Match record is created.

**Acceptance Scenarios:**

1. **Given** a completed conversation, **When** both agents signal MATCH, **Then** a Match record is created with status PENDING and linked to the conversation.
2. **Given** a completed conversation, **When** the employer agent signals MATCH but the seeker agent signals NO_MATCH, **Then** no Match record is created and the conversation status is COMPLETED_NO_MATCH.
3. **Given** a completed conversation, **When** the seeker agent signals MATCH but the employer agent signals NO_MATCH, **Then** no Match record is created and neither party is notified.

---

### User Story 3 - Confidence Scoring (Priority: P2)

Each match is assigned a confidence level (Strong, Good, or Potential) derived from the depth of alignment discovered during the conversation. The confidence score reflects how many preference dimensions aligned, how strongly they aligned, and whether any areas of concern remain.

**Why this priority**: Confidence scoring adds value to the match dashboard but isn't required for the core matching loop to function.

**Independent Test**: Can be tested by running conversations with varying degrees of alignment and verifying the confidence score reflects the alignment depth.

**Acceptance Scenarios:**

1. **Given** a mutual match where all preference dimensions align strongly, **When** the match is created, **Then** the confidence level is STRONG.
2. **Given** a mutual match where most dimensions align but compensation is borderline, **When** the match is created, **Then** the confidence level is GOOD.
3. **Given** a mutual match where alignment is marginal on multiple dimensions, **When** the match is created, **Then** the confidence level is POTENTIAL.

---

### User Story 4 - Both-Sided Match Summary (Priority: P2)

When a match is generated, the system produces an AI-generated summary that explains the alignment from both the employer's and seeker's perspectives. The summary highlights mutual strengths without disclosing private parameter values.

**Why this priority**: Summaries improve the user experience on the match dashboard but the match itself functions without them.

**Independent Test**: Can be tested by generating a match and verifying the summary contains both employer-perspective and seeker-perspective sections with no private value disclosure.

**Acceptance Scenarios:**

1. **Given** a mutual match, **When** the match summary is generated, **Then** it contains an employer-perspective section explaining why the candidate fits.
2. **Given** a mutual match, **When** the match summary is generated, **Then** it contains a seeker-perspective section explaining why the opportunity fits.
3. **Given** a mutual match, **When** the match summary is generated, **Then** no exact salary figures, deal-breaker text, or other private parameter values appear in the summary.

---

### User Story 5 - Silent No-Match for Unilateral Rejection (Priority: P1)

When either agent determines there is insufficient alignment, the conversation ends silently. Neither party receives any notification. The conversation record is retained for analytics but never surfaced in the user's dashboard.

**Why this priority**: Silent no-match is essential for user experience — users should only see genuine opportunities, not a stream of rejections.

**Independent Test**: Can be tested by completing a no-match conversation and verifying no notifications are sent and the conversation doesn't appear in either user's dashboard.

**Acceptance Scenarios:**

1. **Given** the seeker agent signals NO_MATCH, **When** the conversation completes, **Then** neither the employer nor seeker receives any notification.
2. **Given** a COMPLETED_NO_MATCH conversation, **When** the seeker views their dashboard, **Then** the conversation and its associated posting do not appear.
3. **Given** a COMPLETED_NO_MATCH conversation, **When** the employer views their candidates for that posting, **Then** the seeker does not appear in the candidate list.

---

### Edge Cases

- **Both agents signal NO_MATCH simultaneously**: Conversation ends as COMPLETED_NO_MATCH on the first NO_MATCH signal encountered during sequential evaluation.
- **Agent signals CONTINUE indefinitely**: Maximum turn limit (from Feature 9) prevents infinite continuation. If max turns reached without MATCH consensus, result is COMPLETED_NO_MATCH.
- **Seeker's private settings are empty**: Seeker agent evaluates based on public profile preferences only, with reduced confidence weighting.
- **Employer and seeker have contradictory hard constraints**: Seeker agent detects deal-breaker violation early and signals NO_MATCH, minimizing wasted LLM calls.
- **Match created but seeker profile updated before acceptance**: Match validity is based on conversation-time data. Profile updates after match creation do not retroactively invalidate matches.
- **Multiple conversations for same seeker across different postings**: Each conversation is independent. A seeker can match with multiple postings from the same employer.

---

## Requirements

### Functional Requirements

- **FR-001**: System MUST require both the Employer Agent and Job Seeker Agent to independently signal MATCH before creating a Match record.
- **FR-002**: Job Seeker Agent MUST evaluate opportunities against the seeker's private preferences (minimum salary, deal-breakers, priority ranking, exclusions).
- **FR-003**: Job Seeker Agent MUST proactively gather information relevant to the seeker's preferences during the conversation, not just respond to employer questions.
- **FR-004**: System MUST assign a confidence level (STRONG, GOOD, or POTENTIAL) to each match based on alignment depth across preference dimensions.
- **FR-005**: System MUST generate a both-sided match summary when a match is created, with perspectives from both the employer and seeker agents.
- **FR-006**: Match summaries MUST NOT contain exact private parameter values (salary figures, specific deal-breaker text, exclusion list entries).
- **FR-007**: When either agent signals NO_MATCH, the system MUST end the conversation silently with no notification to either party.
- **FR-008**: COMPLETED_NO_MATCH conversations MUST NOT appear in either party's dashboard or candidate lists.
- **FR-009**: Each agent's match decision MUST include a structured evaluation with dimension-level scores, not just a binary signal.
- **FR-010**: System MUST support the existing match decision protocol from Feature 9 (MATCH/NO_MATCH/CONTINUE signals) with the addition of structured evaluation data.
- **FR-011**: Confidence scoring MUST be deterministic given the same evaluation inputs (not dependent on LLM randomness beyond the evaluation itself).

### Key Entities

- **Match**: Extended with `employerSummary`, `seekerSummary`, and `evaluationData` (structured scores per dimension). Existing `confidenceScore` field (MatchConfidence enum: STRONG/GOOD/POTENTIAL) reused with improved derivation logic.
- **AgentEvaluation**: Each agent's structured assessment — dimension scores, overall recommendation, reasoning. Stored as part of the conversation's final state.
- **MatchConfidence**: Existing enum (STRONG/GOOD/POTENTIAL) — derivation upgraded from message-count heuristic to dimension-score mean.

---

## Success Criteria

### Measurable Outcomes

- **SC-001**: 100% of matches are produced only when both agents signal MATCH (zero one-sided matches).
- **SC-002**: Match mutual acceptance rate improves by >15% compared to Feature 5 baseline (one-directional matching).
- **SC-003**: >80% of no-match conversations terminate within 4 turns (early detection of deal-breaker misalignment).
- **SC-004**: 0 instances of private parameter values appearing in match summaries (automated audit).
- **SC-005**: Confidence level distribution across matches: ~20% STRONG, ~50% GOOD, ~30% POTENTIAL (healthy distribution indicating calibrated scoring).
- **SC-006**: No-match conversations produce zero user-facing notifications (verified via notification audit).

---

## Out of Scope

- **Vector search for candidate discovery** — Feature 11
- **Conversation log viewing by users** — Feature 12
- **Custom agent prompting** — Feature 15
- **Aggregate feedback insights from conversations** — Feature 14
- **Changes to conversation infrastructure** — Feature 9 (this feature extends, not replaces, the conversation system)

---

## Glossary

| Term                    | Definition                                                                                                   |
| ----------------------- | ------------------------------------------------------------------------------------------------------------ |
| Bidirectional Consensus | Requirement that both agents independently signal MATCH for a match to be created                            |
| Confidence Level        | Quality tier assigned to a match: STRONG, GOOD, or POTENTIAL                                                 |
| Dimension Score         | Numerical assessment of alignment on a single preference dimension (e.g., compensation, work arrangement)    |
| Agent Evaluation        | Structured assessment produced by an agent at match decision time, containing dimension scores and reasoning |
| Silent No-Match         | A conversation outcome where neither party is notified because the agents determined insufficient alignment  |
| Preference Dimension    | A category of alignment evaluated by agents (compensation, skills, culture, work arrangement, growth)        |
