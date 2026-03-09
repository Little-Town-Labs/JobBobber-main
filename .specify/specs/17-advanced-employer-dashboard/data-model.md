# Data Model — Feature 17: Advanced Employer Dashboard

## Overview

Feature 17 requires **no new database models**. All data already exists in the schema from previous features. The work is entirely in new queries, aggregations, and UI components built on top of existing entities.

## Existing Entities Used

### JobPosting (Feature 4)

Used for pipeline overview. Key fields:

- `id`, `title`, `status`, `employerId`
- `experienceLevel`, `employmentType`, `locationType`

### Match (Feature 5/10)

Core entity for pipeline metrics, filtering, bulk operations, and comparison. Key fields:

- `id`, `jobPostingId`, `seekerId`, `employerId`
- `confidenceScore` (STRONG/GOOD/POTENTIAL)
- `employerStatus` (PENDING/ACCEPTED/DECLINED)
- `matchSummary`, `evaluationData`
- `createdAt`

### AgentConversation (Feature 9)

Used for posting metrics (FR-5). Key fields:

- `jobPostingId`, `seekerId`, `status` (IN_PROGRESS/COMPLETED_MATCH/COMPLETED_NO_MATCH/TERMINATED)

### JobSeeker (Feature 3)

Used for comparison view — candidate details displayed side-by-side. Key fields:

- `id`, `name`, `skills`, `location`
- `experience` (JSON), `education` (JSON)

### ActivityLog (Feature 13)

Already exists for team activity view (FR-7). Key fields:

- `employerId`, `actorClerkUserId`, `actorName`
- `action`, `targetType`, `targetId`, `targetLabel`
- `createdAt`

### EmployerMember (Feature 13)

Used to determine admin role for activity log access. Key fields:

- `employerId`, `clerkUserId`, `role` (ADMIN/JOB_POSTER/VIEWER)

## New Indexes

No new indexes required. Existing indexes already cover the query patterns:

- `matches.jobPostingId` — pipeline aggregation, filtering
- `matches.employerStatus` — status filtering
- `matches.jobPostingId + employerId` — ownership verification
- `agent_conversations.jobPostingId` — conversation metrics
- `agent_conversations.status` — status aggregation
- `activity_logs.employerId + createdAt` — team activity pagination
- `job_postings.status + employerId` — active postings query

## Aggregation Queries (New)

### Pipeline Summary Query

Aggregates match counts per posting for the employer:

- Group `Match` by `[jobPostingId, employerStatus]` → counts per status
- Group `AgentConversation` by `[jobPostingId, status]` → conversation metrics
- Join with `JobPosting` for title/status

### Bulk Update Query

Uses `updateMany` with WHERE clause:

- Filter: `id IN [selected IDs]` AND `employerStatus = PENDING` AND `jobPostingId = [posting]` AND employer ownership verified
- Returns count of updated rows

### Enhanced Filtering Query

Extends existing `listForPosting` with additional WHERE conditions:

- `confidenceScore IN [selected levels]`
- Join to `JobSeeker` for `experienceLevel` filtering (via `AgentConversation.seekerId`)
- Join to `JobPosting` for `locationType` filtering

## Data Flow

```
Pipeline View:
  JobPosting[] ──→ groupBy(Match.jobPostingId, Match.employerStatus) ──→ Pipeline Summary
                ──→ groupBy(AgentConversation.jobPostingId, status) ──→ Conversation Metrics

Comparison View:
  Match[] (selected 2-4) ──→ include JobSeeker (name, skills, experience) ──→ Side-by-side

Bulk Operations:
  Match.updateMany(ids[], newStatus) ──→ Return {updated, skipped}

CSV Export:
  Match[] (client-side) ──→ CSV string ──→ Blob download

Team Activity:
  ActivityLog.findMany(employerId, pagination) ──→ Activity list
```
