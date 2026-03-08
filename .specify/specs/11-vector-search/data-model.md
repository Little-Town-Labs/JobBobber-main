# Data Model — 11-vector-search

## Existing Fields (already in schema)

### JobSeeker

| Field            | Type         | Status               | Description                        |
| ---------------- | ------------ | -------------------- | ---------------------------------- |
| profileEmbedding | vector(1536) | Exists (Unsupported) | pgvector embedding of profile text |

### JobPosting

| Field        | Type         | Status               | Description                        |
| ------------ | ------------ | -------------------- | ---------------------------------- |
| jobEmbedding | vector(1536) | Exists (Unsupported) | pgvector embedding of posting text |

## New Fields

### JobSeeker (additions)

| Field              | Type      | Constraints | Description                       |
| ------------------ | --------- | ----------- | --------------------------------- |
| embeddingUpdatedAt | DateTime? | Nullable    | When embedding was last generated |

### JobPosting (additions)

| Field              | Type      | Constraints | Description                       |
| ------------------ | --------- | ----------- | --------------------------------- |
| embeddingUpdatedAt | DateTime? | Nullable    | When embedding was last generated |

## Indexes

### New Indexes (for vector search)

pgvector indexes must be created via raw SQL migration (Prisma doesn't support vector index syntax):

```sql
-- IVFFlat index for approximate nearest neighbor search
-- lists = sqrt(row_count) is a good starting point; 100 covers up to 10K profiles
CREATE INDEX idx_job_seekers_embedding ON job_seekers
  USING ivfflat (profile_embedding vector_cosine_ops)
  WITH (lists = 100);

CREATE INDEX idx_job_postings_embedding ON job_postings
  USING ivfflat (job_embedding vector_cosine_ops)
  WITH (lists = 50);
```

## Query Patterns

### Similarity Search (candidates for a posting)

```sql
SELECT js.id, js.name, js.skills,
       1 - (js.profile_embedding <=> $1) AS similarity
FROM job_seekers js
WHERE js.is_active = true
  AND js.profile_embedding IS NOT NULL
  AND js.id NOT IN (
    SELECT ac.seeker_id FROM agent_conversations ac
    WHERE ac.job_posting_id = $2
  )
ORDER BY js.profile_embedding <=> $1
LIMIT $3;
```

### Parameters

- `$1`: Job posting embedding vector
- `$2`: Job posting ID (for exclusion)
- `$3`: Top-N limit (configurable, default 20)

## Embedding Text Templates

### Profile Embedding Input

```
Title: {headline}
Skills: {skills.join(", ")}
Experience: {experience summary}
Education: {education summary}
Location: {location}
```

### Posting Embedding Input

```
Title: {title}
Description: {description}
Required Skills: {requiredSkills.join(", ")}
Experience Level: {experienceLevel}
Employment Type: {employmentType}
Location: {locationType} {locationReq}
Salary Range: {salaryMin}-{salaryMax}
```
