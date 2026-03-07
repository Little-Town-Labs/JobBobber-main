# Data Model: Feature 8 — Private Negotiation Parameters

**Status:** No changes needed — schema already exists.

---

## Existing Entities (No Migration Required)

### SeekerSettings (1:1 with JobSeeker)

| Field         | Type     | Constraints                  | Description                                     |
| ------------- | -------- | ---------------------------- | ----------------------------------------------- |
| id            | String   | PK, CUID                     | Unique identifier                               |
| seekerId      | String   | Unique, FK→JobSeeker         | Owner identity                                  |
| minSalary     | Int?     | Optional, ≥ 0                | Minimum acceptable salary                       |
| salaryRules   | Json     | Default `{}`                 | Flexibility rules (e.g., "flexible for equity") |
| dealBreakers  | String[] | Max 20 items, 200 chars each | Disqualifying conditions                        |
| priorities    | String[] | Max 20 items, 200 chars each | Ordered priority list                           |
| exclusions    | String[] | Max 20 items, 200 chars each | Companies/industries to avoid                   |
| customPrompt  | String?  | Max 2000 chars               | Optional agent behavior prompt                  |
| notifPrefs    | Json     | Default `{}`                 | Notification preferences                        |
| byok\* fields | Various  | —                            | BYOK key storage (Feature 5)                    |
| createdAt     | DateTime | Auto                         | Creation timestamp                              |
| updatedAt     | DateTime | Auto                         | Last update timestamp                           |

### JobSettings (1:1 with JobPosting, CASCADE delete)

| Field           | Type       | Constraints                    | Description                         |
| --------------- | ---------- | ------------------------------ | ----------------------------------- |
| id              | String     | PK, CUID                       | Unique identifier                   |
| jobPostingId    | String     | Unique, FK→JobPosting          | Parent posting                      |
| trueMaxSalary   | Int?       | Optional, ≥ 0                  | Actual budget maximum               |
| minQualOverride | Json?      | Optional                       | Softened qualification requirements |
| willingToTrain  | String[]   | Max 20 items, 200 chars each   | Skills employer will train          |
| urgency         | JobUrgency | Enum: LOW/MEDIUM/HIGH/CRITICAL | Hiring urgency                      |
| priorityAttrs   | String[]   | Max 10 items, 200 chars each   | Ranked candidate attributes         |
| customPrompt    | String?    | Max 2000 chars                 | Optional agent behavior prompt      |
| byok\* fields   | Various    | —                              | BYOK key storage (Feature 5)        |
| createdAt       | DateTime   | Auto                           | Creation timestamp                  |
| updatedAt       | DateTime   | Auto                           | Last update timestamp               |

## Privacy Invariant

Both tables exist in isolation from public-facing models. They are:

- Never JOINed into public API responses
- Only accessible via dedicated `settings.ts` router procedures
- Gated behind `PRIVATE_PARAMS` feature flag
- Scoped by authenticated user identity (no cross-user access)
