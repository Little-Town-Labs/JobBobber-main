// @vitest-environment happy-dom
/**
 * Tasks 5.1, 5.3 — Team management page and activity log component tests.
 */
import { describe, it, expect, vi } from "vitest"
import { render, screen } from "@testing-library/react"
import React from "react"

// ---------------------------------------------------------------------------
// Mock tRPC
// ---------------------------------------------------------------------------

const {
  mockListMembers,
  mockListInvitations,
  mockGetActivityLog,
  mockInviteMutate,
  mockUpdateRoleMutate,
  mockRemoveMemberMutate,
  mockRevokeInvitationMutate,
  mockInvalidate,
} = vi.hoisted(() => ({
  mockListMembers: vi.fn(),
  mockListInvitations: vi.fn(),
  mockGetActivityLog: vi.fn(),
  mockInviteMutate: vi.fn(),
  mockUpdateRoleMutate: vi.fn(),
  mockRemoveMemberMutate: vi.fn(),
  mockRevokeInvitationMutate: vi.fn(),
  mockInvalidate: vi.fn(),
}))

vi.mock("@/lib/trpc/client", () => ({
  trpc: {
    useUtils: () => ({
      team: {
        listMembers: { invalidate: mockInvalidate },
        listInvitations: { invalidate: mockInvalidate },
      },
    }),
    team: {
      listMembers: { useQuery: (...args: unknown[]) => mockListMembers(...args) },
      listInvitations: { useQuery: (...args: unknown[]) => mockListInvitations(...args) },
      getActivityLog: {
        useInfiniteQuery: (...args: unknown[]) => mockGetActivityLog(...args),
      },
      invite: {
        useMutation: () => ({
          mutate: mockInviteMutate,
          isPending: false,
          error: null,
        }),
      },
      updateRole: {
        useMutation: () => ({
          mutate: mockUpdateRoleMutate,
          isPending: false,
        }),
      },
      removeMember: {
        useMutation: () => ({
          mutate: mockRemoveMemberMutate,
          isPending: false,
        }),
      },
      revokeInvitation: {
        useMutation: () => ({
          mutate: mockRevokeInvitationMutate,
          isPending: false,
        }),
      },
    },
  },
}))

// ---------------------------------------------------------------------------
// Components under test
// ---------------------------------------------------------------------------

import TeamManagementPage from "@/app/(employer)/dashboard/team/page"
import { ActivityLog } from "@/components/team/activity-log"

// ---------------------------------------------------------------------------
// Team Page tests
// ---------------------------------------------------------------------------

describe("TeamManagementPage", () => {
  it("renders loading skeleton when data is loading", () => {
    mockListMembers.mockReturnValue({ data: undefined, isLoading: true })
    mockListInvitations.mockReturnValue({ data: undefined, isLoading: true })
    mockGetActivityLog.mockReturnValue({
      data: undefined,
      isLoading: true,
      fetchNextPage: vi.fn(),
      hasNextPage: false,
      isFetchingNextPage: false,
    })

    render(<TeamManagementPage />)
    expect(screen.getByTestId("team-loading-skeleton")).toBeDefined()
  })

  it("renders member list with roles", () => {
    const members = [
      { id: "mem_1", clerkUserId: "user_admin", role: "ADMIN", joinedAt: "2026-01-01T00:00:00Z" },
      {
        id: "mem_2",
        clerkUserId: "user_poster",
        role: "JOB_POSTER",
        joinedAt: "2026-02-01T00:00:00Z",
      },
    ]
    mockListMembers.mockReturnValue({ data: members, isLoading: false })
    mockListInvitations.mockReturnValue({ data: [], isLoading: false })
    mockGetActivityLog.mockReturnValue({
      data: { pages: [] },
      isLoading: false,
      fetchNextPage: vi.fn(),
      hasNextPage: false,
      isFetchingNextPage: false,
    })

    render(<TeamManagementPage />)
    expect(screen.getByTestId("members-table")).toBeDefined()
    expect(screen.getByText("user_admin")).toBeDefined()
    expect(screen.getByText("user_poster")).toBeDefined()
  })

  it("renders invite form", () => {
    mockListMembers.mockReturnValue({ data: [], isLoading: false })
    mockListInvitations.mockReturnValue({ data: [], isLoading: false })
    mockGetActivityLog.mockReturnValue({
      data: { pages: [] },
      isLoading: false,
      fetchNextPage: vi.fn(),
      hasNextPage: false,
      isFetchingNextPage: false,
    })

    render(<TeamManagementPage />)
    expect(screen.getByTestId("invite-form")).toBeDefined()
    expect(screen.getByText("Send Invite")).toBeDefined()
  })

  it("renders pending invitations", () => {
    const invitations = [
      {
        id: "inv_1",
        email: "new@example.com",
        role: "VIEWER",
        status: "PENDING",
        expiresAt: "2026-04-01T00:00:00Z",
        createdAt: "2026-03-01T00:00:00Z",
      },
    ]
    mockListMembers.mockReturnValue({ data: [], isLoading: false })
    mockListInvitations.mockReturnValue({ data: invitations, isLoading: false })
    mockGetActivityLog.mockReturnValue({
      data: { pages: [] },
      isLoading: false,
      fetchNextPage: vi.fn(),
      hasNextPage: false,
      isFetchingNextPage: false,
    })

    render(<TeamManagementPage />)
    expect(screen.getByTestId("invitations-list")).toBeDefined()
    expect(screen.getByText("new@example.com")).toBeDefined()
  })
})

// ---------------------------------------------------------------------------
// Activity Log tests
// ---------------------------------------------------------------------------

describe("ActivityLog", () => {
  it("renders loading skeleton", () => {
    mockGetActivityLog.mockReturnValue({
      data: undefined,
      isLoading: true,
      fetchNextPage: vi.fn(),
      hasNextPage: false,
      isFetchingNextPage: false,
    })

    render(<ActivityLog />)
    expect(screen.getByTestId("activity-log-loading")).toBeDefined()
  })

  it("renders empty state", () => {
    mockGetActivityLog.mockReturnValue({
      data: { pages: [{ items: [] }] },
      isLoading: false,
      fetchNextPage: vi.fn(),
      hasNextPage: false,
      isFetchingNextPage: false,
    })

    render(<ActivityLog />)
    expect(screen.getByTestId("activity-log-empty")).toBeDefined()
    expect(screen.getByText("No activity yet.")).toBeDefined()
  })

  it("renders activity entries", () => {
    const entries = [
      {
        id: "log_1",
        actorName: "John",
        action: "posting.created",
        targetType: "JobPosting",
        targetLabel: "Senior Engineer",
        createdAt: "2026-03-08T12:00:00Z",
      },
    ]
    mockGetActivityLog.mockReturnValue({
      data: { pages: [{ items: entries }] },
      isLoading: false,
      fetchNextPage: vi.fn(),
      hasNextPage: false,
      isFetchingNextPage: false,
    })

    render(<ActivityLog />)
    expect(screen.getByTestId("activity-log")).toBeDefined()
    expect(screen.getByText("John")).toBeDefined()
    expect(screen.getByText("created a posting")).toBeDefined()
  })

  it("shows Load more button when hasNextPage", () => {
    const entries = [
      {
        id: "log_1",
        actorName: "Alice",
        action: "member.invited",
        targetType: null,
        targetLabel: "bob@example.com",
        createdAt: "2026-03-08T12:00:00Z",
      },
    ]
    mockGetActivityLog.mockReturnValue({
      data: { pages: [{ items: entries }] },
      isLoading: false,
      fetchNextPage: vi.fn(),
      hasNextPage: true,
      isFetchingNextPage: false,
    })

    render(<ActivityLog />)
    expect(screen.getByTestId("activity-log-load-more")).toBeDefined()
    expect(screen.getByText("Load more")).toBeDefined()
  })
})
