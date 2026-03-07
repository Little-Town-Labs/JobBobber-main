// @vitest-environment happy-dom
import { describe, it, expect } from "vitest"
import { render, screen } from "@testing-library/react"
import { ConfidenceBadge } from "@/components/matches/confidence-badge"

describe("ConfidenceBadge", () => {
  it("renders STRONG", () => {
    render(<ConfidenceBadge score="STRONG" />)
    expect(screen.getByText("STRONG")).toBeInTheDocument()
  })

  it("renders GOOD", () => {
    render(<ConfidenceBadge score="GOOD" />)
    expect(screen.getByText("GOOD")).toBeInTheDocument()
  })

  it("renders POTENTIAL", () => {
    render(<ConfidenceBadge score="POTENTIAL" />)
    expect(screen.getByText("POTENTIAL")).toBeInTheDocument()
  })

  it("applies different colors per score", () => {
    const { rerender } = render(<ConfidenceBadge score="STRONG" />)
    const strongClass = screen.getByText("STRONG").className

    rerender(<ConfidenceBadge score="POTENTIAL" />)
    expect(screen.getByText("POTENTIAL").className).not.toEqual(strongClass)
  })

  it("falls back to gray for unknown score", () => {
    render(<ConfidenceBadge score="UNKNOWN" />)
    expect(screen.getByText("UNKNOWN").className).toContain("bg-gray-100")
  })
})
