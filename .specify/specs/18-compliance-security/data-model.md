# Data Model — Feature 18: Compliance & Security

## New Entities

### AuditLog

Platform-wide compliance audit log. Separate from `ActivityLog` (employer team actions).

| Field      | Type           | Constraints       | Description                                                       |
| ---------- | -------------- | ----------------- | ----------------------------------------------------------------- |
| id         | String         | PK, cuid()        | Unique identifier                                                 |
| actorId    | String         | Not Null, Indexed | Clerk user ID of the actor                                        |
| actorType  | AuditActorType | Not Null          | JOB_SEEKER, EMPLOYER, SYSTEM                                      |
| action     | String         | Not Null, Indexed | Action type (e.g., "data.exported", "account.deletion_requested") |
| entityType | String?        |                   | Target entity type (e.g., "JobSeeker", "Match")                   |
| entityId   | String?        |                   | Target entity ID                                                  |
| metadata   | Json           | Default {}        | Additional context (non-sensitive)                                |
| ipHash     | String?        |                   | SHA-256 hashed IP address                                         |
| result     | AuditResult    | Not Null          | SUCCESS, FAILURE                                                  |
| createdAt  | DateTime       | Not Null, Indexed | Timestamp                                                         |

### DeletionRequest

Tracks account deletion requests with grace period.

| Field          | Type             | Constraints               | Description                                      |
| -------------- | ---------------- | ------------------------- | ------------------------------------------------ |
| id             | String           | PK, cuid()                | Unique identifier                                |
| clerkUserId    | String           | Not Null, Unique, Indexed | Clerk user ID requesting deletion                |
| userType       | DeletionUserType | Not Null                  | JOB_SEEKER, EMPLOYER                             |
| status         | DeletionStatus   | Not Null, Default PENDING | PENDING, CANCELLED, EXECUTING, COMPLETED, FAILED |
| reason         | String?          |                           | Optional deletion reason                         |
| scheduledAt    | DateTime         | Not Null                  | When deletion will execute (requestedAt + 72h)   |
| executedAt     | DateTime?        |                           | When deletion was completed                      |
| inngestEventId | String?          |                           | Inngest event ID for cancellation                |
| requestedAt    | DateTime         | Not Null, Default now()   | When request was made                            |

## New Enums

### AuditActorType

- JOB_SEEKER
- EMPLOYER
- SYSTEM

### AuditResult

- SUCCESS
- FAILURE

### DeletionUserType

- JOB_SEEKER
- EMPLOYER

### DeletionStatus

- PENDING
- CANCELLED
- EXECUTING
- COMPLETED
- FAILED

## Schema Modifications

### AgentConversation — Change onDelete

- `seeker` relation: `onDelete: Restrict` → `onDelete: Cascade`
- `jobPosting` relation: `onDelete: Restrict` → `onDelete: Cascade`

### Match — Change onDelete

- `conversation` relation: `onDelete: Restrict` → `onDelete: Cascade`
- `jobPosting` relation: `onDelete: Restrict` → `onDelete: Cascade`
- `seeker` relation: `onDelete: Restrict` → `onDelete: Cascade`
- `employer` relation: `onDelete: Restrict` → `onDelete: Cascade`

## Indexes

### AuditLog

- `(actorId, createdAt)` — query logs by user with time ordering
- `(action, createdAt)` — query logs by action type
- `(createdAt)` — retention cleanup queries

### DeletionRequest

- `(clerkUserId)` — unique, lookup by user
- `(status, scheduledAt)` — find pending deletions ready to execute
- `(status)` — admin queries

## Relationships

- `AuditLog` — standalone, no FK relationships (by design — audit logs must survive entity deletion)
- `DeletionRequest` — standalone, no FK relationships (tracks Clerk user IDs, not DB entity IDs, so it persists after deletion)

## Query Patterns

### Data Export (FR-1)

```
JobSeeker → include: settings, matches (with jobPosting.title), conversations (with messages), feedback
```

- Single query per entity type with `include`
- Conversations: messages already stored as Json[] array
- Redaction applied to conversation messages before export (reuse existing redaction.ts)

### Data Deletion (FR-2)

```
1. Create DeletionRequest (status: PENDING)
2. Schedule Inngest event at scheduledAt
3. On execution:
   a. Update DeletionRequest status → EXECUTING
   b. For JobSeeker: terminate active conversations → delete (Prisma cascades handle rest)
   c. For Employer: close active postings → terminate active conversations → delete
   d. Delete Clerk user/organization
   e. Update DeletionRequest status → COMPLETED
```

### Audit Log Queries (FR-4)

```
AuditLog WHERE actorId = ? AND createdAt BETWEEN ? AND ?
AuditLog WHERE action = ? ORDER BY createdAt DESC LIMIT ?
```

### Rate Limit State

- Stored in Upstash Redis (not in PostgreSQL)
- Key format: `rl:{userId}:{endpoint-category}` or `rl:ip:{hashedIp}:{endpoint-category}`
- TTL matches the rate limit window
