# Feature Specification: Multi-Member Employer Accounts

**Feature Branch**: `13-multi-member-employer-accounts`
**Created**: 2026-03-08
**Status**: Draft
**Input**: Roadmap feature 13 — multi-user employer accounts with role-based access control

## User Scenarios & Testing _(mandatory)_

### User Story 1 - Admin Invites Team Members (Priority: P1)

An employer admin wants to invite colleagues to collaborate on hiring. The admin enters a team member's email address and selects a role (Admin, Job Poster, or Viewer). The invitee receives an email with a link to join the organization. Once accepted, the new member can access the employer dashboard scoped to their assigned role.

**Why this priority**: Without invitations, multi-member accounts cannot exist. This is the foundational capability.

**Independent Test**: Can be fully tested by inviting an email address, verifying the invitation is created, and confirming the invitee appears in the team list after accepting.

**Acceptance Scenarios**:

1. **Given** an employer admin is on the team management page, **When** they enter a valid email and select "Job Poster" role, **Then** an invitation is created and an email is sent to the invitee.
2. **Given** an invitation has been sent, **When** the invitee clicks the invitation link and signs up, **Then** they are added to the organization with the assigned role and can access the employer dashboard.
3. **Given** an invitation is pending, **When** the admin views the team page, **Then** pending invitations are shown with the ability to revoke them.
4. **Given** a non-admin member is logged in, **When** they navigate to team management, **Then** they cannot see the invite controls.

---

### User Story 2 - Role-Based Access Enforcement (Priority: P1)

All employer operations enforce role-based permissions. Admins have full access. Job Posters can create, edit, and manage job postings and view matched candidates. Viewers can only see postings, matches, and conversation logs but cannot modify anything.

**Why this priority**: Without enforcement, roles are meaningless. This must ship alongside invitations.

**Independent Test**: Can be tested by logging in as each role and verifying which operations succeed and which are denied.

**Acceptance Scenarios**:

1. **Given** a user with "Viewer" role, **When** they attempt to create a job posting, **Then** the request is rejected with an authorization error.
2. **Given** a user with "Job Poster" role, **When** they create a job posting, **Then** the posting is created successfully under their organization.
3. **Given** a user with "Job Poster" role, **When** they attempt to remove a team member, **Then** the request is rejected with an authorization error.
4. **Given** a user with "Admin" role, **When** they perform any employer operation, **Then** the operation succeeds.

---

### User Story 3 - Admin Manages Team Members (Priority: P2)

An admin can view all team members, change their roles, and remove them from the organization. Removing a member revokes their access immediately. An admin cannot remove themselves if they are the last admin.

**Why this priority**: Day-to-day team management is important but secondary to the core invite + enforce flow.

**Independent Test**: Can be tested by changing a member's role and verifying their permissions change, and by removing a member and verifying they lose access.

**Acceptance Scenarios**:

1. **Given** an admin views the team page, **When** they change a member's role from "Viewer" to "Job Poster", **Then** the member's permissions update immediately.
2. **Given** an admin attempts to remove themselves, **When** they are the only admin, **Then** the operation is rejected with an error explaining why.
3. **Given** an admin removes a team member, **When** the removed member next accesses the dashboard, **Then** they are denied access to that organization's resources.

---

### User Story 4 - Team Activity Log (Priority: P3)

Admins can see a log of team activity: who created or modified postings, who reviewed candidates, and when. This provides accountability and transparency for multi-user hiring workflows.

**Why this priority**: Valuable for audit and oversight but not required for core multi-member functionality.

**Independent Test**: Can be tested by performing actions as different team members and verifying the activity log shows correct entries with actor, action, and timestamp.

**Acceptance Scenarios**:

1. **Given** a Job Poster creates a new job posting, **When** an admin views the activity log, **Then** the log shows the Job Poster's name, the action ("created posting"), the posting title, and a timestamp.
2. **Given** multiple team members are active, **When** an admin views the activity log, **Then** entries are shown in reverse chronological order with pagination.

---

### User Story 5 - Backward Compatibility with Single-User Accounts (Priority: P1)

Existing single-user employer accounts from MVP continue to work without requiring any migration or additional setup. A solo employer is implicitly an admin of their own account. Multi-member features are available but not required.

**Why this priority**: Breaking existing accounts is unacceptable. This is a hard constraint.

**Independent Test**: Can be tested by logging in as an existing single-user employer and verifying all existing functionality works unchanged.

**Acceptance Scenarios**:

1. **Given** an existing single-user employer account, **When** the user logs in after this feature ships, **Then** all existing functionality works identically.
2. **Given** a single-user employer, **When** they navigate to team management, **Then** they see themselves as the sole admin with the option to invite others.

---

### Edge Cases

- What happens when an invited email is already a job seeker on the platform? The invitation should still work — a user can have both roles.
- What happens when an admin changes their own role to Viewer? This should be prevented if they are the last admin.
- What happens when an invitation email bounces or is never accepted? Pending invitations should expire after 7 days and be cleanable by the admin.
- What happens when a member is removed while they have a browser session open? Their next API call should fail with an authorization error.
- What happens when the organization reaches a member limit (if subscription-based)? The system should reject the invitation with a clear error. For now, no hard limit is enforced (deferred to Feature 16 — billing).
- What happens if two admins try to remove each other simultaneously? Only one operation should succeed; the other should fail based on the resulting state.

## Requirements _(mandatory)_

### Functional Requirements

- **FR-001**: System MUST allow employer admins to invite new members by email with a specified role (Admin, Job Poster, Viewer).
- **FR-002**: System MUST send invitation emails when a team member is invited.
- **FR-003**: System MUST enforce role-based access control on all employer API endpoints.
- **FR-004**: System MUST allow admins to change a member's role.
- **FR-005**: System MUST allow admins to remove members from the organization.
- **FR-006**: System MUST prevent the last admin from being removed or demoted.
- **FR-007**: System MUST support pending invitation management (view, revoke).
- **FR-008**: System MUST log team activity (posting creation/modification, candidate review) with actor identity and timestamp.
- **FR-009**: System MUST ensure existing single-user employer accounts work without migration.
- **FR-010**: System MUST scope all employer data (postings, matches, conversations) to the organization, not individual members.
- **FR-011**: System MUST automatically expire pending invitations after 7 days.
- **FR-012**: This feature MUST be gated behind a `MULTI_MEMBER_EMPLOYER` feature flag.

### Key Entities

- **Employer (Organization)**: Represents the company entity. All postings, matches, and conversations belong to the organization. Linked to an authentication provider's organization concept.
- **EmployerMember**: Join between a user and an employer organization. Carries a role (Admin, Job Poster, Viewer). A user can be a member of at most one employer organization.
- **Invitation**: A pending invite with target email, assigned role, expiration, and status (pending, accepted, expired, revoked).
- **ActivityLog**: Record of team member actions within an organization — actor, action type, target entity, and timestamp.

## Success Criteria _(mandatory)_

### Measurable Outcomes

- **SC-001**: Admins can invite a new member and the invitee can join within 3 clicks of receiving the email.
- **SC-002**: Role enforcement prevents 100% of unauthorized operations (verified by test coverage).
- **SC-003**: Existing single-user employer accounts require zero changes to continue working.
- **SC-004**: Team management page loads in under 500ms (90th percentile).
- **SC-005**: Activity log entries appear within 5 seconds of the action occurring.
