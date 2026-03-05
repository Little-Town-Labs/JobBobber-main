import { describe, it, expect } from "vitest"
import { computeProfileCompleteness } from "./profile-completeness"

const full = {
  name: "Jane Doe",
  headline: "Senior Engineer",
  bio: "10 years experience",
  experience: [{ title: "Engineer", company: "Acme" }],
  skills: ["TypeScript", "React", "Node.js"],
  education: [{ degree: "BS Computer Science" }],
  location: "Austin, TX",
  resumeUrl: "https://example.com/resume.pdf",
}

const empty = {
  name: "",
  headline: null,
  bio: null,
  experience: [],
  skills: [],
  education: [],
  location: null,
  resumeUrl: null,
}

describe("computeProfileCompleteness", () => {
  it("returns 100 when all fields are fully populated", () => {
    expect(computeProfileCompleteness(full)).toBe(100)
  })

  it("returns 0 when all fields are empty/null", () => {
    expect(computeProfileCompleteness(empty)).toBe(0)
  })

  it("returns 30 when only name and headline are set", () => {
    // name(15) + headline(15) = 30
    expect(computeProfileCompleteness({ ...empty, name: "Jane", headline: "Engineer" })).toBe(30)
  })

  it("returns 70 when fields summing to exactly 70 are set", () => {
    // name(15) + headline(15) + bio(10) + experience(20) + location(5) + education(10) = 75
    // Let's use: name(15) + headline(15) + bio(10) + experience(20) + location(5) + skills(15) = 80
    // For exactly 70: name(15) + headline(15) + experience(20) + education(10) + location(5) + resumeUrl(10) = 75 — nope
    // name(15) + headline(15) + bio(10) + experience(20) + location(5) + education(?)
    // Simplest 70: name(15) + headline(15) + bio(10) + experience(20) + location(5) + education(? no, 5 won't work)
    // name(15) + headline(15) + experience(20) + skills(15) + location(5) = 70
    expect(
      computeProfileCompleteness({
        ...empty,
        name: "Jane",
        headline: "Engineer",
        experience: [{ title: "Engineer" }],
        skills: ["TypeScript", "React", "Node.js"],
        location: "Austin, TX",
      }),
    ).toBe(70)
  })

  it("returns 65 when fields summing to 65 are set (below activation threshold)", () => {
    // name(15) + headline(15) + bio(10) + experience(20) + location(5) = 65
    expect(
      computeProfileCompleteness({
        ...empty,
        name: "Jane",
        headline: "Engineer",
        bio: "Some bio",
        experience: [{ title: "Engineer" }],
        location: "Austin, TX",
      }),
    ).toBe(65)
  })

  it("gives skills 0 points when skills.length < 3", () => {
    const withTwoSkills = computeProfileCompleteness({
      ...full,
      skills: ["TypeScript", "React"],
    })
    const withThreeSkills = computeProfileCompleteness({
      ...full,
      skills: ["TypeScript", "React", "Node.js"],
    })
    expect(withTwoSkills).toBe(85) // 100 - 15 (skills)
    expect(withThreeSkills).toBe(100)
  })

  it("gives skills 15 points when skills.length >= 3", () => {
    expect(
      computeProfileCompleteness({ ...empty, skills: ["TypeScript", "React", "Node.js"] }),
    ).toBe(15)
  })

  it("gives experience 0 points when experience array is empty", () => {
    expect(computeProfileCompleteness({ ...full, experience: [] })).toBe(80) // 100 - 20
  })

  it("gives experience 20 points when experience.length >= 1", () => {
    expect(computeProfileCompleteness({ ...empty, experience: [{ title: "Engineer" }] })).toBe(20)
  })

  it("gives resumeUrl 0 points when null", () => {
    expect(computeProfileCompleteness({ ...full, resumeUrl: null })).toBe(90) // 100 - 10
  })

  it("gives resumeUrl 10 points when set", () => {
    expect(
      computeProfileCompleteness({
        ...empty,
        name: "Jane",
        resumeUrl: "https://example.com/resume.pdf",
      }),
    ).toBe(25) // name(15) + resumeUrl(10)
  })

  it("returns a number in [0, 100]", () => {
    const result = computeProfileCompleteness(full)
    expect(result).toBeGreaterThanOrEqual(0)
    expect(result).toBeLessThanOrEqual(100)
  })

  it("treats empty string name as 0 points", () => {
    expect(computeProfileCompleteness({ ...full, name: "" })).toBe(85) // 100 - 15
  })

  it("treats whitespace-only strings as empty (0 points)", () => {
    expect(computeProfileCompleteness({ ...full, headline: "   " })).toBe(85) // 100 - 15
  })
})
