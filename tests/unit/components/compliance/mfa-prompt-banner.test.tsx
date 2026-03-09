// @vitest-environment happy-dom
/**
 * Task 6.5 — MFA prompt banner component tests.
 */
import { describe, it, expect, vi, beforeEach } from "vitest"
import { render, screen, fireEvent } from "@testing-library/react"
import React from "react"

// ---------------------------------------------------------------------------
// Mock tRPC
// ---------------------------------------------------------------------------

const { mockGetMfaStatus, mockDismissMfaPrompt } = vi.hoisted(() => ({
  mockGetMfaStatus: vi.fn(),
  mockDismissMfaPrompt: vi.fn(),
}))

vi.mock("@/lib/trpc/client", () => ({
  trpc: {
    compliance: {
      getMfaStatus: {
        useQuery: (...args: unknown[]) => mockGetMfaStatus(...args),
      },
      dismissMfaPrompt: {
        useMutation: () => ({
          mutateAsync: mockDismissMfaPrompt,
          isPending: false,
        }),
      },
    },
  },
}))

// ---------------------------------------------------------------------------
// Component under test
// ---------------------------------------------------------------------------

import { MfaPromptBanner } from "@/components/compliance/mfa-prompt-banner"

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("MfaPromptBanner", () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it("renders banner when shouldPrompt is true", () => {
    mockGetMfaStatus.mockReturnValue({
      data: { mfaEnabled: false, shouldPrompt: true },
      isLoading: false,
    })

    render(<MfaPromptBanner />)

    expect(screen.getByTestId("mfa-prompt-banner")).toBeDefined()
    expect(screen.getByText(/does not have multi-factor authentication enabled/)).toBeDefined()
  })

  it("does not render when shouldPrompt is false", () => {
    mockGetMfaStatus.mockReturnValue({
      data: { mfaEnabled: false, shouldPrompt: false },
      isLoading: false,
    })

    render(<MfaPromptBanner />)

    expect(screen.queryByTestId("mfa-prompt-banner")).toBeNull()
  })

  it("does not render when MFA is already enabled", () => {
    mockGetMfaStatus.mockReturnValue({
      data: { mfaEnabled: true, shouldPrompt: true },
      isLoading: false,
    })

    render(<MfaPromptBanner />)

    expect(screen.queryByTestId("mfa-prompt-banner")).toBeNull()
  })

  it("does not render while loading", () => {
    mockGetMfaStatus.mockReturnValue({
      data: undefined,
      isLoading: true,
    })

    render(<MfaPromptBanner />)

    expect(screen.queryByTestId("mfa-prompt-banner")).toBeNull()
  })

  it("dismiss button calls dismissMfaPrompt", () => {
    mockGetMfaStatus.mockReturnValue({
      data: { mfaEnabled: false, shouldPrompt: true },
      isLoading: false,
    })

    render(<MfaPromptBanner />)

    const dismissButton = screen.getByTestId("dismiss-mfa-button")
    fireEvent.click(dismissButton)

    expect(mockDismissMfaPrompt).toHaveBeenCalled()
  })

  it('has "Set up MFA" link pointing to security settings', () => {
    mockGetMfaStatus.mockReturnValue({
      data: { mfaEnabled: false, shouldPrompt: true },
      isLoading: false,
    })

    render(<MfaPromptBanner />)

    const link = screen.getByTestId("mfa-setup-link") as HTMLAnchorElement
    expect(link.href).toContain("/settings/security")
    expect(link.textContent).toBe("Set up MFA")
  })
})
