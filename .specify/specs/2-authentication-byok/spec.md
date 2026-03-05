# Feature Specification: Authentication & BYOK API Key Setup

**Feature Branch**: `2-authentication-byok`
**Created**: 2026-02-23
**Status**: Draft
**PRD Reference**: §6.1 Authentication & User Management, §Constitution III (BYOK)

---

## Overview

JobBobber requires every user to have an authenticated identity and a valid LLM API key before they can access any AI-powered functionality. This feature covers two tightly coupled concerns:

1. **Role-based authentication** — Users sign up as either a Job Seeker or an Employer. Their role determines what they can see, do, and which agent operates on their behalf. Role selection happens at sign-up and cannot be changed later.

2. **Bring Your Own Key (BYOK) setup** — After authenticating, users provide their own OpenAI or Anthropic API key. The platform validates the key against the provider, stores it encrypted, and uses it exclusively for all AI operations on the user's behalf. JobBobber never pays for AI usage.

These two concerns are sequential: authentication must succeed before BYOK setup is possible, and no AI features are accessible until both are complete.

**Onboarding flow (resolved):**

```
Clerk sign-up → /onboarding/role → write role to Clerk metadata
  [if Employer: also collect company name, create Clerk Org]
  → /setup/api-key → hard gate enforced until BYOK key set
  → role-specific dashboard
```

All three steps are mandatory. Any authenticated user without a role or without a BYOK key is redirected to the appropriate setup step before reaching the dashboard.

---

## User Scenarios & Testing

### User Story 1 — Job Seeker Registration & Role Assignment (Priority: P1)

A person looking for work signs up for JobBobber via Clerk, is redirected to `/onboarding/role` to select "Job Seeker," and their role is written back to Clerk user metadata. They cannot access the dashboard until role assignment is complete.

**Why this priority**: Role assignment is the gateway to the entire platform. Without it, no subsequent feature (profile creation, matching, dashboards) can function correctly.

**Independent Test**: Can be fully tested by creating a new user account via Clerk sign-up, selecting "Job Seeker" on the `/onboarding/role` page, and verifying the user lands on the job seeker dashboard with access only to job seeker routes.

**Acceptance Scenarios**:

1. **Given** a new user who just completed Clerk sign-up, **When** they land on `/onboarding/role` and select "Job Seeker," **Then** their role is written to Clerk metadata as `JOB_SEEKER` and they are redirected to the job seeker dashboard
2. **Given** a new user who completed Clerk sign-up but has not yet selected a role, **When** they attempt to navigate directly to any dashboard route, **Then** they are redirected back to `/onboarding/role`
3. **Given** an authenticated job seeker, **When** they attempt to access an employer-only route, **Then** they receive a `FORBIDDEN` error and are redirected to their dashboard
4. **Given** a returning job seeker, **When** they sign in again after a session expiry, **Then** their role is restored from Clerk metadata and they are returned to the job seeker dashboard
5. **Given** an unauthenticated user, **When** they attempt to access any protected route, **Then** they are redirected to the Clerk sign-in page

---

### User Story 2 — Employer Registration & Role Assignment (Priority: P1)

A hiring manager or recruiter signs up for JobBobber via Clerk, is redirected to `/onboarding/role`, selects "Employer," and provides their company name. A Clerk Organization is created immediately using the provided name and linked to their account. They cannot access the employer dashboard until this step is complete.

**Why this priority**: Same criticality as job seeker registration — the employer role unlocks job posting creation, which is a prerequisite for matching.

**Independent Test**: Can be fully tested by completing employer sign-up, entering a company name on `/onboarding/role`, and verifying the user lands on the employer dashboard with a linked Clerk Organization, while confirming that job seeker routes are inaccessible.

**Acceptance Scenarios**:

1. **Given** a new user on `/onboarding/role` who selects "Employer" and enters a company name, **When** they submit the form, **Then** their role is written to Clerk metadata as `EMPLOYER`, a Clerk Organization is created with the provided company name, and they are redirected to the employer dashboard
2. **Given** an employer completing onboarding, **When** they submit an empty company name, **Then** the form shows a validation error and does not proceed
3. **Given** an authenticated employer, **When** they attempt to access a job seeker-only route, **Then** they receive a `FORBIDDEN` error and are redirected to the employer dashboard
4. **Given** a returning employer, **When** they sign in, **Then** they are returned to the employer dashboard with their Clerk Organization context restored
5. **Given** an employer who skips the `/onboarding/role` step and navigates directly to a dashboard route, **When** they attempt to access it, **Then** they are redirected back to `/onboarding/role`

---

### User Story 3 — BYOK API Key Submission & Validation (Priority: P1)

After authenticating, a user provides their own OpenAI or Anthropic API key. The system validates the key by making a minimal live call to the provider, gives feedback on whether the key is valid, and stores it securely if accepted. Users see an estimated cost range to set expectations.

**Why this priority**: No AI feature on the platform works without a valid BYOK key. This is the critical setup step that unlocks all AI functionality.

**Independent Test**: Can be fully tested by providing a key through the BYOK setup UI and verifying the system correctly accepts a valid key and rejects an invalid one, without any matching or profile functionality needing to exist.

**Acceptance Scenarios**:

1. **Given** an authenticated user without a BYOK key, **When** they submit a valid OpenAI API key, **Then** the system validates it against OpenAI, stores it encrypted, and confirms success with a visual indicator
2. **Given** an authenticated user, **When** they submit an invalid or revoked API key, **Then** the system rejects it with a clear error message explaining the key is not valid, and nothing is stored
3. **Given** an authenticated user, **When** they submit a valid Anthropic API key, **Then** the system validates it against Anthropic, stores it encrypted, and confirms success
4. **Given** a user on the BYOK setup screen, **When** the page loads, **Then** they see an estimated monthly cost range (e.g., "$2–$8/month for typical usage") to set expectations before entering their key
5. **Given** a user who has already set up a BYOK key, **When** they navigate to the API key settings page, **Then** they see a masked indicator (e.g., `sk-...xxxx`) that a key is set, but never the full key value

---

### User Story 4 — BYOK API Key Rotation & Deletion (Priority: P2)

A user wants to replace their API key (e.g., they rotated it on the provider side) or delete it entirely (e.g., they are pausing their account). The system supports both operations safely.

**Why this priority**: Important for key lifecycle management and user trust, but not required for the core flow. A user without key rotation still gets full value from the platform.

**Independent Test**: Can be tested by first completing BYOK setup, then using the key management UI to rotate to a new valid key or delete the existing key, and verifying the stored state changes correctly.

**Acceptance Scenarios**:

1. **Given** a user with an existing BYOK key, **When** they submit a new valid key via "Replace Key," **Then** the old key is overwritten with the new encrypted value and the user sees a success confirmation
2. **Given** a user with an existing BYOK key, **When** they click "Delete Key," **Then** the key is removed from storage, all AI features become inaccessible, and they are prompted to set up a new key to re-enable AI features
3. **Given** a user who deletes their key, **When** they attempt to trigger any AI operation, **Then** the system returns a clear error prompting them to re-enter a BYOK key before continuing
4. **Given** a user submitting a replacement key, **When** the new key fails validation, **Then** the old key is preserved and the user is notified the replacement failed

---

### User Story 5 — Security: Key Never Exposed (Priority: P1)

A user's API key, once submitted, must never appear in any API response, log entry, client-side state, or error message. The key is treated as a write-only secret after initial submission.

**Why this priority**: A leaked API key would expose the user to financial liability on their provider account and destroy platform trust. This is a constitutional requirement (Principle III, V).

**Independent Test**: Can be tested by examining tRPC API responses, server logs, and client-side network traffic after key submission to confirm the raw key never appears.

**Acceptance Scenarios**:

1. **Given** a stored BYOK key, **When** any tRPC procedure returns user data, **Then** the full API key value is never included in the response payload
2. **Given** a key submission or rotation event, **When** server logs are examined, **Then** no full or partial key value appears in any log entry
3. **Given** a key validation failure, **When** the error response is returned to the client, **Then** the error message contains no key material
4. **Given** client-side state inspection (React DevTools, localStorage, sessionStorage), **When** a user has a BYOK key configured, **Then** the raw key value does not appear anywhere in client-accessible state

---

## Edge Cases

- **Concurrent key rotation**: What happens if two browser sessions attempt to update the key simultaneously? Last write wins is acceptable; no partial state should be possible.
- **Provider API timeout during validation**: If the provider (OpenAI/Anthropic) takes >10 seconds to respond during key validation, the system must time out gracefully and prompt the user to retry, without storing the key.
- **Provider API rate limit hit during validation**: The validation call itself could be rate-limited. The system must handle 429 responses from providers gracefully and inform the user.
- **User deletes account mid-BYOK-setup**: If account deletion is triggered while a key validation call is in-flight, the key must not be stored.
- **User with no BYOK key attempts matching**: Any tRPC procedure requiring a BYOK key must fail with a clear `PRECONDITION_FAILED` error (or equivalent) directing the user to complete BYOK setup.
- **Key that was valid at submission becomes invalid later** (e.g., user revokes it on the provider side): The system cannot detect this until the key is used. Agent calls will fail; the system must surface a clear "API key invalid" error and prompt the user to update their key.
- **Role selection after social sign-in**: If a user signs in via a social provider (e.g., Google) without having completed role selection, the system must prompt them to select a role before granting access.

---

## Requirements

### Functional Requirements

- **FR-001**: Users MUST be able to register as either a Job Seeker or an Employer via the sign-up flow; role is selected during registration and cannot be changed after completion.
- **FR-002**: Users MUST be able to sign in using Clerk-supported methods (email/password, social providers as configured in Clerk dashboard).
- **FR-003**: The user's role (`JOB_SEEKER` or `EMPLOYER`) MUST be persisted in Clerk user metadata and enforced by the authorization layer on every protected API call.
- **FR-004**: After completing role selection, users MUST complete BYOK key setup before accessing the dashboard. Any authenticated user with a role but no BYOK key is hard-redirected to `/setup/api-key`; the dashboard and all app routes are inaccessible until a valid key is stored.
- **FR-005**: Users MUST be able to submit an OpenAI API key OR an Anthropic API key as their BYOK key.
- **FR-006**: The system MUST validate a submitted API key against the provider via a live, minimal API call before storing it.
- **FR-007**: If key validation succeeds, the key MUST be encrypted at rest using AES-256-GCM with a user-scoped key derivation (one IV per user).
- **FR-008**: The plaintext API key MUST never be returned in any API response, stored in any log, or accessible in any client-side state after initial submission.
- **FR-009**: Users MUST be able to view a masked indicator of their current key (showing only the last 4 characters or a generic presence indicator) from their account settings.
- **FR-010**: Users MUST be able to rotate their API key by submitting a new one; the new key is validated before the old key is replaced.
- **FR-011**: Users MUST be able to delete their API key; deletion removes the encrypted value and disables all AI features until a new key is provided.
- **FR-012**: Job seeker routes MUST be inaccessible to employer-authenticated users, and employer routes MUST be inaccessible to job seeker-authenticated users.
- **FR-013**: Unauthenticated users MUST be redirected to the sign-in page when attempting to access any protected route.
- **FR-014**: During BYOK setup, the UI MUST display an estimated monthly cost range for typical platform usage before the user submits their key.
- **FR-015**: Employer accounts MUST be associated with a Clerk Organization at registration. The organization is created during the `/onboarding/role` step using the company name provided by the user; the `clerkOrgId` is stored in the `Employer` database record immediately upon creation.
- **FR-016**: The `/onboarding/role` and `/setup/api-key` pages MUST be accessible to authenticated users who have not yet completed those steps, but MUST redirect away any user who has already completed them (no re-onboarding loop).
- **FR-017**: Next.js middleware MUST enforce the two sequential gates: (1) authenticated + no role → redirect to `/onboarding/role`; (2) authenticated + role + no BYOK key → redirect to `/setup/api-key`; (3) authenticated + role + BYOK key → allow through to dashboard.

### Key Entities

- **User Role**: A classification (`JOB_SEEKER` or `EMPLOYER`) assigned at registration, stored in Clerk metadata and mirrored in the database, used to determine access rights throughout the platform.
- **BYOK API Key**: A user-provided LLM provider API key (OpenAI or Anthropic format). Only the encrypted form is stored. Associated with a single user; one active key per user at a time.
- **Key Validation Result**: A transient result (not stored) indicating whether a submitted key passed live validation against its provider. Contains success/failure status and, on failure, a reason code.

---

## Non-Functional Requirements

- **Security**: Key material must be encrypted using AES-256-GCM before writing to the database. The encryption module from Feature 1 (`src/lib/encryption.ts`) is used directly. Key validation calls must use HTTPS only.
- **Privacy**: The user's provider (OpenAI vs Anthropic) selection is stored but is NOT considered sensitive — it may be visible in account settings. The key itself is always treated as a secret.
- **Performance**: Key validation against the external provider must complete within 10 seconds; the UI must show a loading state during this call.
- **Reliability**: Key validation failures (provider timeout, network error) must not result in a partially saved state. The stored key must be either fully valid or absent.
- **Accessibility**: The sign-up, sign-in, and BYOK setup flows must be accessible (WCAG 2.1 AA) — keyboard navigable, screen reader compatible, sufficient color contrast.
- **Usability**: Error messages from key validation must be user-friendly, explaining what went wrong in plain language (e.g., "This API key was not recognized by OpenAI. Please check the key and try again.") rather than surfacing raw provider error codes.

---

## Success Criteria

### Measurable Outcomes

- **SC-001**: A new user can complete the full sign-up + role selection + BYOK key setup flow in under 3 minutes on first use.
- **SC-002**: 100% of tRPC procedures enforcing role-based access reject unauthorized roles in automated tests (zero regressions permitted).
- **SC-003**: The raw API key value never appears in any test-observable API response, log snapshot, or client state snapshot (verified by automated security tests).
- **SC-004**: Key validation correctly accepts all valid OpenAI and Anthropic key formats and rejects all invalid/expired keys in unit tests using mocked provider responses.
- **SC-005**: Key rotation preserves continuity — no AI feature is interrupted between valid key submissions; the old key is not accessible after rotation.
- **SC-006**: 80%+ unit and integration test coverage across all authentication and key management code paths.

---

## Out of Scope

The following are explicitly NOT part of this feature:

- Multi-factor authentication (MFA) — deferred to Feature 18 (compliance-security)
- Multi-member employer team invitations — deferred to Feature 13 (multi-member-employer-accounts)
- Key usage tracking and cost reporting — deferred to a later feature
- Support for provider API keys other than OpenAI and Anthropic
- Password reset or account recovery flows (handled entirely by Clerk)
- Changing a user's role after registration
