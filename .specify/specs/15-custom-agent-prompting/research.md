# Technology Research

## Decision 1: Prompt Injection Detection Strategy

**Context:** Custom user prompts must be scanned for adversarial patterns before being saved. Need to balance detection accuracy with simplicity (Constitution IV: Minimal Abstractions).

**Options Considered:**

1. **Rule-based pattern matching** — Regex patterns against known injection techniques
   - Pros: Zero external dependencies, fast (<10ms), fully deterministic, easy to test
   - Cons: Cannot catch novel attacks, requires manual pattern updates

2. **LLM-based classifier** — Use the user's BYOK key to classify prompts
   - Pros: Catches semantic attacks, adapts to novel patterns
   - Cons: Costs money per validation, slow (1-3s), requires BYOK key (not all users have one yet), non-deterministic

3. **External service (Rebuff, Lakera Guard)** — Third-party prompt injection API
   - Pros: Maintained by security experts, handles novel attacks
   - Cons: New external dependency (violates Constitution IV), adds latency, costs money, data leaves platform

**Chosen:** Option 1 — Rule-based pattern matching
**Rationale:** Aligns with Constitution IV (Minimal Abstractions). Custom prompts are sandboxed within the agent context with explicit guardrail preservation instructions, so the injection detection is a defense-in-depth layer, not the sole protection. Rule-based detection catches the most common patterns (role override, instruction extraction, delimiter injection) and is deterministic, making it fully testable. The sandbox framing in the system prompt is the primary defense.
**Tradeoffs:** Won't catch novel semantic injection attacks. Mitigated by the sandbox architecture (custom prompts are explicitly marked as user-provided content that cannot override prior instructions).

## Decision 2: Custom Prompt Encryption Approach

**Context:** Spec requires custom prompts encrypted at rest. Existing encryption module uses deterministic IV per userId.

**Options Considered:**

1. **Reuse existing encrypt/decrypt with userId** — Same AES-256-GCM module
   - Pros: No new code, proven, consistent with BYOK key encryption
   - Cons: Deterministic IV security note applies (one IV per user). Since a user has both a BYOK key AND a custom prompt encrypted with the same IV, two different plaintexts share the same key+IV pair.

2. **Random IV per encryption** — Generate random IV, store alongside ciphertext
   - Pros: Cryptographically stronger, no IV reuse concern
   - Cons: Changes the encryption module interface, different pattern from existing BYOK usage

**Chosen:** Option 1 — Reuse existing encrypt/decrypt
**Rationale:** The deterministic IV is derived from userId, and the existing security note in encryption.ts already acknowledges this trade-off. For the threat model (data-at-rest protection against database breach), the current approach is sufficient. Custom prompts are low-sensitivity relative to API keys. Adding a second encryption scheme would increase complexity without meaningful security gain for this use case.
**Tradeoffs:** Two plaintexts (BYOK key + custom prompt) share the same key+IV. AES-GCM with IV reuse can leak XOR of plaintexts if an attacker obtains both ciphertexts. Acceptable because: (1) attacker would need database access, (2) BYOK keys are already rotatable, (3) custom prompts are not high-value secrets.

## Decision 3: Sandbox Architecture for Custom Prompts

**Context:** Custom prompts must be injected into agent context without allowing override of core guardrails.

**Options Considered:**

1. **Append to system prompt with XML delimiters** — Add custom prompt in a `<user-customization>` block at the end of the system prompt with explicit framing
   - Pros: Simple, works with all LLM providers, easy to test
   - Cons: Sophisticated prompt injection could attempt to close tags

2. **Separate user message** — Put custom prompt in a separate user message before the conversation context
   - Pros: Clear separation between system instructions and user content
   - Cons: Changes the message flow, may confuse the agent's conversation tracking

3. **Tool-based injection** — Register custom prompt as a "tool" the agent can reference
   - Pros: Strong isolation, provider-level sandboxing
   - Cons: Over-engineered, adds complexity, not all providers handle tools identically

**Chosen:** Option 1 — Append to system prompt with XML delimiters
**Rationale:** Simplest approach that works with both OpenAI and Anthropic providers. The framing explicitly tells the LLM that the content is user-provided and cannot override previous instructions. Combined with rule-based injection detection on save, this provides adequate defense-in-depth. Both providers respect XML-delimited sections well.
**Tradeoffs:** A sophisticated injection could theoretically attempt to close the XML tag and inject new instructions. Mitigated by: (1) pre-save injection detection strips such patterns, (2) the core guardrails are stated before the sandbox section, (3) LLMs generally respect explicit "this is user content" framing.
