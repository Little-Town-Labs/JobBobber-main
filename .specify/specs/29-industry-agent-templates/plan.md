# Implementation Plan: Feature 29 — Industry Agent Templates

## Executive Summary

Add pre-built industry-specific prompt templates that employers can attach to job postings. Templates adjust the AI agent's evaluation criteria, scoring weights, and terminology during candidate matching. Templates layer between the core system prompt and the custom prompt (Feature 15). Database-backed versioned templates seeded from JSON files. Template version locked per posting. Feature gated behind `INDUSTRY_TEMPLATES` flag.

## Architecture Overview

```
Job Posting Settings Page
┌──────────────────────────────────┐
│ Template Selector (radio group)  │  ◄── trpc.industryTemplates.list
│  ○ General (default)             │
│  ● Technology/Engineering ▼      │
│    • Technical skills depth      │
│    • System design experience    │
│    • Open source contributions   │
│  ○ Healthcare                    │
│  ○ Finance                       │
│  ○ Sales/Marketing               │
├──────────────────────────────────┤
│ Custom Prompt (existing F15)     │
│ ┌──────────────────────────────┐ │
│ │ [textarea]                   │ │
│ └──────────────────────────────┘ │
└──────────────────────────────────┘
         │ updateJobSettings({ templateVersionId, customPrompt })
         ▼
Agent Evaluation Pipeline
┌──────────────────────────────────────────┐
│ 1. Core System Prompt (guardrails)       │ ── unchanged
│ 2. <industry-template> block             │ ── NEW (from IndustryTemplate.content)
│ 3. <user-customization> block            │ ── unchanged (Feature 15)
│ 4. Job posting context                   │ ── unchanged
│ 5. Candidate context                     │ ── unchanged
└──────────────────────────────────────────┘
```

## Technology Decisions

### TD-1: Database Model + JSON Seed Files

**Decision:** Prisma `IndustryTemplate` model, seeded from `prisma/seed-templates.ts`.

**Rationale:** Spec NFR-2 requires "no code changes to add new templates." Database model enables adding templates via seed scripts or future admin UI. JSON seed files provide reproducible, version-controlled initial data.

**Alternatives rejected:** Hardcoded TypeScript objects (violates NFR-2), pure JSON files at runtime (no versioning/deprecation guarantees).

### TD-2: Template Content Structure

**Decision:** Structured JSON content field:

```typescript
interface TemplateContent {
  evaluationDimensions: Array<{
    name: string // e.g. "technical_skills_depth"
    label: string // e.g. "Technical Skills Depth"
    description: string // Plain-language for preview
    weight: number // 0.0-1.0 relative importance
    scoringGuidance: string // LLM scoring instructions
  }>
  terminologyMappings: Record<string, string>
  evaluationPreamble: string // Industry-specific context paragraph
}
// Note: summaryBullets stored as top-level field on IndustryTemplate model,
// NOT in TemplateContent — keeps user-facing preview text separate from LLM prompt content.
```

**Rationale:** Maps to existing agent output schema dimensions. Weights allow industry-specific scoring emphasis. Summary bullets (user-facing) are separate from prompt text (LLM-facing).

### TD-3: Prompt Composition — Template Between Core and Custom

**Decision:** Layering: Core → `<industry-template>` → `<user-customization>`

**Rationale:** Template sets base framework, custom prompt adds company-specific adjustments on top. Custom prompt takes precedence for conflicts (later instructions override earlier in LLM processing). Same sandboxing pattern as Feature 15.

### TD-4: Version Locking via FK

**Decision:** `JobSettings.templateVersionId` FK to specific `IndustryTemplate` row. Each template version is a separate row (same slug, different version number).

**Rationale:** Single FK guarantees referential integrity and immutability. Querying "latest version" is `ORDER BY version DESC LIMIT 1` on slug. No complex version resolution logic.

### TD-5: Template Selector as Radio Group

**Decision:** Radio group above the custom prompt textarea on existing settings page.

**Rationale:** Only 5 options — radio group with expandable preview panels works better than dropdown. Placement above custom prompt reinforces the "template as base, custom on top" mental model.

## Implementation Phases

### Phase 1: Data Layer

1.1 Add `IndustryTemplate` model + `JobSettings` fields to Prisma schema
1.2 Add `INDUSTRY_TEMPLATES` feature flag
1.3 Create `src/lib/industry-templates.ts` — type definitions, Zod schema, `composeTemplateBlock()`
1.4 Create `prisma/seed-templates.ts` — 5 template seeds with full content
1.5 Generate migration and run seed

### Phase 2: Prompt Composition

2.1 Add `buildTemplateBlock()` to `src/server/agents/prompt-sandbox.ts`
2.2 Modify `buildEmployerSystemPrompt()` signature — add optional `templateContent` param
2.3 Modify `buildEvaluationPrompt()` — same pattern
2.4 Write unit tests for composition (TDD)
2.5 Update prompt-sandbox tests
2.6 Add `</?industry-template>` to injection patterns in `prompt-guard.ts`

### Phase 3: API Layer

3.1 Create `src/server/api/routers/industry-templates.ts` — `list`, `getById`, `checkUpdate`
3.2 Register router in `root.ts`
3.3 Extend settings router — add `templateVersionId` to `updateJobSettings`/`getJobSettings`
3.4 Write router tests (TDD)

### Phase 4: Inngest Integration

4.1 Modify `run-agent-conversation.ts` — load template in `load-context` step, pass to agent
4.2 Integration test for template in conversation flow

### Phase 5: UI Layer

5.1 Create `src/components/settings/template-selector.tsx`
5.2 Integrate into `/postings/[id]/settings/page.tsx`
5.3 Write component tests

### Phase 6: Edge Cases

6.1 Deprecated template warning in settings page
6.2 Prompt length validation (`validateCombinedPromptLength`)

## Template Content (Initial Seed)

### General (default)

Mirrors existing 6 dimensions with equal weights:

- Skills Alignment (0.20)
- Experience Fit (0.20)
- Compensation Alignment (0.15)
- Work Arrangement (0.15)
- Culture Fit (0.15)
- Growth Potential (0.15)

### Technology/Engineering

- Technical Skills Depth (0.25)
- System Design Experience (0.20)
- Code Quality Indicators (0.15)
- Relevant Certifications (0.15)
- Growth Trajectory (0.15)
- Culture & Collaboration (0.10)

### Healthcare

- Clinical Certifications (0.25)
- Compliance & Regulatory Training (0.20)
- Patient Care Experience (0.20)
- EMR/EHR Proficiency (0.15)
- Continuing Education (0.10)
- Team Collaboration (0.10)

### Finance

- Regulatory Licenses (0.25)
- Quantitative Skills (0.20)
- Risk Management (0.20)
- Compliance Awareness (0.15)
- Financial Modeling (0.10)
- Client Relationship (0.10)

### Sales/Marketing

- Revenue & Pipeline Metrics (0.25)
- Campaign Strategy (0.20)
- CRM & Analytics Proficiency (0.15)
- Industry Vertical Experience (0.15)
- Relationship Management (0.15)
- Growth Mindset (0.10)

## Testing Strategy

- **Unit:** Template content validation, `composeTemplateBlock`, prompt length, General=empty-block
- **Integration:** Router procedures, settings router template selection, conversation flow with template
- **Component:** Template selector rendering, selection, preview, feature flag gating, deprecation warning

## Security

- Templates sandboxed via `<industry-template>` XML block (same pattern as Feature 15)
- `</?industry-template>` added to injection detection patterns
- Templates read-only for employers (no user-editable content)
- Template cannot override core guardrails (layering order enforces this)

## Performance

- Template loading: 1 additional JOIN in `load-context` step (<5KB JSON blob)
- Template composition: <50ms additional prompt building time
- No additional LLM calls required
- Template selector: <200ms load via tRPC query

## Risks

| Risk                          | Severity | Mitigation                                                               |
| ----------------------------- | -------- | ------------------------------------------------------------------------ |
| Breaking existing evaluations | High     | `templateContent` optional, null = empty string = pre-F29 behavior       |
| Template prompt quality       | Medium   | Templates authored as reviewed seed data, separate from user-facing text |
| Version locking orphans       | Low      | Template rows never deleted, only deprecated                             |
| Combined prompt too long      | Low      | `validateCombinedPromptLength` with truncation warning                   |

## Constitutional Compliance

- [x] Test-first imperative (TDD phases documented)
- [x] Simplicity enforced (extends existing prompt pipeline, data-driven templates)
- [x] Security standards met (sandboxing, injection detection)
- [x] Performance requirements addressed (<50ms overhead)
- [x] Feature flag gated (INDUSTRY_TEMPLATES)
