// @vitest-environment happy-dom
/**
 * Task 6.3 — Employer compliance page component tests.
 */
import { describe, it, expect, vi, beforeEach } from "vitest"
import { render, screen } from "@testing-library/react"
import React from "react"

// ---------------------------------------------------------------------------
// Mock tRPC
// ---------------------------------------------------------------------------

const {
  mockExportRefetch,
  mockRequestDeletion,
  mockCancelDeletion,
  mockGetDeletionStatus,
  mockGetMfaStatus,
  mockDismissMfaPrompt,
} = vi.hoisted(() => ({
  mockExportRefetch: vi.fn(),
  mockRequestDeletion: vi.fn(),
  mockCancelDeletion: vi.fn(),
  mockGetDeletionStatus: vi.fn(),
  mockGetMfaStatus: vi.fn(),
  mockDismissMfaPrompt: vi.fn(),
}))

vi.mock("@/lib/trpc/client", () => ({
  trpc: {
    compliance: {
      exportMyData: {
        useQuery: () => ({
          refetch: mockExportRefetch,
          isFetching: false,
        }),
      },
      requestDeletion: {
        useMutation: () => ({
          mutateAsync: mockRequestDeletion,
          isPending: false,
          isError: false,
        }),
      },
      cancelDeletion: {
        useMutation: () => ({
          mutateAsync: mockCancelDeletion,
          isPending: false,
        }),
      },
      getDeletionStatus: {
        useQuery: (...args: unknown[]) => mockGetDeletionStatus(...args),
      },
      getMfaStatus: {
        useQuery: (...args: unknown[]) => mockGetMfaStatus(...args),
      },
      dismissMfaPrompt: {
        useMutation: () => ({
          mutate: mockDismissMfaPrompt,
          isPending: false,
        }),
      },
    },
  },
}))

// ---------------------------------------------------------------------------
// Component under test
// ---------------------------------------------------------------------------

const { default: EmployerCompliancePage } =
  await import("@/app/(employer)/settings/compliance/page")

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("EmployerCompliancePage", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockGetMfaStatus.mockReturnValue({
      data: { mfaEnabled: false, shouldPrompt: true },
      isLoading: false,
    })
    mockGetDeletionStatus.mockReturnValue({
      data: { hasPendingDeletion: false, request: null },
      isLoading: false,
    })
  })

  it("renders data export section with organization context", () => {
    render(<EmployerCompliancePage />)

    expect(screen.getByTestId("data-export-section")).toBeDefined()
    expect(screen.getByTestId("export-button")).toBeDefined()
    expect(screen.getByText("Export Organization Data")).toBeDefined()
  })

  it("renders account deletion section", () => {
    render(<EmployerCompliancePage />)

    expect(screen.getByTestId("account-deletion-section")).toBeDefined()
    expect(screen.getByTestId("confirm-deletion-input")).toBeDefined()
    expect(screen.getByTestId("request-deletion-button")).toBeDefined()
  })

  it("shows MFA status when not enabled", () => {
    render(<EmployerCompliancePage />)

    expect(screen.getByTestId("mfa-section")).toBeDefined()
    expect(screen.getByTestId("mfa-disabled")).toBeDefined()
    expect(screen.getByTestId("mfa-setup-link")).toBeDefined()
  })

  it("shows MFA enabled status", () => {
    mockGetMfaStatus.mockReturnValue({
      data: { mfaEnabled: true, shouldPrompt: false },
      isLoading: false,
    })

    render(<EmployerCompliancePage />)

    expect(screen.getByTestId("mfa-enabled")).toBeDefined()
  })

  it("shows deletion pending status when pending", () => {
    mockGetDeletionStatus.mockReturnValue({
      data: {
        hasPendingDeletion: true,
        request: {
          id: "del-1",
          scheduledAt: new Date(Date.now() + 72 * 60 * 60 * 1000).toISOString(),
        },
      },
      isLoading: false,
    })

    render(<EmployerCompliancePage />)

    expect(screen.getByTestId("deletion-pending")).toBeDefined()
    expect(screen.getByTestId("cancel-deletion-button")).toBeDefined()
  })

  it("disables delete button when confirmation text does not match", () => {
    render(<EmployerCompliancePage />)

    const deleteButton = screen.getByTestId("request-deletion-button") as HTMLButtonElement
    expect(deleteButton.disabled).toBe(true)
  })
})
