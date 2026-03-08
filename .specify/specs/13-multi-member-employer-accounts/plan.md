# Implementation Plan: Multi-Member Employer Accounts

**Feature Branch**: `13-multi-member-employer-accounts`
**Specification**: `spec.md`
**Created**: 2026-03-08

## Executive Summary

Add multi-user employer accounts with role-based access control using Clerk Organizations. Three roles (Admin, Job Poster, Viewer) enforce permissions at the tRPC middleware level. Invitations flow through Clerk's API, with webhook events syncing membership changes to our database. Activity logging tracks team actions for admin visibility.

## Architecture Overview

```
┌──────────────────────────────────────────────────────────┐
│                    Client (Next.js)                       │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐   │
│  │ Team Mgmt    │  │ Invite Flow  │  │ Activity Log │   │
│  │ Page         │  │ Components   │  │ Panel        │   │
│  └──────┬───────┘  └──────┬───────┘  └──────┬───────┘   │
│         │                 │                  │            │
│         └────────┬────────┴──────────────────┘            │
│                  │ tRPC client                            │
└──────────────────┼────────────────────────────────────────┘
                   │
┌──────────────────┼────────────────────────────────────────┐
│                  │ tRPC server                            │
│  ┌───────────────▼──────────────┐                        │
│  │       teamRouter             │                        │
│  │  listMembers (employer)      │                        │
│  │  invite (admin)              │◄──── Clerk Invitations │
│  │  updateRole (admin)          │      API               │
│  │  removeMember (admin)        │                        │
│  │  listInvitations (admin)     │                        │
│  │  revokeInvitation (admin)    │                        │
│  │  getActivityLog (admin)      │                        │
│  └──────────────────────────────┘                        │
│                                                          │
│  ┌──────────────────────────────┐                        │
│  │  Middleware Chain             │                        │
│  │  public → protected →        │                        │
│  │  employer → jobPoster →      │  ◄── NEW: jobPoster    │
│  │  admin                       │                        │
│  └──────────────────────────────┘                        │
│                                                          │
│  ┌──────────────────────────────┐                        │
│  │  Clerk Webhook Handler       │                        │
│  │  + organizationMembership.*  │  ◄── NEW events        │
│  │  + organizationInvitation.*  │                        │
│  └──────────────────────────────┘                        │
│                                                          │
│  ┌──────────────────────────────┐                        │
│  │  Activity Logger Utility     │  ◄── NEW               │
│  │  logActivity(ctx, action,    │                        │
│  │    targetType, targetId,     │                        │
│  │    targetLabel)              │                        │
│  └──────────────────────────────┘                        │
└──────────────────────────────────────────────────────────┘
```

## Technology Stack

All choices align with the locked stack in the constitution:

| Component          | Technology                   | Rationale                                                         |
| ------------------ | ---------------------------- | ----------------------------------------------------------------- |
| Auth & Invitations | Clerk Organizations API      | Already integrated; handles invitation emails natively            |
| Role Enforcement   | tRPC middleware chain        | Extends existing pattern (`employerProcedure` → `adminProcedure`) |
| Data Storage       | Prisma + NeonDB              | Consistent with all other features                                |
| Webhook Events     | Clerk → svix → Next.js route | Existing webhook handler in `src/app/api/webhooks/clerk/route.ts` |
| Feature Flag       | Vercel Flags SDK             | `MULTI_MEMBER_EMPLOYER` flag, consistent with other features      |
| UI Components      | React + Tailwind + shadcn/ui | Consistent with existing dashboard pages                          |

## Technical Decisions

### TD-1: Add `jobPosterProcedure` to Middleware Chain

**Context:** Need to differentiate between Viewer (read-only) and Job Poster (can create/edit postings) without checking roles inline in every handler.

**Approach:** Add `jobPosterProcedure` between `employerProcedure` and `adminProcedure`. The middleware reads the `EmployerMember` record and checks `role !== 'VIEWER'`.

**Current chain:** `public → protected → employer → admin`
**New chain:** `public → protected → employer → jobPoster → admin`

**Impact:** Existing `employerProcedure` endpoints allow ALL roles (including Viewer) for read operations. Write operations on postings and matches move to `jobPosterProcedure`. Profile/BYOK/team management stays on `adminProcedure`.

### TD-2: Enrich `employerProcedure` Context with Member Record

**Context:** The current `employerProcedure` middleware loads the `Employer` record but not the `EmployerMember` record. We need the member record for role checks downstream.

**Approach:** Modify `enforceEmployer` middleware to also load the `EmployerMember` record for the current user and add it to context as `ctx.member`. This is a single additional DB query that runs once per request.

**Tradeoff:** One extra DB query per employer request. Acceptable because it replaces the need for inline role lookups in every handler.

### TD-3: Clerk Webhook Events for Membership Sync

**Context:** When a user accepts a Clerk organization invitation, we need to create an `EmployerMember` record in our database.

**Approach:** Handle these Clerk webhook events in the existing webhook handler:

- `organizationMembership.created` → create `EmployerMember` record
- `organizationMembership.deleted` → delete `EmployerMember` record
- `organizationInvitation.accepted` → update `Invitation` status to `ACCEPTED`

This keeps our database in sync with Clerk's state without requiring custom invitation acceptance logic.

### TD-4: Activity Logging as Fire-and-Forget

**Context:** Activity log writes should not slow down the primary operation.

**Approach:** Create a `logActivity()` utility that performs a `db.activityLog.create()` call. Call it after the primary operation succeeds. If the log write fails, catch and ignore the error — activity logs are informational, not critical.

**Alternative considered:** Inngest event for async logging. Rejected as over-engineered — a simple DB write with error swallowing is sufficient for P3 priority.

## Implementation Phases

### Phase 1: Schema & Middleware (Foundation)

1. Add `Invitation` and `ActivityLog` models to Prisma schema
2. Add `InvitationStatus` enum
3. Add `MULTI_MEMBER_EMPLOYER` feature flag
4. Modify `enforceEmployer` middleware to load `EmployerMember` into context
5. Add `jobPosterProcedure` middleware
6. Run migration

### Phase 2: Team Router (Core API)

7. Create `teamRouter` with all 7 procedures
8. Wire Clerk Organizations API for invitation sending/revoking
9. Add activity logging utility
10. Integrate activity logging into team operations

### Phase 3: Webhook Events (Sync)

11. Extend Clerk webhook handler with membership events
12. Handle `organizationMembership.created/deleted`
13. Handle `organizationInvitation.accepted`

### Phase 4: Existing Router Audit (Role Enforcement)

14. Audit all `employerProcedure` endpoints — migrate write operations to `jobPosterProcedure`
15. Verify `adminProcedure` on profile/BYOK management endpoints
16. Add activity logging to existing posting CRUD operations

### Phase 5: UI (Frontend)

17. Team management page (list members, invite, change roles, remove)
18. Pending invitations panel
19. Activity log panel
20. Navigation link in employer dashboard sidebar

## Security Considerations

- **Role enforcement at API level:** All permission checks happen in tRPC middleware, not in the UI. UI adjustments are cosmetic only.
- **Last-admin protection:** Both role changes and member removal must verify at least one admin remains. Uses a count query in a transaction.
- **Clerk webhook verification:** Existing svix signature verification applies to new events.
- **Organization scoping:** All employer data is already scoped to `employerId` via `ctx.employer.id`. Multi-member access doesn't change data ownership.
- **Cross-org access:** The `enforceEmployer` middleware already validates `clerkOrgId` against the user's session `orgId`. A user cannot access another organization's data.

## Performance Strategy

- **Member record loading:** One additional DB query in `enforceEmployer` middleware (indexed on `[employerId, clerkUserId]`).
- **Activity log queries:** Indexed on `[employerId, createdAt]` with cursor-based pagination.
- **Invitation queries:** Indexed on `[employerId, status]`.
- **No N+1 queries:** Member names resolved via Clerk API in batch (or denormalized in the member record).

## Testing Strategy

- **Unit tests:** Team router procedures with mocked Clerk API and DB.
- **Unit tests:** Middleware role enforcement (all 3 roles × all operations).
- **Unit tests:** Webhook handler for new event types.
- **Unit tests:** Activity logging utility.
- **Integration tests:** Full invitation → acceptance → role change → removal flow.
- **Coverage target:** 80%+ on all new code.

## Risks & Mitigation

| Risk                                      | Impact   | Mitigation                                                                              |
| ----------------------------------------- | -------- | --------------------------------------------------------------------------------------- |
| Clerk API rate limits on invitation sends | Medium   | Batch invitations if needed; rate limit UI to 10 invitations per minute                 |
| Webhook delivery failures                 | Medium   | Clerk retries webhooks; idempotent handlers with upsert patterns                        |
| Role desync between Clerk and DB          | High     | Webhook events are the source of truth; add reconciliation query on team page load      |
| Migration breaks existing accounts        | Critical | No schema changes to existing models; only adding new tables and a new middleware layer |

## Constitutional Compliance

- [x] **I. Type Safety First** — Zod schemas for all team router inputs; typed middleware context
- [x] **II. Test-Driven Development** — TDD for all new code; 80%+ coverage
- [x] **III. BYOK Architecture** — No AI features in this feature; BYOK key management stays admin-only
- [x] **IV. Minimal Abstractions** — Direct Clerk SDK calls; no framework wrappers
- [x] **V. Security & Privacy** — Role enforcement at API level; no sensitive data exposed
- [x] **VI. Phased Rollout** — Behind `MULTI_MEMBER_EMPLOYER` feature flag
- [x] **VII. Agent Autonomy** — Not applicable (no agent changes in this feature)
