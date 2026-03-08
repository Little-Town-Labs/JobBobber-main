# Data Model

## Existing Entities (No Changes)

### AgentConversation

Already exists with all needed fields:

| Field        | Type               | Constraints     | Description                                                  |
| ------------ | ------------------ | --------------- | ------------------------------------------------------------ |
| id           | String             | PK, cuid        | Unique identifier                                            |
| jobPostingId | String             | FK → JobPosting | Associated job posting                                       |
| seekerId     | String             | FK → JobSeeker  | Associated seeker                                            |
| status       | ConversationStatus | Not Null        | IN_PROGRESS, COMPLETED_MATCH, COMPLETED_NO_MATCH, TERMINATED |
| messages     | Json[]             | Default []      | Array of ConversationMessage objects                         |
| startedAt    | DateTime           | Not Null        | Conversation start time                                      |
| completedAt  | DateTime?          | Nullable        | Conversation completion time                                 |
| outcome      | String?            | Nullable        | Summary of outcome                                           |
| inngestRunId | String?            | Nullable        | Inngest workflow reference                                   |

**Existing Indexes:** seekerId, jobPostingId, status, (seekerId, jobPostingId), inngestRunId

### ConversationMessage (JSON structure in messages[])

| Field      | Type                                | Description                                                  |
| ---------- | ----------------------------------- | ------------------------------------------------------------ |
| role       | "employer_agent" \| "seeker_agent"  | Message sender                                               |
| content    | String (max 2000)                   | Message text (may contain sensitive data)                    |
| phase      | ConversationPhase                   | discovery, screening, deep_evaluation, negotiation, decision |
| timestamp  | ISO DateTime                        | When message was sent                                        |
| turnNumber | Int (≥0)                            | Sequential turn number                                       |
| decision   | "MATCH" \| "NO_MATCH" \| "CONTINUE" | Optional turn decision                                       |
| evaluation | AgentEvaluation                     | Optional structured scores (NEVER exposed to users)          |

## Schema Changes

### SeekerSettings (add field)

| Field           | Type    | Constraints   | Description                                      |
| --------------- | ------- | ------------- | ------------------------------------------------ |
| dataUsageOptOut | Boolean | Default false | Opt out of data being used for model improvement |

### Employer (add field)

| Field           | Type    | Constraints   | Description                                      |
| --------------- | ------- | ------------- | ------------------------------------------------ |
| dataUsageOptOut | Boolean | Default false | Opt out of data being used for model improvement |

## Redacted Message Response Shape

The API returns a transformed message that strips sensitive fields:

| Field      | Type   | Description                                           |
| ---------- | ------ | ----------------------------------------------------- |
| role       | String | "employer_agent" or "seeker_agent"                    |
| content    | String | Message text with dollar amounts/percentages redacted |
| phase      | String | Conversation phase                                    |
| timestamp  | String | ISO datetime                                          |
| turnNumber | Int    | Sequential turn                                       |

Fields EXCLUDED from response: `decision`, `evaluation`

## Relationships

- AgentConversation → JobPosting (N:1) — employer accesses via posting
- AgentConversation → JobSeeker (N:1) — seeker accesses directly
- SeekerSettings.dataUsageOptOut — controls data training preference
- Employer.dataUsageOptOut — controls data training preference
