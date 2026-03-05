# Implementation Plan — Feature 6: Match Dashboard

## Executive Summary

Feature 6 enhances the basic match viewing from Feature 5 into a full dashboard experience with sorting, filtering, status counts, decline confirmations, email notifications, and notification preferences. Much of the foundation exists — the matches router, match components, and pages were created in Feature 5. This feature polishes them and adds the notification layer.

## Architecture Overview

```
Feature 5 (existing)          Feature 6 (additions)
─────────────────────         ───────────────────────
matches.listForSeeker    →    + status filter, sort, counts
matches.listForPosting   →    + status filter, sort, counts
matches.updateStatus     →    + fire notification events
MatchCard component      →    + decline confirmation dialog
MatchList component      →    + filter tabs, sort controls
Seeker matches page      →    + full dashboard layout
Employer matches page    →    + full dashboard layout
                              + notification Inngest functions
                              + notification preferences UI
```

## Technical Decisions

### 1. Email Provider

**Context:** Need to send transactional emails for match notifications.
**Options:**

1. Resend — simple API, good DX, React Email templates
2. SendGrid — enterprise-grade, more complex
3. Clerk emails — limited to auth-related emails only

**Chosen:** Resend
**Rationale:** Simplest API, excellent React Email integration for templates, generous free tier (100 emails/day). Aligns with constitutional principle of minimal abstractions.
**Tradeoffs:** Less feature-rich than SendGrid, but sufficient for transactional emails.

### 2. Notification Architecture

**Context:** Emails must be async and not block match operations.
**Options:**

1. Fire Inngest events from updateStatus mutation, handle email in Inngest function
2. Direct email send in mutation with try/catch

**Chosen:** Inngest events (Option 1)
**Rationale:** Already using Inngest for workflows. Provides retry, observability, and decoupling. Matches existing pattern from Feature 5 evaluate-candidates.
**Tradeoffs:** Slight complexity of another Inngest function, but consistent with existing architecture.

### 3. Filter/Sort Implementation

**Context:** Need server-side filtering and sorting for match lists.
**Options:**

1. Extend existing tRPC procedures with optional filter/sort params
2. Create new procedures for filtered views

**Chosen:** Extend existing procedures (Option 1)
**Rationale:** Simpler, backward-compatible. Existing `listForSeeker` and `listForPosting` already return paginated results — adding optional `status` and `sort` params is minimal change.

## Implementation Phases

### Phase 1: Backend Enhancements (4 hours)

- Extend `matches.listForSeeker` with `status` filter and `sort` param
- Extend `matches.listForPosting` with `status` filter and `sort` param
- Add `matches.getStatusCounts` procedure (seeker) — returns {all, pending, accepted, declined}
- Add `matches.getPostingStatusCounts` procedure (employer) — same per posting
- Fire Inngest events from `matches.updateStatus` on status change
- Fire Inngest event from `evaluate-candidates` workflow on match creation

### Phase 2: Email Notifications (4 hours)

- Add Resend dependency
- Create email templates (React Email): match-created, mutual-accept
- Create Inngest function: `send-match-notification`
- Handle `notification/match.created` and `notification/mutual.accept` events
- Respect notification preferences (check SeekerSettings.notifPrefs / Employer notifPrefs)

### Phase 3: Notification Preferences (2 hours)

- Add `notifPrefs` column to Employer model (migration)
- Add `matches.getNotifPrefs` and `matches.updateNotifPrefs` procedures
- These read/write to SeekerSettings.notifPrefs or Employer.notifPrefs based on role

### Phase 4: Frontend Dashboard (6 hours)

- Enhance MatchList with filter tabs (All/Pending/Accepted/Declined) with counts
- Add sort dropdown (Best Match / Newest)
- Add decline confirmation dialog to MatchCard
- Enhance seeker matches page with full dashboard layout
- Enhance employer matches page with posting selector + dashboard layout
- Add notification preferences toggle in settings area
- Mobile-responsive layout (NFR-2)

### Phase 5: Testing & Hardening (4 hours)

- Unit tests for extended router procedures (filter, sort, counts)
- Unit tests for notification Inngest functions
- Component tests for enhanced MatchList, filter tabs, sort controls, confirmation dialog
- Integration tests against NeonDB
- E2E tests: seeker dashboard flow, employer dashboard flow, notification preferences

### Phase 6: Security Review (1 hour)

- Verify contact info still never leaks pre-mutual-accept
- Verify notification prefs only accessible by owner
- Verify email content doesn't expose sensitive data

**Total Estimated Effort:** 21 hours

## Security Considerations

- **NFR-4 enforcement:** Contact info server-side gating unchanged from Feature 5. No new exposure vectors.
- **Email content:** Notification emails include match confidence and a link — never include contact info or match summary details in email body.
- **Notification prefs:** Accessible only by the authenticated user (seekerProcedure / employerProcedure middleware).
- **Resend API key:** Stored as environment variable, never exposed to client.

## Performance Strategy

- **FR-12 pagination:** Cursor-based pagination already in place from Feature 5.
- **Status counts:** Single `groupBy` query, not N+1.
- **Sort:** Prisma `orderBy` on indexed fields (`confidenceScore`, `createdAt`).
- **NFR-1:** Target < 1s load. Match queries are simple indexed lookups.

## Testing Strategy

- **TDD enforced:** Tests written before implementation for each phase.
- **Unit tests:** Router procedures (filter, sort, counts), notification functions, email templates.
- **Component tests:** Filter tabs, sort controls, decline dialog, notification toggle.
- **Integration tests:** Against NeonDB for real query validation.
- **E2E tests:** Full dashboard flows for both roles.

## Constitutional Compliance

- [x] Type Safety First — Zod schemas for all new inputs, Prisma types throughout
- [x] Test-Driven Development — TDD enforced per phase
- [x] BYOK Architecture — N/A (no LLM calls in this feature)
- [x] Minimal Abstractions — Resend direct API, Inngest events, no extra layers
- [x] Security & Privacy — Contact info gating, email content safety, prefs privacy
- [x] Agent Autonomy — N/A (dashboard feature, no agent involvement)
