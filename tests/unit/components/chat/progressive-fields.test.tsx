// @vitest-environment happy-dom
import { describe, it, expect } from "vitest"
import { render, screen } from "@testing-library/react"
import React from "react"
import { ProgressiveFields } from "@/components/chat/progressive-fields"
import type { StreamingField } from "@/components/chat/streaming-parser"

describe("ProgressiveFields", () => {
  it("renders complete fields with full content", () => {
    const fields: StreamingField[] = [
      { name: "Summary", content: "Great candidate match.", state: "complete" },
      { name: "Details", content: "Strong skills.", state: "streaming" },
    ]

    render(<ProgressiveFields fields={fields} />)

    expect(screen.getByText("Summary")).toBeInTheDocument()
    expect(screen.getByText("Great candidate match.")).toBeInTheDocument()
  })

  it("shows blinking cursor indicator for streaming field", () => {
    const fields: StreamingField[] = [
      { name: "Analysis", content: "The candidate", state: "streaming" },
    ]

    render(<ProgressiveFields fields={fields} />)

    expect(screen.getByText("The candidate")).toBeInTheDocument()
    const cursor = screen.getByTestId("streaming-cursor")
    expect(cursor).toBeInTheDocument()
  })

  it("renders pending fields as skeleton placeholders", () => {
    const fields: StreamingField[] = [{ name: "Summary", content: "", state: "pending" }]

    render(<ProgressiveFields fields={fields} />)

    const skeleton = screen.getByTestId("pending-field-Summary")
    expect(skeleton).toBeInTheDocument()
    expect(skeleton.className).toContain("animate-pulse")
  })

  it("renders plain text identically for single response field", () => {
    const fields: StreamingField[] = [
      { name: "response", content: "Just a plain answer.", state: "streaming" },
    ]

    render(<ProgressiveFields fields={fields} />)

    expect(screen.getByText("Just a plain answer.")).toBeInTheDocument()
    // Should NOT render a section header for plain text
    expect(screen.queryByText("response")).not.toBeInTheDocument()
  })

  it("renders nothing for empty fields array", () => {
    const { container } = render(<ProgressiveFields fields={[]} />)
    expect(container.firstChild).toBeNull()
  })
})
