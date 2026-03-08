# Data Model — Custom Agent Prompting

## Existing Entities (No Schema Changes Required)

The `customPrompt` field already exists in both settings models. This feature activates and integrates it — no Prisma migration needed.

### SeekerSettings (existing)

| Field        | Type    | Constraints    | Description                                                           |
| ------------ | ------- | -------------- | --------------------------------------------------------------------- |
| customPrompt | String? | Max 2000 chars | User's custom agent prompt (stored plaintext currently, will encrypt) |

### JobSettings (existing)

| Field        | Type    | Constraints    | Description                                                                           |
| ------------ | ------- | -------------- | ------------------------------------------------------------------------------------- |
| customPrompt | String? | Max 2000 chars | Employer's custom agent prompt per posting (stored plaintext currently, will encrypt) |

## Data Flow

```
User Input (plaintext, max 2000 chars)
  → Injection Detection (rule-based scan)
  → Encryption (AES-256-GCM, user-scoped)
  → Storage (SeekerSettings.customPrompt or JobSettings.customPrompt)
  → Retrieval: Decrypt → Display in settings UI
  → Agent Use: Decrypt → Inject into system prompt sandbox section
```

## Privacy Boundaries

- Custom prompts are NEVER included in:
  - Conversation logs (AgentConversation.messages)
  - Match records (Match table)
  - Aggregate feedback insights (FeedbackInsights)
  - Any tRPC response accessible to the other party
  - Application logs

- Custom prompts are ONLY accessible to:
  - The owning user (via settings API)
  - The agent context builder (server-side only, decrypted in memory)

## Encryption Notes

- Uses existing `encrypt(plaintext, userId)` / `decrypt(ciphertext, userId)` from `src/lib/encryption.ts`
- For seeker: userId = seekerId
- For employer: userId = jobPostingId (scoped to posting, consistent with BYOK key encryption in JobSettings)
- Null/empty prompts are stored as null (not encrypted)
