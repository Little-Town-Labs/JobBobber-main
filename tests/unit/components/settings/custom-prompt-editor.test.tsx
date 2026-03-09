// @vitest-environment happy-dom
/**
 * Task 5.1 — Custom Prompt Editor Component Tests
 */
import { describe, it, expect, vi, beforeEach } from "vitest"
import { render, screen, fireEvent } from "@testing-library/react"
import React from "react"

const mockUseQuery = vi.hoisted(() => vi.fn())
const mockUseMutation = vi.hoisted(() => vi.fn())

const mockValidateMutation = vi.hoisted(() => vi.fn())

vi.mock("@/lib/trpc/client", () => ({
  trpc: {
    customPrompts: {
      getExamples: { useQuery: mockUseQuery },
      validatePrompt: { useMutation: mockValidateMutation },
    },
    settings: {
      updateSeekerSettings: { useMutation: mockUseMutation },
    },
  },
}))

const { CustomPromptEditor } = await import("@/components/settings/custom-prompt-editor")

describe("CustomPromptEditor", () => {
  const mockSave = vi.fn()

  beforeEach(() => {
    vi.clearAllMocks()
    mockUseMutation.mockReturnValue({ mutate: mockSave, isPending: false })
    mockValidateMutation.mockReturnValue({ mutate: vi.fn(), isPending: false })
    mockUseQuery.mockReturnValue({
      data: [
        {
          id: "ex-1",
          title: "Work-Life Balance",
          description: "Prioritize remote work",
          prompt: "Prioritize remote work and flexibility.",
          userType: "seeker",
        },
        {
          id: "ex-2",
          title: "Salary Assertive",
          description: "Be firm on salary",
          prompt: "Be assertive on salary expectations.",
          userType: "seeker",
        },
        {
          id: "ex-3",
          title: "Career Change",
          description: "Highlight transferable skills",
          prompt: "Emphasize transferable skills from marketing.",
          userType: "seeker",
        },
      ],
      isLoading: false,
    })
  })

  it("renders example prompts with titles", () => {
    render(<CustomPromptEditor userType="seeker" />)

    expect(screen.getByText("Work-Life Balance")).toBeDefined()
    expect(screen.getByText("Salary Assertive")).toBeDefined()
    expect(screen.getByText("Career Change")).toBeDefined()
  })

  it("clicking an example inserts its text into the textarea", () => {
    render(<CustomPromptEditor userType="seeker" />)

    const exampleBtn = screen.getByTestId("example-ex-1")
    fireEvent.click(exampleBtn)

    const textarea = screen.getByTestId("custom-prompt-textarea") as HTMLTextAreaElement
    expect(textarea.value).toBe("Prioritize remote work and flexibility.")
  })

  it("displays character counter", () => {
    render(<CustomPromptEditor userType="seeker" />)

    expect(screen.getByTestId("char-counter")).toBeDefined()
    expect(screen.getByTestId("char-counter").textContent).toContain("2,000")
  })

  it("updates character counter as user types", () => {
    render(<CustomPromptEditor userType="seeker" />)

    const textarea = screen.getByTestId("custom-prompt-textarea") as HTMLTextAreaElement
    fireEvent.change(textarea, { target: { value: "Hello world" } })

    expect(screen.getByTestId("char-counter").textContent).toContain("1,989")
  })

  it("renders with empty state when no custom prompt exists", () => {
    render(<CustomPromptEditor userType="seeker" />)

    const textarea = screen.getByTestId("custom-prompt-textarea") as HTMLTextAreaElement
    expect(textarea.value).toBe("")
  })

  it("renders with existing prompt value", () => {
    render(<CustomPromptEditor userType="seeker" initialValue="My existing prompt" />)

    const textarea = screen.getByTestId("custom-prompt-textarea") as HTMLTextAreaElement
    expect(textarea.value).toBe("My existing prompt")
  })

  it("shows guidance text about what the prompt can do", () => {
    render(<CustomPromptEditor userType="seeker" />)

    expect(screen.getByTestId("prompt-guidance")).toBeDefined()
  })
})
