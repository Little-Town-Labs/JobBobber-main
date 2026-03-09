// @vitest-environment happy-dom
import { describe, it, expect, vi, beforeEach } from "vitest"
import { render, screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import React from "react"

import { AdvancedFilters, type FilterState } from "@/components/matches/advanced-filters"

const emptyFilters: FilterState = {
  status: undefined,
  experienceLevel: [],
  locationType: [],
  confidenceLevel: [],
}

describe("AdvancedFilters", () => {
  let onChange: (filters: FilterState) => void

  beforeEach(() => {
    onChange = vi.fn<(filters: FilterState) => void>()
  })

  it("renders filter sections for status, experience, location, and confidence", () => {
    render(<AdvancedFilters filters={emptyFilters} onChange={onChange} />)

    expect(screen.getByLabelText(/status/i)).toBeInTheDocument()
    expect(screen.getByText(/experience level/i)).toBeInTheDocument()
    expect(screen.getByText(/location type/i)).toBeInTheDocument()
    expect(screen.getByText(/confidence level/i)).toBeInTheDocument()
  })

  it("renders experience level checkboxes", () => {
    render(<AdvancedFilters filters={emptyFilters} onChange={onChange} />)

    expect(screen.getByLabelText("ENTRY")).toBeInTheDocument()
    expect(screen.getByLabelText("MID")).toBeInTheDocument()
    expect(screen.getByLabelText("SENIOR")).toBeInTheDocument()
    expect(screen.getByLabelText("EXECUTIVE")).toBeInTheDocument()
  })

  it("renders location type checkboxes", () => {
    render(<AdvancedFilters filters={emptyFilters} onChange={onChange} />)

    expect(screen.getByLabelText("REMOTE")).toBeInTheDocument()
    expect(screen.getByLabelText("HYBRID")).toBeInTheDocument()
    expect(screen.getByLabelText("ONSITE")).toBeInTheDocument()
  })

  it("renders confidence level checkboxes", () => {
    render(<AdvancedFilters filters={emptyFilters} onChange={onChange} />)

    expect(screen.getByLabelText("STRONG")).toBeInTheDocument()
    expect(screen.getByLabelText("GOOD")).toBeInTheDocument()
    expect(screen.getByLabelText("POTENTIAL")).toBeInTheDocument()
  })

  it("calls onChange when status dropdown changes", async () => {
    const user = userEvent.setup()
    render(<AdvancedFilters filters={emptyFilters} onChange={onChange} />)

    const select = screen.getByLabelText(/status/i)
    await user.selectOptions(select, "ACCEPTED")

    expect(onChange).toHaveBeenCalledWith({
      ...emptyFilters,
      status: "ACCEPTED",
    })
  })

  it("calls onChange when experience level checkbox is toggled on", async () => {
    const user = userEvent.setup()
    render(<AdvancedFilters filters={emptyFilters} onChange={onChange} />)

    await user.click(screen.getByLabelText("SENIOR"))

    expect(onChange).toHaveBeenCalledWith({
      ...emptyFilters,
      experienceLevel: ["SENIOR"],
    })
  })

  it("calls onChange when experience level checkbox is toggled off", async () => {
    const user = userEvent.setup()
    const filters: FilterState = {
      ...emptyFilters,
      experienceLevel: ["SENIOR", "MID"],
    }
    render(<AdvancedFilters filters={filters} onChange={onChange} />)

    await user.click(screen.getByLabelText("SENIOR"))

    expect(onChange).toHaveBeenCalledWith({
      ...filters,
      experienceLevel: ["MID"],
    })
  })

  it("calls onChange when location type checkbox is toggled", async () => {
    const user = userEvent.setup()
    render(<AdvancedFilters filters={emptyFilters} onChange={onChange} />)

    await user.click(screen.getByLabelText("REMOTE"))

    expect(onChange).toHaveBeenCalledWith({
      ...emptyFilters,
      locationType: ["REMOTE"],
    })
  })

  it("calls onChange when confidence level checkbox is toggled", async () => {
    const user = userEvent.setup()
    render(<AdvancedFilters filters={emptyFilters} onChange={onChange} />)

    await user.click(screen.getByLabelText("STRONG"))

    expect(onChange).toHaveBeenCalledWith({
      ...emptyFilters,
      confidenceLevel: ["STRONG"],
    })
  })

  it("shows active filter count badge", () => {
    const filters: FilterState = {
      status: "PENDING",
      experienceLevel: ["SENIOR", "MID"],
      locationType: ["REMOTE"],
      confidenceLevel: [],
    }
    render(<AdvancedFilters filters={filters} onChange={onChange} />)

    // 1 status + 2 experience + 1 location = 4 active filters
    expect(screen.getByTestId("active-filter-count")).toHaveTextContent("4")
  })

  it("does not show filter count badge when no filters are active", () => {
    render(<AdvancedFilters filters={emptyFilters} onChange={onChange} />)
    expect(screen.queryByTestId("active-filter-count")).not.toBeInTheDocument()
  })

  it("resets all filters when Clear Filters is clicked", async () => {
    const user = userEvent.setup()
    const filters: FilterState = {
      status: "PENDING",
      experienceLevel: ["SENIOR"],
      locationType: ["REMOTE"],
      confidenceLevel: ["STRONG"],
    }
    render(<AdvancedFilters filters={filters} onChange={onChange} />)

    await user.click(screen.getByRole("button", { name: /clear filters/i }))

    expect(onChange).toHaveBeenCalledWith({
      status: undefined,
      experienceLevel: [],
      locationType: [],
      confidenceLevel: [],
    })
  })

  it("reflects pre-selected filter values in the UI", () => {
    const filters: FilterState = {
      status: "ACCEPTED",
      experienceLevel: ["MID"],
      locationType: ["HYBRID"],
      confidenceLevel: ["GOOD"],
    }
    render(<AdvancedFilters filters={filters} onChange={onChange} />)

    const statusSelect = screen.getByLabelText(/status/i) as HTMLSelectElement
    expect(statusSelect.value).toBe("ACCEPTED")

    expect((screen.getByLabelText("MID") as HTMLInputElement).checked).toBe(true)
    expect((screen.getByLabelText("ENTRY") as HTMLInputElement).checked).toBe(false)
    expect((screen.getByLabelText("HYBRID") as HTMLInputElement).checked).toBe(true)
    expect((screen.getByLabelText("GOOD") as HTMLInputElement).checked).toBe(true)
  })
})
