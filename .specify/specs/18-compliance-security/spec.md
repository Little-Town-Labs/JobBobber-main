# Feature 18: Compliance & Security

## Overview

Regulatory compliance and security hardening for JobBobber. This feature ensures the platform meets GDPR, CCPA, and EEOC requirements while hardening the application against abuse and preparing for SOC 2 audit readiness. Users gain self-service data portability and deletion, the platform gains comprehensive audit trails for sensitive operations, and all public-facing endpoints receive rate limiting protection.

**Business Value:** Legal compliance is a prerequisite for operating in the EU (GDPR) and California (CCPA). Rate limiting and abuse detection protect platform stability. Bias audit documentation demonstrates responsible AI practices. SOC 2 readiness enables enterprise sales.

---

## User Stories

### User Story 1: Full Data Export (GDPR Article 20)

**As a** job seeker or employer
**I want** to export all my personal data in a portable format
**So that** I can exercise my right to data portability under GDPR

**Acceptance Criteria:**

- [ ] User can request a full data export from their account settings
- [ ] Export includes all personal data: profile, settings, matches, conversation logs, feedback insights
- [ ] Export delivered as a downloadable JSON file within 30 seconds for typical accounts
- [ ] Private settings (salary, deal-breakers) are included in the user's own export
- [ ] API keys are excluded from the export (security-sensitive, not personal data)
- [ ] Export request is logged in the audit trail

**Priority:** High

---

### User Story 2: Account & Data Deletion (GDPR Article 17 / CCPA)

**As a** job seeker or employer
**I want** to permanently delete all my data from the platform
**So that** I can exercise my right to erasure

**Acceptance Criteria:**

- [ ] User can initiate account deletion from their account settings
- [ ] Deletion requires explicit confirmation (two-step process)
- [ ] All personal data is permanently removed: profile, settings, matches, conversations, feedback insights, encrypted keys
- [ ] Deletion cascades to all related records (job postings for employers, matches for both sides)
- [ ] Deletion is logged before execution (audit record preserved without personal data)
- [ ] User is informed that deletion is irreversible and includes a grace period (72 hours) during which they can cancel
- [ ] After grace period, background process executes permanent deletion
- [ ] External auth provider account (Clerk) is deleted as part of the cascade

**Priority:** High

---

### User Story 3: Comprehensive Audit Logging

**As a** platform administrator
**I want** all sensitive operations to be recorded in an audit log
**So that** I can investigate security incidents and demonstrate compliance

**Acceptance Criteria:**

- [ ] Audit log captures: profile access by other users' agents, API key rotation, match decisions, data export requests, data deletion requests, settings changes, subscription changes
- [ ] Each audit entry records: actor, action, target, timestamp, IP address (hashed), result (success/failure)
- [ ] Audit logs are append-only (cannot be modified or deleted through the application)
- [ ] Audit logs are retained for a minimum of 2 years
- [ ] Admin users can query audit logs with filters (action type, date range, actor)

**Priority:** High

---

### User Story 4: API Rate Limiting & Abuse Detection

**As a** platform operator
**I want** all public-facing endpoints to be rate limited
**So that** the platform is protected from abuse, scraping, and denial-of-service attacks

**Acceptance Criteria:**

- [ ] Rate limits applied to all tRPC endpoints (per user, per IP for unauthenticated)
- [ ] Tiered rate limits: authenticated users get higher limits than unauthenticated
- [ ] Rate limit headers returned in responses (X-RateLimit-Limit, X-RateLimit-Remaining, X-RateLimit-Reset)
- [ ] Exceeded rate limits return 429 status with retry-after information
- [ ] Webhook endpoints have separate, more generous rate limits
- [ ] Rate limit violations logged in audit trail
- [ ] Configurable limits per endpoint category (auth, read, write, agent operations)

**Priority:** High

---

### User Story 5: Two-Factor Authentication Encouragement

**As a** user handling sensitive career and financial data
**I want** the platform to encourage and support multi-factor authentication
**So that** my account is protected against unauthorized access

**Acceptance Criteria:**

- [ ] MFA setup prompt displayed on first login and periodically thereafter
- [ ] MFA status visible in account settings (enabled/disabled)
- [ ] Users who have not enabled MFA see a persistent but dismissible banner
- [ ] MFA enforcement is configurable per user role (e.g., mandatory for admins)
- [ ] MFA configuration delegated to the authentication provider (Clerk)

**Priority:** Medium

---

### User Story 6: AI Matching Bias Audit

**As a** platform operator
**I want** a documented bias audit framework for the AI matching system
**So that** we can demonstrate EEOC compliance and responsible AI practices

**Acceptance Criteria:**

- [ ] Bias audit checklist documents all protected characteristics (race, gender, age, disability, religion, national origin)
- [ ] Agent evaluation prompts reviewed for discriminatory language or proxy variables
- [ ] Test suite includes bias detection scenarios (identical profiles differing only in protected characteristics should produce equivalent match scores)
- [ ] Audit results documented and stored in the repository
- [ ] Process for periodic re-audit defined (quarterly recommended)
- [ ] Findings and remediation actions tracked

**Priority:** Medium

---

### User Story 7: SOC 2 Readiness Documentation

**As a** platform operator pursuing enterprise customers
**I want** SOC 2 control mapping documentation
**So that** we are prepared for a formal SOC 2 Type II audit

**Acceptance Criteria:**

- [ ] Control mapping document covers: Security, Availability, Processing Integrity, Confidentiality, Privacy (Trust Services Criteria)
- [ ] Each control maps to specific JobBobber implementation (code paths, configurations, processes)
- [ ] Gaps identified with remediation plan and timeline
- [ ] Documentation stored in the repository for version-controlled auditability
- [ ] Access control matrix documented (who can access what data)

**Priority:** Low

---

## Functional Requirements

### FR-1: Self-Service Data Export

The system must allow authenticated users to request a complete export of their personal data. The export must include all profile information, settings (including private negotiation parameters), match history with summaries, conversation logs (with existing redaction applied), and feedback insights. The export must be delivered as a structured JSON file. Encrypted API keys must be excluded from the export.

### FR-2: Self-Service Data Deletion

The system must allow authenticated users to request permanent deletion of all their data. Deletion must cascade to all related entities. A 72-hour grace period must be provided before permanent execution. During the grace period, the user can cancel the deletion request. After the grace period, a background process must permanently remove all data and delete the user's external auth account.

### FR-3: Deletion Cascading Completeness

When a job seeker is deleted: profile, private settings, all matches (as seeker), all conversations (as seeker participant), feedback insights, extraction cache, subscription, and encrypted API keys must be removed. When an employer is deleted: company profile, all employer members, all invitations, all job postings (and their settings, conversations, matches), activity logs, feedback insights, subscription, and encrypted API keys must be removed.

### FR-4: Enhanced Audit Logging

The existing audit logging system must be extended to capture: data export requests, data deletion requests, API key rotation events, settings changes (excluding the actual values), subscription lifecycle events, match status changes by agents, and profile access events. Each entry must include a hashed IP address for security investigation without storing PII.

### FR-5: API Rate Limiting

All tRPC endpoints must enforce per-user rate limits. Unauthenticated endpoints must enforce per-IP rate limits. Limits must be configurable per endpoint category. Rate limit state must be stored in a fast, distributed store. Standard rate limit response headers must be returned.

### FR-6: MFA Encouragement Flow

The system must check the user's MFA enrollment status via the auth provider and display appropriate prompts. MFA setup must be handled entirely by the auth provider's UI. The system must support a "remind me later" dismissal with configurable re-prompt interval.

### FR-7: Bias Audit Framework

The system must include a documented bias audit checklist, a test suite with bias detection scenarios for the AI matching system, and a process for periodic re-auditing. The audit must cover all EEOC protected characteristics.

### FR-8: SOC 2 Control Mapping

The system must include a documented mapping of SOC 2 Trust Services Criteria to JobBobber's implementations, with identified gaps and remediation plans.

---

## Non-Functional Requirements

### NFR-1: Performance

- Data export for a typical account (< 1000 matches) must complete within 30 seconds
- Rate limit checks must add < 5ms latency per request
- Deletion grace period scheduling must not block the user's request (async)

### NFR-2: Security

- Audit logs must be append-only at the application level
- Hashed IP addresses must use a one-way hash (SHA-256 with application-level salt)
- Rate limit state must not leak user identity information
- Deletion confirmation must require re-authentication or explicit action (not just a single click)

### NFR-3: Reliability

- Data deletion must be atomic — either all related data is removed or none
- Failed deletion attempts must be retried automatically (background job with retry policy)
- Rate limiting must degrade gracefully if the state store is unavailable (fail open with logging)

### NFR-4: Compliance

- Data export format must be machine-readable (JSON) per GDPR Article 20
- Deletion must satisfy GDPR Article 17 "right to erasure" requirements
- Audit log retention must meet SOC 2 requirements (minimum 1 year, recommended 2 years)
- Bias audit documentation must address EEOC Title VII requirements

### NFR-5: Accessibility

- MFA prompts and deletion confirmation flows must be keyboard-navigable
- Rate limit error messages must be clear and actionable for end users

---

## Edge Cases & Error Handling

### Data Export

- **Large account with many matches/conversations:** Export must stream or paginate internally to avoid memory exhaustion; timeout extended for large exports
- **User exports while deletion is pending:** Export should still succeed during grace period (data still exists)
- **Concurrent export requests:** Only one export per user at a time; subsequent requests return existing pending export

### Data Deletion

- **Employer with active job postings:** All postings must be closed/archived before deletion cascades
- **User with pending matches:** Pending matches are cancelled as part of deletion
- **Deletion during active agent conversation:** Conversation must be terminated before deletion proceeds
- **User cancels deletion within grace period:** All data restored to normal state, deletion request marked cancelled
- **User attempts to log in during grace period:** Login succeeds, user sees deletion pending notice with cancel option
- **External auth deletion fails:** Retry with exponential backoff; if permanently failed, flag for manual review

### Rate Limiting

- **Rate limit store unavailable:** Fail open (allow request) with warning logged
- **User hits rate limit during critical flow (e.g., payment):** Higher limits for critical endpoints
- **IP-based limiting with shared IPs (NAT/VPN):** Use user identity when available, fall back to IP only for unauthenticated endpoints

### Audit Logging

- **Audit log write fails:** Fire-and-forget with error logged to application monitoring (never block user request)
- **High-volume audit events:** Batch writes if necessary to avoid database contention

### MFA

- **Auth provider MFA API unavailable:** Degrade gracefully — hide MFA prompt, do not block access
- **User dismisses MFA prompt:** Respect dismissal, re-prompt after configurable interval (default: 7 days)

### Bias Audit

- **Agent model changes:** Bias audit must be re-run when agent prompts or evaluation logic changes
- **New protected characteristics identified:** Audit checklist must be extensible

---

## Success Metrics

- **Data Export:** 95% of export requests complete within 30 seconds
- **Data Deletion:** 100% of deletion requests fully executed within 72 hours of grace period expiry
- **Rate Limiting:** 99.9% of legitimate requests unaffected by rate limits
- **Audit Coverage:** 100% of sensitive operations captured in audit log
- **MFA Adoption:** 30% of active users enable MFA within 3 months of feature launch
- **Bias Audit:** Zero discriminatory patterns detected in bias test suite

---

## Out of Scope

- Third-party penetration testing execution (documented as readiness item only)
- DDoS protection at infrastructure level (handled by Vercel/CDN, not application code)
- Real-time fraud detection or machine learning-based abuse detection
- Legal review of compliance documentation (platform operator responsibility)
- Cookie consent management (separate concern from data portability/deletion)
