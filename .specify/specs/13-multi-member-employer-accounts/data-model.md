# Data Model

## Existing Entities (no changes needed)

### Employer

Already has `clerkOrgId` and `members` relation. No schema changes required.

### EmployerMember

Already has `employerId`, `clerkUserId`, `role` (ADMIN | JOB_POSTER | VIEWER), `invitedBy`, `joinedAt`. No schema changes required.

### EmployerMemberRole (enum)

Already defined: `ADMIN`, `JOB_POSTER`, `VIEWER`. No changes required.

## New Entities

### Invitation

| Field             | Type               | Constraints               | Description                                    |
| ----------------- | ------------------ | ------------------------- | ---------------------------------------------- |
| id                | String (CUID)      | Primary Key               | Unique identifier                              |
| employerId        | String             | FK → Employer, Not Null   | Organization this invitation belongs to        |
| email             | String(255)        | Not Null                  | Invitee's email address                        |
| role              | EmployerMemberRole | Not Null                  | Role assigned on acceptance                    |
| invitedBy         | String             | Not Null                  | Clerk user ID of the admin who sent it         |
| clerkInvitationId | String             | Unique, Nullable          | Clerk's invitation ID for tracking             |
| status            | InvitationStatus   | Not Null, Default PENDING | Current status                                 |
| expiresAt         | DateTime           | Not Null                  | When invitation expires (7 days from creation) |
| createdAt         | DateTime           | Not Null, Default now()   | Creation timestamp                             |
| acceptedAt        | DateTime           | Nullable                  | When invitation was accepted                   |

### InvitationStatus (enum)

- `PENDING` — invitation sent, awaiting acceptance
- `ACCEPTED` — invitee joined the organization
- `EXPIRED` — invitation passed its expiration date
- `REVOKED` — admin manually revoked the invitation

### ActivityLog

| Field            | Type          | Constraints             | Description                                                  |
| ---------------- | ------------- | ----------------------- | ------------------------------------------------------------ |
| id               | String (CUID) | Primary Key             | Unique identifier                                            |
| employerId       | String        | FK → Employer, Not Null | Organization this activity belongs to                        |
| actorClerkUserId | String        | Not Null                | Clerk user ID of person who performed the action             |
| actorName        | String(255)   | Not Null                | Display name at time of action (denormalized)                |
| action           | String(50)    | Not Null                | Action type (e.g., "posting.created", "member.invited")      |
| targetType       | String(50)    | Nullable                | Entity type of target (e.g., "JobPosting", "EmployerMember") |
| targetId         | String        | Nullable                | ID of the target entity                                      |
| targetLabel      | String(255)   | Nullable                | Human-readable label (e.g., posting title)                   |
| createdAt        | DateTime      | Not Null, Default now() | When the action occurred                                     |

## Relationships

- Invitation belongsTo Employer (N:1)
- ActivityLog belongsTo Employer (N:1)
- Employer hasMany Invitations (1:N)
- Employer hasMany ActivityLogs (1:N)

## Indexes

### Invitation

- `[employerId, status]` — list pending invitations for an org
- `[email, employerId]` — prevent duplicate invitations
- `[clerkInvitationId]` — lookup by Clerk invitation ID (unique)
- `[expiresAt]` — cleanup expired invitations

### ActivityLog

- `[employerId, createdAt]` — list activity for an org in chronological order
- `[actorClerkUserId]` — filter by actor

## Role Permission Matrix

| Operation              | ADMIN | JOB_POSTER | VIEWER |
| ---------------------- | ----- | ---------- | ------ |
| View company profile   | Yes   | Yes        | Yes    |
| Edit company profile   | Yes   | No         | No     |
| Create job posting     | Yes   | Yes        | No     |
| Edit job posting       | Yes   | Yes (own)  | No     |
| Delete job posting     | Yes   | Yes (own)  | No     |
| Change posting status  | Yes   | Yes (own)  | No     |
| View matches           | Yes   | Yes        | Yes    |
| Accept/decline matches | Yes   | Yes        | No     |
| View conversation logs | Yes   | Yes        | Yes    |
| Invite members         | Yes   | No         | No     |
| Remove members         | Yes   | No         | No     |
| Change member roles    | Yes   | No         | No     |
| View activity log      | Yes   | No         | No     |
| Manage BYOK key        | Yes   | No         | No     |
