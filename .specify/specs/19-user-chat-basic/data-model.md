# Data Model — 19-user-chat-basic

## New Entities

### ChatMessage

Stores individual chat messages between a user and their personal AI agent.
One row per message. Associated with a user via `clerkUserId`.

| Field       | Type            | Constraints             | Description                              |
| ----------- | --------------- | ----------------------- | ---------------------------------------- |
| id          | String (CUID)   | Primary Key             | Unique identifier                        |
| clerkUserId | String          | Not Null, Indexed       | Clerk user ID (seeker or employer)       |
| role        | ChatMessageRole | Not Null                | Who sent the message (USER or ASSISTANT) |
| content     | String (Text)   | Not Null                | Message text content                     |
| createdAt   | DateTime        | Not Null, Default now() | When the message was created             |

### Enums

#### ChatMessageRole

| Value     | Description                     |
| --------- | ------------------------------- |
| USER      | Message sent by the human user  |
| ASSISTANT | Response from the AI chat agent |

## Relationships

- ChatMessage belongs to a user (via `clerkUserId`, not a foreign key — follows existing Clerk pattern where Clerk IDs are external string identifiers)
- No relationship to AgentConversation (chat is separate from agent-to-agent conversations)
- No relationship to JobSeeker or Employer (chat serves both roles via clerkUserId)

## Indexes

| Index                 | Columns                       | Purpose                                                 |
| --------------------- | ----------------------------- | ------------------------------------------------------- |
| Primary               | id                            | Row lookup                                              |
| clerkUserId_createdAt | (clerkUserId, createdAt DESC) | Load recent messages for a user (primary query pattern) |
| clerkUserId           | clerkUserId                   | GDPR deletion cascade lookup                            |

## Prisma Schema Addition

```prisma
enum ChatMessageRole {
  USER
  ASSISTANT
}

/// User-to-agent chat messages.
/// Separate from AgentConversation (agent-to-agent).
/// clerkUserId links to Clerk — not a FK (follows existing pattern).
model ChatMessage {
  id          String          @id @default(cuid())
  clerkUserId String
  role        ChatMessageRole
  content     String
  createdAt   DateTime        @default(now())

  @@index([clerkUserId, createdAt(sort: Desc)])
  @@index([clerkUserId])
  @@map("chat_messages")
}
```

## GDPR Compliance

Chat messages MUST be included in the account deletion cascade (Feature 18).
The existing `execute-account-deletion` Inngest function must be updated to delete
all ChatMessage rows matching the user's `clerkUserId`.

## Context Assembly (Read-Only, Not Stored)

The agent context is assembled per-request from existing tables. No new storage required.

| Data Source               | Table             | Fields Used                                                                  | Purpose                                     |
| ------------------------- | ----------------- | ---------------------------------------------------------------------------- | ------------------------------------------- |
| Profile (seeker)          | JobSeeker         | name, headline, skills, experience, education, location, profileCompleteness | Answer profile questions                    |
| Profile (employer)        | Employer          | name, industry, description                                                  | Answer company questions                    |
| Private settings (seeker) | SeekerSettings    | minSalary, salaryRules, dealBreakers, priorities, exclusions                 | Answer preference questions (own data only) |
| Matches                   | Match             | confidenceScore, matchSummary, seekerStatus, employerStatus, evaluationData  | Answer match questions                      |
| Job postings (employer)   | JobPosting        | title, status, requiredSkills                                                | Answer posting questions                    |
| Conversation logs         | AgentConversation | messages (redacted), outcome, status                                         | Explain agent activity                      |

## Migration Notes

- Single new table `chat_messages`, no changes to existing tables
- Add `ChatMessage` deletion to `execute-account-deletion.ts`
- No data migration required (new table starts empty)
