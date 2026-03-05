# Feature Specification: 3-job-seeker-profile

**Feature ID:** 3-job-seeker-profile
**PRD Sections:** §6.2 Job Seeker Profile, §8.1 Job Seeker Flow
**Roadmap Phase:** Phase 1 — MVP
**Priority:** P0
**Status:** Draft
**Created:** 2026-02-24
**Feature Flag:** `SEEKER_PROFILE` (controls public availability; profile creation UI behind flag)

---

## Overview

Job seekers need a structured profile to participate in the JobBobber matching system.
This feature delivers the complete profile creation and management experience: a guided
multi-step form covering basic info, work experience, education, skills, portfolio URLs,
and location preferences, combined with a resume upload that auto-populates structured
fields via AI extraction.

A **profile completeness score** guides job seekers toward a fully populated profile,
which is required before their AI agent can be activated for matching.

Private negotiation settings (minimum salary, deal-breakers, priorities) are part of the
data model but remain hidden behind the `PRIVATE_PARAMS` Beta feature flag. The schema
is established in this feature; the UI for private settings ships in Feature 8.

---

## User Stories

### User Story 1: Create Initial Profile

**As a** newly registered job seeker
**I want** to fill out a guided multi-step profile form covering my background, skills, and preferences
**So that** my AI agent has the information it needs to represent me to potential employers

**Acceptance Criteria:**

- [ ] Profile form is accessible immediately after completing role selection and BYOK setup
- [ ] Form is divided into logical sections: Basic Info, Experience, Education, Skills, URLs, Location
- [ ] Each section can be saved independently (partial saves supported)
- [ ] Job seeker cannot activate their agent until profile completeness reaches a minimum threshold
- [ ] Required fields are clearly marked; form prevents submission without them

**Priority:** High

---

### User Story 2: Upload Resume for AI-Assisted Field Extraction

**As a** job seeker setting up my profile
**I want** to upload my resume and have the platform automatically extract my structured data
**So that** I do not have to manually re-enter information already in my resume

**Acceptance Criteria:**

- [ ] Job seeker can upload a resume in PDF or DOCX format
- [ ] Maximum file size enforced (10 MB)
- [ ] Uploaded file stored in cloud storage; job seeker can retrieve or replace it at any time
- [ ] After upload, AI extraction populates structured fields: experience entries, education, skills, and headline
- [ ] Extracted fields are presented for review before saving — job seeker can edit any extracted value
- [ ] AI extraction uses the job seeker's own BYOK API key; no extraction occurs if no key is stored
- [ ] If extraction fails or no BYOK key is available, the job seeker is informed and must fill fields manually
- [ ] Re-uploading a new resume offers to overwrite or merge with existing structured data

**Priority:** High

---

### User Story 3: View and Edit Profile Completeness Score

**As a** job seeker with a partially completed profile
**I want** to see a completeness score and understand which sections are incomplete
**So that** I know what to fill in to unlock agent activation

**Acceptance Criteria:**

- [ ] Profile completeness score (0–100%) displayed prominently on the profile page
- [ ] Score updates in real time as sections are completed
- [ ] Each incomplete required section is listed with a direct link to complete it
- [ ] Minimum threshold (e.g., 70%) required before agent activation is available
- [ ] Score algorithm weights required fields more heavily than optional fields

**Priority:** High

---

### User Story 4: Add and Update Work Experience

**As a** job seeker
**I want** to add, edit, and remove work experience entries
**So that** my profile accurately reflects my career history

**Acceptance Criteria:**

- [ ] Each experience entry includes: job title, company name, start date, end date (or "present"), description
- [ ] Multiple experience entries supported; displayed in reverse chronological order
- [ ] Job seeker can add a new entry, edit an existing entry, and delete an entry
- [ ] Dates validated: end date must be after start date (or "present")
- [ ] Description field supports plain text; maximum 2,000 characters per entry

**Priority:** High

---

### User Story 5: Manage Skills

**As a** job seeker
**I want** to add and remove skills from my profile using an autocomplete input
**So that** my skills are standardised and discoverable by the matching system

**Acceptance Criteria:**

- [ ] Skills input provides autocomplete suggestions as the job seeker types
- [ ] Job seeker can add free-text skills not in the suggestion list
- [ ] Skills displayed as removable tags
- [ ] Minimum 3 skills required for profile completeness threshold
- [ ] Maximum 50 skills allowed per profile

**Priority:** High

---

### User Story 6: Add Portfolio and Professional URLs

**As a** job seeker
**I want** to add links to my portfolio, GitHub, personal website, and other professional URLs
**So that** employers and the AI matching system have access to richer evidence of my work

**Acceptance Criteria:**

- [ ] Job seeker can add multiple URLs (portfolio, GitHub, LinkedIn, personal site, blog, etc.)
- [ ] Each URL validated as a well-formed URL before saving
- [ ] URLs displayed as labelled links; label is editable
- [ ] Maximum 10 URLs per profile
- [ ] URLs stored and returned in profile API responses

**Priority:** Medium

---

### User Story 7: Set Location and Relocation Preferences

**As a** job seeker
**I want** to specify my current location and whether I am open to relocation or remote work
**So that** the matching system can filter opportunities appropriately

**Acceptance Criteria:**

- [ ] Job seeker can enter a current city/region
- [ ] Relocation preference options: "Not open to relocation", "Open to relocation (domestic)", "Open to relocation (international)", "Fully remote only"
- [ ] Preferences saved and returned in profile API responses
- [ ] Location field is optional but improves match quality (documented in UI)

**Priority:** Medium

---

### User Story 8: Update Profile After Initial Creation

**As a** job seeker with an existing profile
**I want** to return to my profile and update any section at any time
**So that** my profile stays current as my career progresses

**Acceptance Criteria:**

- [ ] All profile sections editable after initial creation
- [ ] Changes saved immediately (per-section or per-field auto-save, or explicit save button)
- [ ] Updated profile reflected in completeness score immediately
- [ ] Profile update triggers recalculation of completeness score
- [ ] Job seeker can deactivate their profile (sets `isActive = false`); deactivated profiles are excluded from matching

**Priority:** High

---

## Functional Requirements

### FR-1: Profile Data Model

The system stores a structured job seeker profile containing: name, headline, bio, resume URL,
parsed resume data, work experience entries (array), education entries (array), skills (array),
portfolio/professional URLs (array), location, relocation preference, and profile completeness score.

### FR-2: Resume Storage

Uploaded resume files (PDF, DOCX, max 10 MB) are stored in cloud file storage. The stored URL
is persisted on the profile. Old files are replaced when a new upload occurs.

### FR-3: AI-Assisted Resume Parsing

When a resume is uploaded and a BYOK key is available, the system sends the resume content to the
user's AI provider and requests structured extraction of: experience entries, education entries,
skills, and headline. The extraction result is presented to the user for review before saving.
All AI extraction output is validated against a typed schema before being stored.

### FR-4: Profile Completeness Score

The system calculates a completeness score (0–100%) from the presence and quality of profile fields.
Required fields (name, headline, at least one experience entry, at least 3 skills) are weighted
more heavily. The score is recalculated and persisted on every profile update.

### FR-5: Agent Activation Gate

Job seekers whose profile completeness score is below the activation threshold (70%) cannot activate
their AI agent. The UI clearly communicates what is needed to reach the threshold.

### FR-6: Private Settings Schema

The private settings record (minimum salary, salary flexibility rules, deal-breakers, priorities,
exclusions) is created alongside the profile but all UI for managing these settings is gated behind
the `PRIVATE_PARAMS` feature flag. The record exists for all job seekers; it is initially populated
with default/empty values.

### FR-7: Profile Access Control

A job seeker can only view and edit their own profile. No API endpoint exposes one job seeker's
profile data to another job seeker. Employer-facing profile views (used during matching) expose
only public fields; private settings are never returned.

### FR-8: Skill Autocomplete

The system provides skill suggestions as the user types. Suggestions are drawn from a curated list
of standardised skills. Free-text skills outside the list are accepted.

---

## Non-Functional Requirements

### Performance

- Profile page initial load: < 1 second (server-rendered where possible)
- Resume upload: progress indicator shown; upload completes within 10 seconds for a 10 MB file
- AI extraction result returned within 15 seconds; UI shows a loading state during extraction
- Profile save operations (per-section): < 300 ms response time (90th percentile)

### Security

- Resume files stored in private cloud storage; accessible only to the owning user via a signed URL
- No raw resume content stored in the database (only the parsed JSON and the storage URL)
- Private settings (salary, deal-breakers) never returned in any API response accessible to other users
- All profile update endpoints require authentication and ownership verification

### Reliability

- If AI extraction fails (provider error, timeout, malformed response), the system degrades gracefully:
  the resume is still stored, the user is informed of the extraction failure, and manual entry is required
- Partial profile saves do not leave the profile in an inconsistent state

### Usability

- Profile form is accessible on both desktop and mobile viewports
- All interactive elements meet WCAG 2.1 AA requirements (keyboard navigation, sufficient contrast, labels)
- Skill autocomplete accessible via keyboard

---

## Edge Cases & Error Handling

### Resume Upload

- **Unsupported file type** → Reject with clear error: "Only PDF and DOCX files are accepted"
- **File exceeds 10 MB** → Reject before upload: "File is too large. Maximum size is 10 MB"
- **Upload fails (network error)** → Show retry option; do not clear the previously selected file
- **Extraction times out** → Store the resume, show: "AI extraction timed out. Please fill in fields manually."
- **Extraction returns empty results** → Store resume, inform user, allow manual entry
- **No BYOK key configured** → Show: "Resume uploaded. AI field extraction requires an API key — [Configure API key]"
- **Re-upload with existing data** → Prompt: "Keep existing data, replace with extracted data, or merge?"

### Profile Saving

- **Validation failure (missing required field)** → Inline error message on the invalid field; form does not navigate away
- **Concurrent edits (multiple tabs)** → Last-write-wins; no explicit conflict resolution in MVP
- **Invalid URL format** → Inline error: "Please enter a valid URL (e.g. https://github.com/username)"
- **Date range invalid** → Inline error: "End date must be after start date"

### Completeness Score

- **All fields empty** → Score = 0; agent activation blocked
- **Score at exactly 70% threshold** → Agent activation enabled; threshold boundary is inclusive

### Access Control

- **Unauthenticated request** → 401 Unauthorized
- **Authenticated user accessing another user's profile via direct ID** → 403 Forbidden
- **Employer attempting to access job seeker private settings** → 403 Forbidden

---

## Out of Scope (This Feature)

- Private settings UI (ships in Feature 8: private-negotiation-parameters)
- Custom agent prompt UI (ships in Feature 15: custom-agent-prompting)
- Profile embedding generation for vector search (ships in Feature 11: vector-search)
- Agent activation and conversation initiation (ships in Feature 5: basic-ai-matching)
- Education or experience verification
- Profile visibility controls (all profiles visible to all employers in MVP)

---

## Success Metrics

- 60%+ of registered job seekers complete a profile reaching the 70% completeness threshold
- Resume AI extraction success rate ≥ 85% (when BYOK key is present)
- Profile creation time-to-complete (first 70% threshold) ≤ 10 minutes
- Zero incidents of private settings data exposed in public API responses

---

## Constitutional Compliance

- [x] **Type Safety (I):** All profile fields flow through typed schemas; AI extraction output validated with Zod
- [x] **TDD (II):** Tests written first; 80%+ coverage required
- [x] **BYOK (III):** AI extraction uses user-provided key only; graceful fallback when no key
- [x] **Minimal Abstractions (IV):** Direct AI SDK calls for extraction; no additional frameworks
- [x] **Security & Privacy (V):** Private settings in separate data model; never in public API responses
- [x] **Feature Flags (VI):** `SEEKER_PROFILE` gates public profile creation UI; `PRIVATE_PARAMS` gates private settings UI
- [x] **Agent Autonomy (VII):** Profile completeness gates agent activation; profile data feeds agent context
