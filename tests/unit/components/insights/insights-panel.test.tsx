// @vitest-environment happy-dom
/**
 * Task 5.1 — Insights Panel Component Tests
 */
import { describe, it, expect, vi, beforeEach } from "vitest"
import { render, screen, fireEvent } from "@testing-library/react"
import React from "react"

const mockUseQuery = vi.hoisted(() => vi.fn())
const mockUseMutation = vi.hoisted(() => vi.fn())

vi.mock("@/lib/trpc/client", () => ({
  trpc: {
    insights: {
      getSeekerInsights: { useQuery: mockUseQuery },
      getEmployerInsights: { useQuery: mockUseQuery },
      refreshInsights: { useMutation: mockUseMutation },
    },
  },
}))

const { InsightsPanel } = await import("@/components/insights/insights-panel")

describe("InsightsPanel", () => {
  const mockRefresh = vi.fn()

  beforeEach(() => {
    vi.clearAllMocks()
    mockUseMutation.mockReturnValue({
      mutate: mockRefresh,
      isPending: false,
    })
  })

  it("shows loading skeleton", () => {
    mockUseQuery.mockReturnValue({ data: undefined, isLoading: true })

    render(<InsightsPanel variant="seeker" />)

    expect(screen.getByTestId("insights-loading")).toBeDefined()
  })

  it("shows empty state when below threshold", () => {
    mockUseQuery.mockReturnValue({
      data: {
        id: null,
        strengths: [],
        weaknesses: [],
        recommendations: [],
        metrics: {
          totalConversations: 1,
          inProgressCount: 0,
          matchRate: 0,
          interviewConversionRate: 0,
        },
        trendDirection: "STABLE",
        generatedAt: null,
        belowThreshold: true,
        thresholdProgress: { current: 1, required: 3 },
      },
      isLoading: false,
    })

    render(<InsightsPanel variant="seeker" />)

    expect(screen.getByTestId("insights-below-threshold")).toBeDefined()
    expect(screen.getByText(/1 of 3/)).toBeDefined()
  })

  it("shows full insights when available", () => {
    mockUseQuery.mockReturnValue({
      data: {
        id: "insight-1",
        strengths: ["Strong technical skills"],
        weaknesses: ["Limited experience"],
        recommendations: ["Expand portfolio"],
        metrics: {
          totalConversations: 10,
          inProgressCount: 0,
          matchRate: 0.4,
          interviewConversionRate: 0.5,
        },
        trendDirection: "IMPROVING",
        generatedAt: new Date("2026-03-01").toISOString(),
        belowThreshold: false,
        thresholdProgress: { current: 10, required: 3 },
      },
      isLoading: false,
    })

    render(<InsightsPanel variant="seeker" />)

    expect(screen.getByText("Strong technical skills")).toBeDefined()
    expect(screen.getByText("Limited experience")).toBeDefined()
    expect(screen.getByText("Expand portfolio")).toBeDefined()
    expect(screen.getByTestId("insights-trend")).toBeDefined()
  })

  it("shows metrics even when strengths/weaknesses empty (metrics-only mode)", () => {
    mockUseQuery.mockReturnValue({
      data: {
        id: "insight-1",
        strengths: [],
        weaknesses: [],
        recommendations: [],
        metrics: {
          totalConversations: 5,
          inProgressCount: 1,
          matchRate: 0.4,
          interviewConversionRate: 0,
        },
        trendDirection: "STABLE",
        generatedAt: new Date("2026-03-01").toISOString(),
        belowThreshold: false,
        thresholdProgress: { current: 5, required: 3 },
      },
      isLoading: false,
    })

    render(<InsightsPanel variant="seeker" />)

    expect(screen.getByTestId("insights-metrics")).toBeDefined()
  })

  it("shows stale indicator when insights are older than 30 days", () => {
    const oldDate = new Date()
    oldDate.setDate(oldDate.getDate() - 31)

    mockUseQuery.mockReturnValue({
      data: {
        id: "insight-1",
        strengths: ["Good"],
        weaknesses: ["Bad"],
        recommendations: ["Do better"],
        metrics: {
          totalConversations: 10,
          inProgressCount: 0,
          matchRate: 0.5,
          interviewConversionRate: 0.5,
        },
        trendDirection: "STABLE",
        generatedAt: oldDate.toISOString(),
        belowThreshold: false,
        thresholdProgress: { current: 10, required: 3 },
      },
      isLoading: false,
    })

    render(<InsightsPanel variant="seeker" />)

    expect(screen.getByTestId("insights-stale")).toBeDefined()
  })

  it("refresh button triggers mutation", () => {
    mockUseQuery.mockReturnValue({
      data: {
        id: "insight-1",
        strengths: ["Good"],
        weaknesses: ["Bad"],
        recommendations: ["Do better"],
        metrics: {
          totalConversations: 10,
          inProgressCount: 0,
          matchRate: 0.5,
          interviewConversionRate: 0.5,
        },
        trendDirection: "STABLE",
        generatedAt: new Date().toISOString(),
        belowThreshold: false,
        thresholdProgress: { current: 10, required: 3 },
      },
      isLoading: false,
    })

    render(<InsightsPanel variant="seeker" />)

    const refreshBtn = screen.getByTestId("insights-refresh")
    fireEvent.click(refreshBtn)

    expect(mockRefresh).toHaveBeenCalled()
  })

  it("works with employer variant", () => {
    mockUseQuery.mockReturnValue({
      data: {
        id: "insight-1",
        strengths: ["Clear descriptions"],
        weaknesses: ["Low salary"],
        recommendations: ["Improve comp"],
        metrics: {
          totalConversations: 8,
          inProgressCount: 2,
          matchRate: 0.6,
          interviewConversionRate: 0.7,
        },
        trendDirection: "IMPROVING",
        generatedAt: new Date().toISOString(),
        belowThreshold: false,
        thresholdProgress: { current: 8, required: 3 },
      },
      isLoading: false,
    })

    render(<InsightsPanel variant="employer" />)

    expect(screen.getByText("Clear descriptions")).toBeDefined()
  })
})
