// @vitest-environment happy-dom
/**
 * Task 5.1 — JobPostingList component tests
 */
import { describe, it, expect, vi } from "vitest"
import { render, screen } from "@testing-library/react"

vi.mock("next/link", () => ({
  default: ({
    children,
    href,
    ...props
  }: {
    children: React.ReactNode
    href: string
    [key: string]: unknown
  }) => (
    <a href={href} {...props}>
      {children}
    </a>
  ),
}))

import { JobPostingList } from "@/components/employer/job-posting-list"

const POSTINGS = [
  {
    id: "post_01",
    title: "Software Engineer",
    status: "DRAFT",
    updatedAt: "2026-01-01T00:00:00.000Z",
  },
  {
    id: "post_02",
    title: "Product Manager",
    status: "ACTIVE",
    updatedAt: "2026-01-02T00:00:00.000Z",
  },
]

describe("JobPostingList", () => {
  it("renders posting titles", () => {
    render(<JobPostingList postings={POSTINGS} />)
    expect(screen.getByText("Software Engineer")).toBeInTheDocument()
    expect(screen.getByText("Product Manager")).toBeInTheDocument()
  })

  it("renders status for each posting", () => {
    render(<JobPostingList postings={POSTINGS} />)
    expect(screen.getByText("DRAFT")).toBeInTheDocument()
    expect(screen.getByText("ACTIVE")).toBeInTheDocument()
  })

  it("shows empty state with CTA when no postings", () => {
    render(<JobPostingList postings={[]} />)
    expect(screen.getByText(/no job postings/i)).toBeInTheDocument()
    expect(screen.getByRole("link")).toBeInTheDocument()
  })
})
