// @vitest-environment happy-dom
/**
 * Task 5.1 — StatusBadge component tests
 */
import { describe, it, expect } from "vitest"
import { render, screen } from "@testing-library/react"

import { StatusBadge } from "@/components/employer/status-badge"

describe("StatusBadge", () => {
  it("renders DRAFT status", () => {
    render(<StatusBadge status="DRAFT" />)
    expect(screen.getByText("DRAFT")).toBeInTheDocument()
  })

  it("renders ACTIVE status", () => {
    render(<StatusBadge status="ACTIVE" />)
    expect(screen.getByText("ACTIVE")).toBeInTheDocument()
  })

  it("renders PAUSED status", () => {
    render(<StatusBadge status="PAUSED" />)
    expect(screen.getByText("PAUSED")).toBeInTheDocument()
  })

  it("renders CLOSED status", () => {
    render(<StatusBadge status="CLOSED" />)
    expect(screen.getByText("CLOSED")).toBeInTheDocument()
  })

  it("renders FILLED status", () => {
    render(<StatusBadge status="FILLED" />)
    expect(screen.getByText("FILLED")).toBeInTheDocument()
  })

  it("applies different colors per status", () => {
    const { rerender } = render(<StatusBadge status="ACTIVE" />)
    const active = screen.getByText("ACTIVE")
    const activeClass = active.className

    rerender(<StatusBadge status="DRAFT" />)
    const draft = screen.getByText("DRAFT")
    expect(draft.className).not.toEqual(activeClass)
  })
})
