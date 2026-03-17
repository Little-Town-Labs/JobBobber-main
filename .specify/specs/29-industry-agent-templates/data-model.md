# Data Model: Feature 29 — Industry Agent Templates

## New Model

### IndustryTemplate

Pre-built prompt template for industry-specific agent evaluations. Each row is a specific version of a template — multiple rows share the same `slug` with different `version` numbers.

| Field          | Type     | Constraints   | Description                                       |
| -------------- | -------- | ------------- | ------------------------------------------------- |
| id             | String   | PK, CUID      | Unique identifier                                 |
| slug           | String   | Not Null      | Template identifier ("technology", "healthcare")  |
| version        | Int      | Default 1     | Version number (incremented on updates)           |
| name           | String   | Not Null      | Display name ("Technology / Engineering")         |
| description    | String   | Not Null      | Short description for UI                          |
| industry       | String   | Not Null      | Category label                                    |
| content        | Json     | Not Null      | TemplateContent (dimensions, weights, preamble)   |
| summaryBullets | String[] | Not Null      | Plain-language preview bullets (4-6 items)        |
| isDefault      | Boolean  | Default false | True only for "general" template                  |
| isDeprecated   | Boolean  | Default false | Hidden from selector, valid for existing postings |
| createdAt      | DateTime | Default now   | Creation timestamp                                |

**Indexes:** `slug`, `isDeprecated`
**Unique constraint:** `[slug, version]`
**Relations:** JobSettings[] (has many)
**Table:** `industry_templates`

## Modified Model: JobSettings

Add template reference fields:

| Field             | Type    | Constraints  | Description                                        |
| ----------------- | ------- | ------------ | -------------------------------------------------- |
| templateVersionId | String? | FK, Optional | Specific IndustryTemplate version for this posting |

**Relation:** `IndustryTemplate? @relation(fields: [templateVersionId], references: [id])`

## TemplateContent JSON Structure

```typescript
interface TemplateContent {
  evaluationDimensions: Array<{
    name: string // Machine key: "technical_skills_depth"
    label: string // Human label: "Technical Skills Depth"
    description: string // Plain-language description
    weight: number // 0.0-1.0 relative importance
    scoringGuidance: string // LLM instructions for scoring
  }>
  terminologyMappings: Record<string, string> // e.g. { "candidate": "applicant" }
  evaluationPreamble: string // Industry-specific context paragraph for LLM
}
```

## Design Decisions

- **Separate rows per version** (not JSON version history): Simpler queries, referential integrity via FK.
- **`slug` + `version` unique constraint**: Prevents duplicate versions, enables "latest" query via `ORDER BY version DESC LIMIT 1`.
- **`summaryBullets` on model** (not in `content`): Keeps user-facing preview text separate from LLM-facing prompt content. Avoids exposing prompt engineering details.
- **`isDefault` flag**: Only the "general" template is default. Used to auto-select when no template is explicitly chosen.
- **No cascade delete**: Templates outlive postings. Deprecated templates remain valid for existing references.
- **Single FK on JobSettings**: `templateVersionId` points to the exact version, guaranteeing immutability.

## Seed Data

5 initial templates seeded from `prisma/seed-templates.ts`:

| Slug            | Name                     | Dimensions                     | Default |
| --------------- | ------------------------ | ------------------------------ | ------- |
| general         | General                  | 6 (existing balanced criteria) | Yes     |
| technology      | Technology / Engineering | 6 (tech-focused)               | No      |
| healthcare      | Healthcare               | 6 (clinical-focused)           | No      |
| finance         | Finance                  | 6 (regulatory-focused)         | No      |
| sales-marketing | Sales / Marketing        | 6 (revenue-focused)            | No      |

Seed script uses `upsert` on `[slug, version]` for idempotency.

## Query Patterns

### List Available Templates

```
db.industryTemplate.findMany({
  where: { isDeprecated: false },
  orderBy: [{ slug: 'asc' }, { version: 'desc' }],
  distinct: ['slug']
})
```

Returns latest version of each non-deprecated template.

### Load Template for Evaluation

```
db.industryTemplate.findUnique({
  where: { id: jobSettings.templateVersionId }
})
```

Single-row lookup by PK during `load-context` Inngest step.

### Check for Updates

```
db.industryTemplate.findFirst({
  where: {
    slug: currentTemplate.slug,
    version: { gt: currentTemplate.version },
    isDeprecated: false
  },
  orderBy: { version: 'desc' }
})
```

Returns newest version if one exists, null if current is latest.
