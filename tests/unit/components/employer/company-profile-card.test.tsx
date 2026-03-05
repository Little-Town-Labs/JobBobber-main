// @vitest-environment jsdom
/**
 * Task 4.1 — CompanyProfileCard component tests
 */
import { describe, it, expect, vi } from "vitest"
import { render, screen } from "@testing-library/react"

vi.mock("next/image", () => ({
  // eslint-disable-next-line jsx-a11y/alt-text, @next/next/no-img-element
  default: (props: Record<string, unknown>) => <img {...props} />,
}))

vi.mock("next/link", () => ({
  default: ({ children, ...props }: { children: React.ReactNode; [key: string]: unknown }) => (
    <a {...props}>{children}</a>
  ),
}))

const EMPLOYER = {
  id: "emp_01",
  name: "Acme Corp",
  description: "We build things.",
  industry: "Technology",
  size: "51-200",
  culture: "Fast-paced and collaborative",
  headquarters: "San Francisco, CA",
  locations: ["San Francisco, CA", "New York, NY"],
  websiteUrl: "https://acme.example.com",
  urls: { linkedin: "https://linkedin.com/company/acme" },
  benefits: ["Health Insurance", "401k"],
  logoUrl: "https://blob.example.com/logo.png",
  createdAt: "2026-01-01T00:00:00.000Z",
  updatedAt: "2026-01-01T00:00:00.000Z",
}

import { CompanyProfileCard } from "@/components/employer/company-profile-card"

describe("CompanyProfileCard", () => {
  it("renders company name", () => {
    render(<CompanyProfileCard employer={EMPLOYER} />)
    expect(screen.getByText("Acme Corp")).toBeInTheDocument()
  })

  it("renders industry and size", () => {
    render(<CompanyProfileCard employer={EMPLOYER} />)
    expect(screen.getByText(/technology/i)).toBeInTheDocument()
    expect(screen.getByText(/51-200/i)).toBeInTheDocument()
  })

  it("renders headquarters", () => {
    render(<CompanyProfileCard employer={EMPLOYER} />)
    expect(screen.getByText(/san francisco/i)).toBeInTheDocument()
  })

  it("renders description", () => {
    render(<CompanyProfileCard employer={EMPLOYER} />)
    expect(screen.getByText("We build things.")).toBeInTheDocument()
  })

  it("renders logo when logoUrl is present", () => {
    render(<CompanyProfileCard employer={EMPLOYER} />)
    const img = screen.getByRole("img")
    expect(img).toHaveAttribute("src", "https://blob.example.com/logo.png")
  })

  it("shows Edit link", () => {
    render(<CompanyProfileCard employer={EMPLOYER} />)
    expect(screen.getByRole("link", { name: /edit/i })).toBeInTheDocument()
  })

  it("handles missing optional fields gracefully", () => {
    const minimal = {
      ...EMPLOYER,
      description: null,
      industry: null,
      size: null,
      culture: null,
      headquarters: null,
      locations: [],
      websiteUrl: null,
      urls: {},
      benefits: [],
      logoUrl: null,
    }
    render(<CompanyProfileCard employer={minimal} />)
    expect(screen.getByText("Acme Corp")).toBeInTheDocument()
    expect(screen.queryByRole("img")).not.toBeInTheDocument()
  })
})
