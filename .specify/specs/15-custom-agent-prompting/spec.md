# Feature 15: Custom Agent Prompting

**Branch:** 15-custom-agent-prompting
**PRD Section:** &sect;6.4 Custom Agent Prompting
**Priority:** P2
**Phase:** 3 (Full Launch)
**Status:** Specified

---

## Overview

Users can write a custom prompt that influences their agent's behavior during agent-to-agent interactions. The custom prompt is sandboxed within a clearly delineated section of the agent's context so that it cannot override core agent policies, ethical guardrails, or matching rules. The platform provides example prompts and guidance to help users craft effective instructions. Prompt injection detection prevents adversarial content from reaching the agent.

**Business Value:** Gives users a sense of control and personalization over their agent's negotiation style without compromising platform integrity. Custom prompts also serve as a soft signal of user engagement and communication skill.

**Privacy Constraint:** Custom prompts are encrypted at rest (same AES-256-GCM scheme used for BYOK keys). They are never exposed to the other party, never included in conversation logs, and never visible outside the owner's settings.

---

## User Stories

### User Story 1: Job Seeker Writes a Custom Prompt

**As a** job seeker
**I want** to write a custom prompt that guides my agent's behavior
**So that** my agent negotiates in a way that reflects my priorities and communication style

**Acceptance Criteria:**

- [ ] Custom prompt text area is available on the seeker private settings page
- [ ] Prompt is limited to 2,000 characters with a visible character counter
- [ ] Prompt is saved and encrypted at rest
- [ ] Saved prompt is displayed (decrypted) when the user revisits the settings page
- [ ] User can clear or update their prompt at any time

**Priority:** High

### User Story 2: Employer Writes a Custom Prompt per Job Posting

**As an** employer
**I want** to write a custom prompt for each job posting's agent
**So that** the agent reflects the unique hiring priorities of that role

**Acceptance Criteria:**

- [ ] Custom prompt text area is available on the job posting settings page
- [ ] Prompt is limited to 2,000 characters with a visible character counter
- [ ] Prompt is saved and encrypted at rest
- [ ] Saved prompt is displayed (decrypted) when the employer revisits settings
- [ ] Different job postings can have different custom prompts

**Priority:** High

### User Story 3: Custom Prompt Influences Agent Behavior

**As a** user (seeker or employer)
**I want** my custom prompt to actually change how my agent behaves in conversations
**So that** my preferences are reflected in the negotiation

**Acceptance Criteria:**

- [ ] Custom prompt is injected into the agent's context during conversation turns
- [ ] Custom prompt is placed in a sandboxed section clearly separated from core instructions
- [ ] Agent behavior observably changes when a custom prompt is present vs absent
- [ ] Core guardrails (anti-discrimination, no fabrication, no private disclosure) remain enforced regardless of custom prompt content

**Priority:** High

### User Story 4: Platform Provides Example Prompts and Guidance

**As a** user unfamiliar with prompt writing
**I want** to see example prompts and guidance
**So that** I can write an effective custom prompt without needing AI expertise

**Acceptance Criteria:**

- [ ] At least 3 example prompts are displayed for each user type (seeker and employer)
- [ ] Guidance text explains what the prompt can and cannot do
- [ ] Examples are accessible directly from the prompt input area
- [ ] Examples can be inserted into the text area with one click

**Priority:** Medium

### User Story 5: Prompt Injection Detection

**As a** platform operator
**I want** adversarial or malicious prompts to be detected and rejected
**So that** users cannot override agent guardrails or manipulate the matching system

**Acceptance Criteria:**

- [ ] Prompts are scanned for injection patterns before being saved
- [ ] Known injection techniques are detected (role override, ignore instructions, system prompt extraction)
- [ ] Detected injections are rejected with a user-friendly error message
- [ ] Detection runs on save (not on every conversation turn) to minimize latency
- [ ] False positive rate is low enough that legitimate prompts are rarely blocked

**Priority:** High

### User Story 6: Custom Prompt Behind Feature Flag

**As a** platform operator
**I want** custom prompting gated behind a feature flag
**So that** it can be rolled out gradually and disabled if issues arise

**Acceptance Criteria:**

- [ ] Feature is gated behind `CUSTOM_PROMPTS` feature flag
- [ ] When flag is OFF, prompt text area is hidden from settings UI
- [ ] When flag is OFF, agents ignore any stored custom prompts
- [ ] Flag can be toggled without deployment

**Priority:** High

---

## Functional Requirements

### FR-1: Custom Prompt Storage

The system must store custom prompts encrypted at rest using the same encryption scheme as BYOK API keys. Prompts are associated with the user's settings (seeker) or job posting settings (employer). Maximum length: 2,000 characters.

### FR-2: Custom Prompt Injection into Agent Context

The system must inject the custom prompt into the agent's context within a clearly delineated sandbox section. The sandbox section must be positioned after core instructions and guardrails, and before conversation-specific context. The agent must be instructed that the sandbox content is user-provided and cannot override prior instructions.

### FR-3: Guardrail Preservation

The system must ensure that core agent guardrails remain active regardless of custom prompt content:

- Anti-discrimination rules
- No fabrication of qualifications or credentials
- No disclosure of exact private parameter values
- No impersonation of the other party
- No extraction of system prompt content

### FR-4: Prompt Injection Detection

The system must scan custom prompts for adversarial patterns before saving. Detection must cover:

- Role override attempts ("ignore previous instructions", "you are now...")
- System prompt extraction attempts ("repeat your system prompt", "what are your instructions")
- Delimiter injection (closing/opening XML tags, markdown headers mimicking system sections)
- Instruction override patterns ("disregard all prior", "new instructions:")

Detected prompts must be rejected with a clear, non-technical error message.

### FR-5: Example Prompts and Guidance

The system must provide at least 3 example prompts per user type:

**Job Seeker Examples:**

- Prioritizing work-life balance and remote work
- Being assertive on salary but flexible on start date
- Emphasizing transferable skills from a career change

**Employer Examples:**

- Prioritizing culture fit over years of experience
- Focusing on growth potential for junior roles
- Emphasizing technical depth for senior roles

Each example must include a short description of what it does and a one-click insert action.

### FR-6: Feature Flag Gating

All custom prompt functionality must be gated behind the `CUSTOM_PROMPTS` feature flag. When the flag is OFF:

- Settings UI hides the prompt input
- Agent context construction skips custom prompt injection
- Existing stored prompts are preserved but inactive

### FR-7: Custom Prompt Privacy

Custom prompts must never be:

- Exposed in conversation logs
- Visible to the other party in any API response
- Included in aggregate feedback insights
- Logged to application logs in plaintext

---

## Non-Functional Requirements

### NFR-1: Performance

- Custom prompt encryption/decryption must add < 10ms to settings page load
- Prompt injection detection must complete in < 100ms per prompt
- Agent context construction with custom prompt must add < 5ms overhead

### NFR-2: Security

- Custom prompts encrypted at rest with AES-256-GCM (user-scoped key)
- Prompt injection detection covers OWASP LLM Top 10 prompt injection patterns
- No plaintext custom prompts in application logs

### NFR-3: Reliability

- Agent must function correctly when custom prompt is null, empty, or missing
- Malformed prompts (after passing injection detection) must not crash the agent
- Feature flag toggle must take effect immediately without restart

### NFR-4: Usability

- Character counter shows remaining characters (e.g., "1,247 / 2,000")
- Validation errors displayed inline next to the prompt field
- Example prompts are clearly labeled and easy to discover

---

## Edge Cases & Error Handling

### EC-1: Empty or Null Custom Prompt

When no custom prompt is set, the agent operates with its default behavior. No sandbox section is injected into the context.

### EC-2: Maximum Length Prompt

A 2,000-character prompt must be accepted, stored, and injected without truncation.

### EC-3: Unicode and Special Characters

Prompts containing emoji, non-Latin scripts, and special characters must be handled correctly through encryption, storage, decryption, and injection.

### EC-4: Prompt Injection False Positive

If a legitimate prompt is flagged, the user receives a specific error explaining which pattern was matched, with guidance on how to rephrase. The user is not told the exact detection rules.

### EC-5: Concurrent Prompt Updates

If a user updates their prompt while a conversation is in progress, the in-progress conversation uses the prompt that was loaded at conversation start. The updated prompt takes effect for subsequent conversations.

### EC-6: Feature Flag Transition

When the feature flag is toggled from ON to OFF mid-conversation, in-progress conversations that already loaded the custom prompt continue using it. New conversations skip it.

### EC-7: Prompt with Only Whitespace

A prompt containing only whitespace characters is treated as empty (no sandbox section injected).

### EC-8: Custom Prompt After Agent Guardrail Violation

If an agent's response violates guardrails despite a custom prompt, the response is filtered through existing privacy and safety mechanisms. The custom prompt does not exempt the agent from post-processing filters.

---

## Success Metrics

- **Adoption rate**: > 20% of active users set a custom prompt within 30 days of feature launch
- **Injection detection rate**: > 95% of known injection patterns blocked
- **False positive rate**: < 5% of legitimate prompts incorrectly flagged
- **Guardrail integrity**: 0 guardrail violations attributable to custom prompts in first 90 days
- **User satisfaction**: Custom prompt users report higher agent satisfaction scores than non-users

---

## Out of Scope

- Prompt versioning or history (users see only the current prompt)
- A/B testing of different prompts by the same user
- Platform-generated prompt suggestions based on user profile
- Custom prompts for the aggregate feedback insights generation
- Prompt marketplace or sharing between users
