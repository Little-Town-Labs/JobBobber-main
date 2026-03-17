// @vitest-environment happy-dom
import { describe, it, expect, vi } from "vitest"
import { render, screen, fireEvent } from "@testing-library/react"
import React from "react"
import { SuggestionButtons } from "@/components/chat/suggestion-buttons"

describe("SuggestionButtons", () => {
  const defaultSuggestions = [
    { label: "Tell me more", message: "Tell me more about this job" },
    { label: "Show details", message: "Show match details" },
  ]

  it("renders all suggestion buttons", () => {
    const onSend = vi.fn()
    render(<SuggestionButtons suggestions={defaultSuggestions} onSend={onSend} />)

    expect(screen.getByTestId("suggestion-buttons")).toBeInTheDocument()
    expect(screen.getByText("Tell me more")).toBeInTheDocument()
    expect(screen.getByText("Show details")).toBeInTheDocument()
  })

  it("calls onSend with the correct message when clicked", () => {
    const onSend = vi.fn()
    render(<SuggestionButtons suggestions={defaultSuggestions} onSend={onSend} />)

    fireEvent.click(screen.getByText("Tell me more"))
    expect(onSend).toHaveBeenCalledTimes(1)
    expect(onSend).toHaveBeenCalledWith("Tell me more about this job")
  })

  it("calls onSend with second suggestion message", () => {
    const onSend = vi.fn()
    render(<SuggestionButtons suggestions={defaultSuggestions} onSend={onSend} />)

    fireEvent.click(screen.getByText("Show details"))
    expect(onSend).toHaveBeenCalledWith("Show match details")
  })

  it("renders nothing when suggestions array is empty", () => {
    const onSend = vi.fn()
    const { container } = render(<SuggestionButtons suggestions={[]} onSend={onSend} />)
    expect(container.firstChild).toBeNull()
  })

  it("renders buttons with ghost/outlined style", () => {
    const onSend = vi.fn()
    render(<SuggestionButtons suggestions={defaultSuggestions} onSend={onSend} />)

    const buttons = screen.getAllByRole("button")
    buttons.forEach((button) => {
      expect(button.className).toContain("border")
    })
  })
})
