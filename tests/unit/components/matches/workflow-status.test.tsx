// @vitest-environment jsdom
import { describe, it, expect } from "vitest"
import { render, screen } from "@testing-library/react"
import { WorkflowStatus } from "@/components/matches/workflow-status"

describe("WorkflowStatus", () => {
  it("shows NOT_STARTED state", () => {
    render(
      <WorkflowStatus
        workflowStatus={{
          status: "NOT_STARTED",
          totalCandidates: 0,
          evaluatedCount: 0,
          matchesCreated: 0,
          error: null,
        }}
      />,
    )
    expect(screen.getByText("Not Started")).toBeInTheDocument()
    expect(screen.getByText("Matching Workflow")).toBeInTheDocument()
  })

  it("shows RUNNING state with progress", () => {
    render(
      <WorkflowStatus
        workflowStatus={{
          status: "RUNNING",
          totalCandidates: 10,
          evaluatedCount: 5,
          matchesCreated: 2,
          error: null,
        }}
      />,
    )
    expect(screen.getByText("Running")).toBeInTheDocument()
    expect(screen.getByText("10")).toBeInTheDocument()
    expect(screen.getByText("5")).toBeInTheDocument()
    expect(screen.getByText("2")).toBeInTheDocument()
  })

  it("shows COMPLETED state", () => {
    render(
      <WorkflowStatus
        workflowStatus={{
          status: "COMPLETED",
          totalCandidates: 10,
          evaluatedCount: 10,
          matchesCreated: 3,
          error: null,
        }}
      />,
    )
    expect(screen.getByText("Completed")).toBeInTheDocument()
  })

  it("shows error message", () => {
    render(
      <WorkflowStatus
        workflowStatus={{
          status: "COMPLETED",
          totalCandidates: 0,
          evaluatedCount: 0,
          matchesCreated: 0,
          error: "No BYOK key configured",
        }}
      />,
    )
    expect(screen.getByText("No BYOK key configured")).toBeInTheDocument()
  })
})
