// @vitest-environment jsdom
/**
 * Task 4.9 — SkillsForm component tests
 *
 * Tests FAIL before src/components/profile/skills-form.tsx exists.
 */
import { describe, it, expect, vi, beforeEach } from "vitest"
import { render, screen, waitFor } from "@testing-library/react"
import userEvent from "@testing-library/user-event"

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

const { mockUseMutation, mockMutateAsync } = vi.hoisted(() => ({
  mockUseMutation: vi.fn(),
  mockMutateAsync: vi.fn(),
}))

vi.mock("@/lib/trpc/client", () => ({
  trpc: {
    jobSeekers: {
      updateProfile: { useMutation: mockUseMutation },
    },
  },
}))

// ---------------------------------------------------------------------------
// Import component under test
// ---------------------------------------------------------------------------

import { SkillsForm } from "@/components/profile/skills-form"

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("SkillsForm", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockUseMutation.mockReturnValue({
      mutateAsync: mockMutateAsync,
      isPending: false,
    })
  })

  it("renders existing skills as removable tags", () => {
    render(<SkillsForm skills={["TypeScript", "React"]} />)
    expect(screen.getByText("TypeScript")).toBeInTheDocument()
    expect(screen.getByText("React")).toBeInTheDocument()
  })

  it("renders an input for adding skills", () => {
    render(<SkillsForm skills={[]} />)
    expect(screen.getByPlaceholderText(/add a skill/i)).toBeInTheDocument()
  })

  it("adds a skill when typed and confirmed (Enter or click)", async () => {
    const user = userEvent.setup()
    render(<SkillsForm skills={[]} />)

    await user.type(screen.getByPlaceholderText(/add a skill/i), "Go")
    await user.keyboard("{Enter}")

    expect(screen.getByText("Go")).toBeInTheDocument()
  })

  it("removes a skill when its remove button is clicked", async () => {
    const user = userEvent.setup()
    render(<SkillsForm skills={["TypeScript"]} />)

    await user.click(screen.getByRole("button", { name: /remove TypeScript/i }))

    expect(screen.queryByText("TypeScript")).not.toBeInTheDocument()
  })

  it("disables adding when 50 skills are present", () => {
    const fiftySkills = Array.from({ length: 50 }, (_, i) => `Skill${i}`)
    render(<SkillsForm skills={fiftySkills} />)

    const input = screen.getByPlaceholderText(/add a skill/i)
    expect(input).toBeDisabled()
  })

  it("submits the skills array on save", async () => {
    const user = userEvent.setup()
    mockMutateAsync.mockResolvedValue({ skills: ["TypeScript"], profileCompleteness: 15 })
    render(<SkillsForm skills={["TypeScript"]} />)

    await user.click(screen.getByRole("button", { name: /save/i }))

    await waitFor(() => {
      expect(mockMutateAsync).toHaveBeenCalledWith(
        expect.objectContaining({ skills: ["TypeScript"] }),
      )
    })
  })

  it("does not add duplicate skills", async () => {
    const user = userEvent.setup()
    render(<SkillsForm skills={["TypeScript"]} />)

    await user.type(screen.getByPlaceholderText(/add a skill/i), "TypeScript")
    await user.keyboard("{Enter}")

    // Still only one TypeScript tag
    const tags = screen.getAllByText("TypeScript")
    expect(tags).toHaveLength(1)
  })
})
