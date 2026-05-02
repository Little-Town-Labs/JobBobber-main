import { describe, it, expect } from "vitest"
import { parseStreamingFields } from "./streaming-parser"

describe("parseStreamingFields", () => {
  it("returns empty array for empty input", () => {
    expect(parseStreamingFields("")).toEqual([])
  })

  it("returns single streaming field for plain text", () => {
    const result = parseStreamingFields("Hello, how can I help?")
    expect(result).toEqual([
      { name: "response", content: "Hello, how can I help?", state: "streaming" },
    ])
  })

  it("detects markdown h2 headers as field boundaries", () => {
    const text = "## Summary\nThis is a summary.\n## Details\nSome details here."
    const result = parseStreamingFields(text)

    expect(result).toHaveLength(2)
    expect(result[0]).toEqual({
      name: "Summary",
      content: "This is a summary.",
      state: "complete",
    })
    expect(result[1]).toEqual({
      name: "Details",
      content: "Some details here.",
      state: "streaming",
    })
  })

  it("detects markdown h3 headers as field boundaries", () => {
    const text = "### First\nContent one\n### Second\nContent two"
    const result = parseStreamingFields(text)

    expect(result).toHaveLength(2)
    expect(result[0]).toEqual({
      name: "First",
      content: "Content one",
      state: "complete",
    })
    expect(result[1]).toEqual({
      name: "Second",
      content: "Content two",
      state: "streaming",
    })
  })

  it("detects bold labels as field boundaries", () => {
    const text = "**Skills:** React, TypeScript\n**Experience:** 5 years"
    const result = parseStreamingFields(text)

    expect(result).toHaveLength(2)
    expect(result[0]).toEqual({
      name: "Skills",
      content: "React, TypeScript",
      state: "complete",
    })
    expect(result[1]).toEqual({
      name: "Experience",
      content: "5 years",
      state: "streaming",
    })
  })

  it("marks all fields except the last as complete", () => {
    const text = "## A\nOne\n## B\nTwo\n## C\nThree"
    const result = parseStreamingFields(text)

    expect(result).toHaveLength(3)
    expect(result[0]!.state).toBe("complete")
    expect(result[1]!.state).toBe("complete")
    expect(result[2]!.state).toBe("streaming")
  })

  it("handles partial stream ending mid-field", () => {
    const text = "## Analysis\nThe candidate shows stro"
    const result = parseStreamingFields(text)

    expect(result).toHaveLength(1)
    expect(result[0]).toEqual({
      name: "Analysis",
      content: "The candidate shows stro",
      state: "streaming",
    })
  })

  it("handles mixed header and bold label boundaries", () => {
    const text = "## Overview\nGreat match.\n**Score:** 85/100"
    const result = parseStreamingFields(text)

    expect(result).toHaveLength(2)
    expect(result[0]!.name).toBe("Overview")
    expect(result[0]!.state).toBe("complete")
    expect(result[1]!.name).toBe("Score")
    expect(result[1]!.state).toBe("streaming")
  })

  it("trims whitespace from field content", () => {
    const text = "## Title\n  Some content with spaces  \n## Next\nMore"
    const result = parseStreamingFields(text)

    expect(result[0]!.content).toBe("Some content with spaces")
  })
})
