# Feature Specification: 4-employer-profile-job-posting

**Feature ID:** 4-employer-profile-job-posting
**PRD Sections:** §6.3 Employer Profile, §8.2 Employer Flow
**Roadmap Phase:** Phase 1 — MVP
**Priority:** P0
**Status:** Draft
**Created:** 2026-03-05
**Feature Flag:** `EMPLOYER_PROFILE` (controls public availability; employer profile and job posting UI behind flag)

---

## Overview

Employers need a company profile and at least one job posting to participate in the JobBobber matching system. This feature delivers the employer-side profile and job posting management experience: a company profile form covering company identity, culture, and benefits, plus a job posting creation and lifecycle management interface.

Job postings follow a status lifecycle (draft → active → paused → closed → filled) with enforced transitions. For MVP, each employer can create multiple job postings, but multi-member team management (roles, invitations) ships in Feature 13.

Private hiring parameters (true max salary, training willingness, urgency) are part of the data model but remain hidden behind the `PRIVATE_PARAMS` Beta feature flag. The `JobSettings` schema is established in this feature; the UI for private settings ships in Feature 8.

---

## User Stories

### User Story 1: Create Company Profile

**As a** newly registered employer
**I want** to fill out a company profile with my organization's information
**So that** job seekers and the AI matching system understand who we are

**Acceptance Criteria:**

- [ ] Company profile form is accessible immediately after completing role selection and BYOK setup
- [ ] Form includes: company name, description, industry, company size, culture summary, headquarters, office locations, website URL, additional URLs, benefits, and logo
- [ ] Company name is required; all other fields are optional but improve match quality
- [ ] Profile can be saved at any time (partial saves supported)
- [ ] Profile displayed on a dedicated employer profile page

**Priority:** High

---

### User Story 2: Create a Job Posting

**As an** employer with a company profile
**I want** to create a detailed job posting
**So that** the AI matching system can evaluate candidates against my requirements

**Acceptance Criteria:**

- [ ] Employer can create a new job posting from their dashboard
- [ ] Posting includes: title, department, description, responsibilities, required skills, preferred skills, experience level, employment type, location type, geographic requirements, salary range, role-specific benefits, and "why apply" narrative
- [ ] Title and description are required; other fields are optional
- [ ] Required skills use the same autocomplete input as job seeker skills
- [ ] New postings default to "draft" status and are not visible to the matching system
- [ ] Employer can create multiple job postings

**Priority:** High

---

### User Story 3: Manage Job Posting Status

**As an** employer with active job postings
**I want** to change the status of a posting (activate, pause, close, mark as filled)
**So that** I can control which postings are actively being matched

**Acceptance Criteria:**

- [ ] Status transitions follow the defined lifecycle: draft → active → paused → closed → filled
- [ ] Only "active" postings are eligible for AI matching
- [ ] Paused postings can be reactivated (paused → active)
- [ ] Closed and filled postings cannot be reactivated
- [ ] Status change is reflected immediately in the employer dashboard
- [ ] Activating a posting requires at least: title, description, and one required skill

**Priority:** High

---

### User Story 4: Edit an Existing Job Posting

**As an** employer
**I want** to edit the details of an existing job posting
**So that** I can refine requirements or update compensation as needs change

**Acceptance Criteria:**

- [ ] All posting fields editable regardless of current status
- [ ] Editing a draft posting does not change its status
- [ ] Editing an active posting keeps it active (changes reflected immediately)
- [ ] Salary range, skills, and description updates recalculate match relevance on next agent run
- [ ] Edit history is not tracked in MVP (last-write-wins)

**Priority:** High

---

### User Story 5: View Job Posting List

**As an** employer
**I want** to see all my job postings with their current status
**So that** I can manage my hiring pipeline at a glance

**Acceptance Criteria:**

- [ ] Employer dashboard shows a list of all job postings
- [ ] Each posting displays: title, status, creation date, and a count of matches (0 in MVP until Feature 5)
- [ ] Postings can be filtered by status (all, draft, active, paused, closed, filled)
- [ ] Postings sorted by most recently updated
- [ ] Empty state shown when no postings exist with a call-to-action to create one

**Priority:** High

---

### User Story 6: Update Company Profile

**As an** employer with an existing company profile
**I want** to update my company information at any time
**So that** our profile stays current as the company evolves

**Acceptance Criteria:**

- [ ] All company profile fields editable after initial creation
- [ ] Changes saved via explicit save button
- [ ] Updated company profile reflected in all future matching evaluations
- [ ] Logo can be uploaded, replaced, or removed

**Priority:** Medium

---

### User Story 7: Delete a Job Posting

**As an** employer
**I want** to delete a draft job posting that I no longer need
**So that** my posting list stays clean

**Acceptance Criteria:**

- [ ] Only draft postings can be deleted
- [ ] Active, paused, closed, and filled postings cannot be deleted (must be closed first, then remain for record-keeping)
- [ ] Deletion requires confirmation
- [ ] Deleted postings are permanently removed (hard delete in MVP)

**Priority:** Low

---

## Functional Requirements

### FR-1: Company Profile Data Model

The system stores a structured employer profile containing: company name, description, industry, company size, culture summary, headquarters location, office locations (array), website URL, additional URLs (structured JSON), benefits (array), and logo URL.

### FR-2: Job Posting Data Model

Each job posting contains: title, department, description, responsibilities, required skills (array), preferred skills (array), experience level (enum), employment type (enum), location type (enum), geographic requirements, salary minimum, salary maximum, role-specific benefits (array), "why apply" narrative, and status (enum).

### FR-3: Job Posting Status Lifecycle

Postings follow a strict status machine:

- **Draft** → can transition to Active
- **Active** → can transition to Paused, Closed, or Filled
- **Paused** → can transition to Active, Closed, or Filled
- **Closed** → terminal state (no further transitions)
- **Filled** → terminal state (no further transitions)

Invalid transitions are rejected with a clear error.

### FR-4: Activation Requirements

A posting cannot transition from Draft to Active unless minimum required fields are present: title, description, and at least one required skill.

### FR-5: Private Job Settings Schema

The private settings record (`JobSettings`: true max salary, minimum qualification override, willing-to-train list, urgency, priority attributes, custom prompt) is created alongside each job posting but all UI for managing these settings is gated behind the `PRIVATE_PARAMS` feature flag. The record exists for every posting with default/empty values.

### FR-6: Profile and Posting Access Control

- An employer can only view and edit their own company profile and job postings
- No API endpoint exposes one employer's profile data to another employer
- Job seeker-facing views of postings (used during matching) expose only public fields
- Private job settings (`JobSettings`) are never returned in any public API response
- BYOK key fields on the Employer model are never returned in any API response

### FR-7: Logo Storage

Uploaded logo images are stored in cloud file storage. Accepted formats: PNG, JPEG, WebP. Maximum file size: 2 MB. The stored URL is persisted on the employer profile.

### FR-8: Skill Autocomplete for Job Postings

Required and preferred skills inputs use the same curated skill list as job seeker profiles. Free-text skills outside the list are accepted.

---

## Non-Functional Requirements

### Performance

- Company profile page initial load: < 1 second
- Job posting list load (up to 50 postings): < 500 ms
- Job posting create/update: < 300 ms response time (90th percentile)
- Logo upload: progress indicator shown; completes within 5 seconds for a 2 MB file

### Security

- Logo files stored in cloud storage; accessible via public URL (company logos are public by design)
- Private job settings never returned in any API response accessible to other users or job seekers
- BYOK key fields on Employer never returned in any API response
- All employer endpoints require authentication and organization membership verification
- Status transitions validated server-side (cannot be bypassed by client manipulation)

### Reliability

- If logo upload fails, the profile is still saved without the logo; user is informed and can retry
- Invalid status transitions do not corrupt posting state
- Partial profile saves do not leave the employer in an inconsistent state

### Usability

- Profile and posting forms are accessible on both desktop and mobile viewports
- All interactive elements meet WCAG 2.1 AA requirements
- Skills autocomplete accessible via keyboard
- Status transitions use clear visual indicators (color-coded badges)

---

## Edge Cases & Error Handling

### Company Profile

- **Missing company name** → Inline validation error; form cannot be saved without a name
- **Logo upload fails (network error)** → Show retry option; keep existing logo if replacing
- **Logo wrong format or too large** → Reject before upload: "Accepted formats: PNG, JPEG, WebP. Max 2 MB"
- **Duplicate company name** → Allowed (companies may share names); employer identified by organization ID, not name

### Job Posting

- **Missing required fields on activation** → Block transition with: "Title, description, and at least one required skill are needed to activate this posting"
- **Invalid status transition** → Reject with: "Cannot transition from [current] to [requested]"
- **Salary max less than salary min** → Inline error: "Maximum salary must be greater than or equal to minimum"
- **Concurrent edits (multiple tabs)** → Last-write-wins; no explicit conflict resolution in MVP
- **Deleting an active posting** → Blocked: "Only draft postings can be deleted. Close this posting first"

### Access Control

- **Unauthenticated request** → 401 Unauthorized
- **Authenticated user not a member of the employer organization** → 403 Forbidden
- **Non-employer user accessing employer endpoints** → 403 Forbidden
- **Job seeker attempting to access private job settings** → 403 Forbidden

---

## Out of Scope (This Feature)

- Multi-member team management with roles and invitations (ships in Feature 13)
- Private job settings UI (ships in Feature 8: private-negotiation-parameters)
- Custom agent prompt UI (ships in Feature 15: custom-agent-prompting)
- Job posting embedding generation for vector search (ships in Feature 11: vector-search)
- Agent activation and matching triggered by posting activation (ships in Feature 5: basic-ai-matching)
- Application tracking system (ATS) integration
- Job posting duplication / cloning
- Bulk posting operations (ships in Feature 17)

---

## Success Metrics

- 70%+ of registered employers complete a company profile
- 80%+ of employers with a profile create at least one job posting
- Job posting creation time-to-activate ≤ 8 minutes
- Zero incidents of private job settings data exposed in public API responses
- Zero incidents of BYOK key material exposed in API responses

---

## Constitutional Compliance

- [x] **Type Safety (I):** All employer and posting fields flow through typed schemas; enums enforced at DB and API layers
- [x] **TDD (II):** Tests written first; 80%+ coverage required
- [x] **BYOK (III):** Employer-level BYOK key already established in Feature 2; posting-level override exists in schema but is gated
- [x] **Minimal Abstractions (IV):** Direct Prisma queries; no additional ORM wrappers
- [x] **Security & Privacy (V):** Private job settings in separate model; never in public API responses; BYOK keys never exposed
- [x] **Feature Flags (VI):** `EMPLOYER_PROFILE` gates employer profile/posting UI; `PRIVATE_PARAMS` gates private settings UI
- [x] **Agent Autonomy (VII):** Posting activation is the trigger for future agent evaluation (Feature 5)
