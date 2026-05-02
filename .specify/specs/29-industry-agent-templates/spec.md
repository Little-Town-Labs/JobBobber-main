# Feature 29: Industry Agent Templates

**Branch:** 29-industry-agent-templates
**PRD Section:** Section 7.1 Agent Types (Industry Specialization)
**Priority:** P2
**Complexity:** Medium
**Status:** Planned
**Dependencies:** None (builds on existing custom agent prompting, Feature 15)

---

## Overview

Different industries evaluate candidates using different criteria, terminology, and
priorities. A healthcare hiring manager cares about certifications and compliance
training; a tech company prioritizes specific programming languages and system design
experience; a finance firm weighs regulatory knowledge and quantitative skills.

This feature provides pre-built agent prompt templates optimized for specific
industries. Employers select a template when configuring a job posting, and the
matching agent adjusts its evaluation criteria, scoring weights, and terminology
accordingly. Templates work alongside (not replace) the existing custom prompt
system from Feature 15.

**Business Value:** Improves match quality for specialized industries by using
domain-appropriate evaluation criteria, reducing the need for employers to manually
craft complex custom prompts.

---

## User Stories

### User Story 1: Select Industry Template for a Posting

**As an** employer
**I want** to select an industry template when creating or editing a job posting
**So that** the matching agent evaluates candidates using criteria relevant to my industry

**Acceptance Criteria:**

- [ ] A template selector is available on the job posting settings page
- [ ] Available templates include at least: Technology/Engineering, Healthcare, Finance, Sales/Marketing
- [ ] A "General" (default) template is always available as a fallback
- [ ] Selecting a template shows a preview of the evaluation criteria it uses
- [ ] Template selection can be changed at any time before or after posting is published
- [ ] Changing a template does not retroactively affect existing matches

**Priority:** High

### User Story 2: Template-Adjusted Agent Evaluations

**As an** employer
**I want** the matching agent to use industry-specific evaluation criteria
**So that** candidates are scored on what actually matters for my industry

**Acceptance Criteria:**

- [ ] When a template is selected, the agent uses template-specific evaluation dimensions
- [ ] Technology template emphasizes: technical skills depth, system design experience, open source contributions, relevant certifications
- [ ] Healthcare template emphasizes: clinical certifications, compliance training, patient care experience, regulatory knowledge
- [ ] Finance template emphasizes: regulatory licenses (CFA, Series 7), quantitative skills, risk management experience, compliance awareness
- [ ] Sales/Marketing template emphasizes: revenue metrics, campaign experience, CRM proficiency, industry vertical experience
- [ ] The General template uses the existing balanced evaluation criteria

**Priority:** High

### User Story 3: Template and Custom Prompt Coexistence

**As an** employer
**I want** to use an industry template AND add my own custom prompt additions
**So that** I get industry-appropriate defaults plus my company-specific preferences

**Acceptance Criteria:**

- [ ] Custom prompt (Feature 15) and industry template can be used together
- [ ] Custom prompt additions are applied on top of the template (not replaced by it)
- [ ] If both are present, the template sets the base evaluation framework and the custom prompt adds company-specific adjustments
- [ ] User is informed about how the two interact (tooltip or help text)

**Priority:** High

### User Story 4: Preview Template Evaluation Criteria

**As an** employer
**I want** to preview what evaluation criteria each template uses before selecting it
**So that** I can make an informed choice about which template fits my hiring needs

**Acceptance Criteria:**

- [ ] Each template displays a summary of its key evaluation dimensions
- [ ] Summary includes 4-6 bullet points describing what the template prioritizes
- [ ] Summary is displayed inline when the user hovers or clicks on a template option
- [ ] Differences from the General template are highlighted

**Priority:** Medium

### User Story 5: Template Versioning

**As a** platform operator
**I want** templates to be versioned
**So that** template improvements don't unexpectedly change in-progress evaluations

**Acceptance Criteria:**

- [ ] Each template has a version identifier
- [ ] When a posting selects a template, the version is recorded
- [ ] Future template updates create new versions without affecting existing postings
- [ ] Employers can opt into a newer template version for existing postings
- [ ] Template version history is auditable

**Priority:** Medium

---

## Functional Requirements

### FR-1: Template Catalog

The system shall maintain a catalog of industry templates, each containing:

- Template name and description
- Industry category
- Version identifier
- Evaluation dimensions (ordered list of criteria the agent prioritizes)
- Scoring weight adjustments (relative importance of each dimension)
- Industry-specific terminology mappings
- Example evaluation prompts

### FR-2: Template Selection

Employers select a template on the job posting settings page (`/postings/[id]/settings`), alongside the existing custom prompt field from Feature 15. Template selection is not part of the initial posting creation form — it is an advanced configuration step. The selection is stored per posting, not per employer (different postings may use different templates).

### FR-3: Prompt Composition

When evaluating a candidate, the agent prompt is composed by layering:

1. Core system prompt (platform guardrails, format instructions)
2. Industry template (evaluation criteria, terminology, weights)
3. Custom prompt additions (Feature 15, if present)
4. Job posting context (title, description, skills, requirements)
5. Candidate context (profile, skills, experience)

### FR-4: Template Content (Minimum Viable Set)

**Technology/Engineering:**

- Technical skill depth and relevance
- System design and architecture experience
- Code quality indicators (open source, portfolio)
- Relevant certifications (AWS, GCP, etc.)
- Growth trajectory and learning velocity

**Healthcare:**

- Clinical certifications and licensure
- Compliance and regulatory training
- Patient care experience and specializations
- EMR/EHR system proficiency
- Continuing education engagement

**Finance:**

- Regulatory licenses (CFA, CPA, Series 7/63/65)
- Quantitative and analytical skills
- Risk management experience
- Compliance and audit awareness
- Financial modeling proficiency

**Sales/Marketing:**

- Revenue and pipeline metrics
- Campaign strategy and execution
- CRM and analytics tool proficiency
- Industry vertical specialization
- Customer relationship management track record

### FR-5: Default Template

New postings use the "General" template by default. The General template uses the existing balanced evaluation criteria (no industry-specific weighting).

### FR-6: Template Immutability per Posting

Once a posting is associated with a template version, that version is locked for that posting's evaluations. Template updates do not affect in-progress postings unless the employer explicitly opts in.

---

## Non-Functional Requirements

### NFR-1: Performance

- Template selection and preview loading < 200ms
- Template composition (layering into agent prompt) adds < 50ms to evaluation time
- No additional LLM calls required for template application (templates modify the prompt, not the pipeline)

### NFR-2: Extensibility

- Adding a new industry template must not require code changes to the evaluation pipeline
- Templates are data-driven (stored as structured content, not hardcoded)

### NFR-3: Security

- Templates cannot override core platform guardrails (safety instructions, output format)
- Template content is sandboxed using the same mechanism as custom prompts (Feature 15)
- Templates are read-only for employers (no user-editable template content)

### NFR-4: Usability

- Template descriptions must be understandable by non-technical hiring managers
- Evaluation criteria preview uses plain language, not prompt engineering jargon

---

## Edge Cases & Error Handling

### EC-1: Template Deleted or Deprecated

If a template is deprecated, existing postings continue using the locked version. New postings cannot select the deprecated template. UI shows a notice on affected postings suggesting migration to a replacement template.

### EC-2: Custom Prompt Conflicts with Template

If the custom prompt contradicts the template (e.g., template says "prioritize certifications" but custom prompt says "ignore certifications"), the custom prompt takes precedence for the conflicting dimension. A warning is shown to the employer about the override.

### EC-3: No Template Selected

If no template is explicitly selected, the General template is used. This is the same behavior as pre-Feature 29.

### EC-4: Template with Custom Prompt Exceeds Prompt Length

If the combined template + custom prompt exceeds the maximum prompt length, the system truncates the custom prompt portion and notifies the employer.

### EC-5: Multiple Postings, Different Templates

Each posting independently tracks its template selection. Changing one posting's template does not affect others.

### EC-6: Template Applied to Existing Matches

Changing a posting's template does not retroactively re-evaluate existing matches. Only new evaluations use the updated template. A notice informs the employer of this behavior.

---

## Success Metrics

- At least 30% of new postings use a non-General template within 60 days of launch
- Match acceptance rate is 10% higher for postings using industry templates vs. General
- Employer satisfaction score for match quality improves for template users

---

## Feature Flag

This feature shall be gated behind an `INDUSTRY_TEMPLATES` feature flag. When disabled, only the General template is available and the template selector is hidden.
