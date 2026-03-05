import { describe, it, expect } from "vitest"
import { SKILLS } from "./skills-data"

describe("SKILLS", () => {
  it("is exported as a named export", () => {
    expect(SKILLS).toBeDefined()
  })

  it("is a non-empty array", () => {
    expect(Array.isArray(SKILLS)).toBe(true)
    expect(SKILLS.length).toBeGreaterThan(0)
  })

  it("contains at least 100 entries", () => {
    expect(SKILLS.length).toBeGreaterThanOrEqual(100)
  })

  it("all entries are strings", () => {
    SKILLS.forEach((skill) => {
      expect(typeof skill).toBe("string")
    })
  })

  it("has no duplicate entries", () => {
    const unique = new Set(SKILLS)
    expect(unique.size).toBe(SKILLS.length)
  })

  it("is sorted case-insensitively in ascending order", () => {
    const sorted = [...SKILLS].sort((a, b) => a.toLowerCase().localeCompare(b.toLowerCase()))
    expect(SKILLS).toEqual(sorted)
  })

  it("contains no empty strings", () => {
    SKILLS.forEach((skill) => {
      expect(skill.trim().length).toBeGreaterThan(0)
    })
  })
})
