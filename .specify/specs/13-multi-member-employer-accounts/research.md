# Technology Research

## Decision: Invitation Mechanism

**Options Considered:**

1. **Clerk Organization Invitations API** — Clerk handles invitation emails, token generation, and acceptance flow natively. Members are managed through Clerk's dashboard and API.
2. **Custom invitation system** — Store invitations in our DB, send emails via Inngest + Resend, handle token validation ourselves.

**Chosen:** Clerk Organization Invitations API
**Rationale:** Clerk already manages our organizations (see `onboarding.ts`). Using their invitation API avoids duplicating email sending, token generation, and expiration logic. Clerk handles the acceptance flow, webhook events confirm membership changes, and roles sync via `organizationMembership` events.
**Tradeoffs:** Less control over invitation email content; depends on Clerk's invitation flow UX. Acceptable because Clerk already owns the auth experience.

## Decision: Role Granularity

**Options Considered:**

1. **Three roles (Admin, Job Poster, Viewer)** — matches roadmap spec exactly. Admin = full access, Job Poster = CRUD on postings + view matches, Viewer = read-only.
2. **Two roles (Admin, Member)** — simpler but less granular. Would require adding granularity later.
3. **Custom RBAC with permissions table** — most flexible but over-engineered for current needs.

**Chosen:** Three roles (Admin, Job Poster, Viewer)
**Rationale:** Matches the PRD and existing `EmployerMemberRole` enum already in the schema. Clear separation of concerns without over-engineering.
**Tradeoffs:** Adding new roles later requires a schema migration. Acceptable for current scope.

## Decision: Role Enforcement Layer

**Options Considered:**

1. **New tRPC middleware procedures** — e.g., `jobPosterProcedure` that checks `role >= JOB_POSTER`. Extends existing middleware chain.
2. **Inline role checks in each procedure** — check `ctx.member.role` inside each handler.
3. **Clerk's RBAC permissions system** — use Clerk's permission model and check at middleware level.

**Chosen:** New tRPC middleware procedures
**Rationale:** Follows existing pattern (`employerProcedure` → `adminProcedure`). Creates a `jobPosterProcedure` between them. Consistent, type-safe, and testable. Clerk's RBAC is an alternative but would add Clerk API calls to every request.
**Tradeoffs:** Need to refactor some existing `employerProcedure` endpoints to use the correct tier (most employer read endpoints stay as `employerProcedure` which allows all roles; write endpoints move to `jobPosterProcedure` or `adminProcedure`).

## Decision: Activity Log Storage

**Options Considered:**

1. **New `ActivityLog` table in Prisma** — stores actor, action, target entity, timestamp. Simple append-only table with index on employerId + timestamp.
2. **Clerk audit log** — Clerk provides organization audit logs for membership events, but not for application-level actions.
3. **External logging service** — Datadog, LogDNA, etc. Over-engineered for current needs.

**Chosen:** New `ActivityLog` table in Prisma
**Rationale:** Need to log application-level actions (posting created, candidate reviewed) that Clerk doesn't know about. Append-only table is simple and queryable. Clerk audit logs supplement this for membership changes.
**Tradeoffs:** Additional DB writes on each logged action. Mitigated by keeping log writes non-blocking (fire-and-forget pattern).

## Decision: Backward Compatibility Strategy

**Options Considered:**

1. **Implicit admin for single-member orgs** — existing single-user employers already have an `EmployerMember` record with `ADMIN` role (created in onboarding). No migration needed.
2. **Migration script** — backfill `EmployerMember` records for existing employers.

**Chosen:** Option 1 — implicit admin
**Rationale:** The onboarding flow already creates an `EmployerMember` with `ADMIN` role for every employer (see `onboarding.ts` lines 97-104). Existing accounts are already compatible. The new middleware just needs to read this existing record.
**Tradeoffs:** None — this is the ideal case where forward planning paid off.
