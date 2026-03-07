# Data Model — 4-employer-profile-job-posting

**Date:** 2026-03-05

---

## Existing Entities (No Migration Required)

The Prisma schema already contains all entities needed for this feature. No database migrations are required.

### Employer (existing)

| Field               | Type      | Constraints  | Description                |
| ------------------- | --------- | ------------ | -------------------------- |
| id                  | String    | PK, cuid     | Unique identifier          |
| clerkOrgId          | String    | Unique       | Clerk Organization ID      |
| name                | String    | Not Null     | Company name               |
| industry            | String?   |              | Industry vertical          |
| size                | String?   |              | Company size category      |
| description         | String?   |              | Company description        |
| culture             | String?   |              | Culture summary            |
| headquarters        | String?   |              | HQ location                |
| locations           | String[]  |              | Office locations           |
| websiteUrl          | String?   |              | Primary website            |
| urls                | Json      | Default `{}` | Structured additional URLs |
| benefits            | String[]  |              | Company-wide benefits      |
| logoUrl             | String?   |              | Logo cloud storage URL     |
| byokApiKeyEncrypted | String?   |              | BYOK key (never exposed)   |
| byokProvider        | String?   |              | 'openai' or 'anthropic'    |
| byokKeyValidatedAt  | DateTime? |              | Last key validation        |
| byokMaskedKey       | String?   |              | Display-safe key hint      |
| createdAt           | DateTime  | Not Null     | Creation timestamp         |
| updatedAt           | DateTime  | Auto         | Last update timestamp      |

### JobPosting (existing)

| Field            | Type             | Constraints   | Description                       |
| ---------------- | ---------------- | ------------- | --------------------------------- |
| id               | String           | PK, cuid      | Unique identifier                 |
| employerId       | String           | FK → Employer | Owning employer                   |
| title            | String           | Not Null      | Job title                         |
| department       | String?          |               | Department name                   |
| description      | String           | Not Null      | Full description                  |
| responsibilities | String?          |               | Role responsibilities             |
| requiredSkills   | String[]         |               | Required skill tags               |
| preferredSkills  | String[]         |               | Preferred skill tags              |
| experienceLevel  | ExperienceLevel  | Not Null      | ENTRY/MID/SENIOR/EXECUTIVE        |
| employmentType   | EmploymentType   | Not Null      | FULL_TIME/PART_TIME/CONTRACT      |
| locationType     | LocationType     | Not Null      | REMOTE/HYBRID/ONSITE              |
| locationReq      | String?          |               | Geographic requirements           |
| salaryMin        | Int?             |               | Minimum salary (public)           |
| salaryMax        | Int?             |               | Maximum salary (public)           |
| benefits         | String[]         |               | Role-specific benefits            |
| whyApply         | String?          |               | Compelling case narrative         |
| status           | JobPostingStatus | Default DRAFT | DRAFT/ACTIVE/PAUSED/CLOSED/FILLED |
| createdAt        | DateTime         | Not Null      | Creation timestamp                |
| updatedAt        | DateTime         | Auto          | Last update timestamp             |

### JobSettings (existing — private, gated behind PRIVATE_PARAMS flag)

| Field               | Type       | Constraints            | Description                 |
| ------------------- | ---------- | ---------------------- | --------------------------- |
| id                  | String     | PK, cuid               | Unique identifier           |
| jobPostingId        | String     | Unique FK → JobPosting | Owning posting              |
| trueMaxSalary       | Int?       |                        | Real salary ceiling         |
| minQualOverride     | Json?      |                        | Min qualifications override |
| willingToTrain      | String[]   |                        | Skills willing to train     |
| urgency             | JobUrgency | Default MEDIUM         | LOW/MEDIUM/HIGH/CRITICAL    |
| priorityAttrs       | String[]   |                        | Attribute priority ranking  |
| customPrompt        | String?    |                        | Custom agent instructions   |
| byokApiKeyEncrypted | String?    |                        | Posting-level BYOK override |
| byokProvider        | String?    |                        | Provider override           |

### EmployerMember (existing — multi-member ships in Feature 13)

| Field       | Type               | Constraints    | Description             |
| ----------- | ------------------ | -------------- | ----------------------- |
| id          | String             | PK, cuid       | Unique identifier       |
| employerId  | String             | FK → Employer  | Organization            |
| clerkUserId | String             |                | Clerk user ID           |
| role        | EmployerMemberRole | Default VIEWER | ADMIN/JOB_POSTER/VIEWER |

## Relationships

```
Employer 1:N JobPosting (cascade delete)
Employer 1:N EmployerMember (cascade delete)
JobPosting 1:1 JobSettings (cascade delete)
```

## Status State Machine

```
DRAFT ─────→ ACTIVE
               │
               ├──→ PAUSED ──→ ACTIVE (reactivate)
               │       │
               │       ├──→ CLOSED (terminal)
               │       └──→ FILLED (terminal)
               │
               ├──→ CLOSED (terminal)
               └──→ FILLED (terminal)
```

## Indexes (existing)

- `employers.clerkOrgId` (unique)
- `employers.industry`
- `job_postings.employerId`
- `job_postings.status`
- `job_postings.experienceLevel`
- `job_postings.employmentType`
- `job_postings.locationType`
- `job_postings.status + employerId` (compound)
- `employer_members.clerkUserId`
- `employer_members.employerId`
