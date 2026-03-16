import { describe, it, expect } from "vitest"
import {
  experienceEntrySchema,
  educationEntrySchema,
  profileUrlSchema,
  parsedResumeSchema,
  notifPrefsSchema,
  salaryRulesSchema,
  employerUrlsSchema,
  minQualOverrideSchema,
  seekerContactInfoSchema,
  seekerAvailabilitySchema,
  auditMetadataSchema,
  safeParseJson,
  safeParseJsonArray,
  NOTIF_PREFS_DEFAULTS,
} from "./prisma-json"

describe("experienceEntrySchema", () => {
  it("parses valid experience entry", () => {
    const entry = {
      title: "Software Engineer",
      company: "Acme Corp",
      startDate: "2020-01-01",
      endDate: "2023-06-01",
      description: "Built things",
    }
    expect(experienceEntrySchema.parse(entry)).toMatchObject(entry)
  })

  it("allows nullable endDate", () => {
    const entry = { title: "Engineer", company: "Startup", startDate: "2023-01-01", endDate: null }
    expect(experienceEntrySchema.parse(entry)).toMatchObject(entry)
  })

  it("passes through extra keys from AI extraction", () => {
    const entry = {
      title: "Engineer",
      company: "Co",
      startDate: "2020-01-01",
      extraField: "preserved",
    }
    const result = experienceEntrySchema.parse(entry)
    expect(result).toHaveProperty("extraField", "preserved")
  })

  it("rejects missing required fields", () => {
    expect(() => experienceEntrySchema.parse({ title: "Engineer" })).toThrow()
  })
})

describe("educationEntrySchema", () => {
  it("parses valid education entry", () => {
    const entry = {
      institution: "MIT",
      degree: "BS Computer Science",
      field: "CS",
      startDate: "2016-09-01",
      endDate: "2020-05-01",
    }
    expect(educationEntrySchema.parse(entry)).toMatchObject(entry)
  })

  it("allows minimal entry with just institution and degree", () => {
    const entry = { institution: "MIT", degree: "BS" }
    expect(educationEntrySchema.parse(entry)).toMatchObject(entry)
  })

  it("rejects missing institution", () => {
    expect(() => educationEntrySchema.parse({ degree: "BS" })).toThrow()
  })
})

describe("profileUrlSchema", () => {
  it("parses valid profile URL", () => {
    const url = { id: "abc123", label: "GitHub", url: "https://github.com/user" }
    expect(profileUrlSchema.parse(url)).toMatchObject(url)
  })

  it("rejects invalid URL", () => {
    expect(() => profileUrlSchema.parse({ id: "1", label: "Bad", url: "not-a-url" })).toThrow()
  })
})

describe("parsedResumeSchema", () => {
  it("parses valid resume extraction", () => {
    const resume = {
      headline: "Senior Engineer",
      skills: ["TypeScript", "React"],
      experience: [{ title: "Dev", company: "Co", startDate: "2020-01-01" }],
      education: [{ institution: "MIT", degree: "BS" }],
    }
    expect(parsedResumeSchema.parse(resume)).toMatchObject(resume)
  })

  it("allows empty object (minimal extraction)", () => {
    expect(parsedResumeSchema.parse({})).toEqual({})
  })

  it("passes through extra AI-generated fields", () => {
    const resume = { headline: "Dev", certifications: ["AWS"] }
    const result = parsedResumeSchema.parse(resume)
    expect(result).toHaveProperty("certifications")
  })
})

describe("notifPrefsSchema", () => {
  it("parses valid preferences", () => {
    const prefs = { matchCreated: false, mutualAccept: true }
    expect(notifPrefsSchema.parse(prefs)).toEqual(prefs)
  })

  it("applies defaults for missing fields", () => {
    expect(notifPrefsSchema.parse({})).toEqual(NOTIF_PREFS_DEFAULTS)
  })

  it("defaults match expected values", () => {
    expect(NOTIF_PREFS_DEFAULTS).toEqual({ matchCreated: true, mutualAccept: true })
  })
})

describe("salaryRulesSchema", () => {
  it("parses arbitrary key-value rules", () => {
    const rules = { type: "flexible_for_equity", minBase: 100000 }
    expect(salaryRulesSchema.parse(rules)).toEqual(rules)
  })

  it("parses empty object", () => {
    expect(salaryRulesSchema.parse({})).toEqual({})
  })
})

describe("employerUrlsSchema", () => {
  it("parses employer URL map", () => {
    const urls = { careers: "https://example.com/careers", linkedin: "https://linkedin.com/co" }
    expect(employerUrlsSchema.parse(urls)).toEqual(urls)
  })
})

describe("minQualOverrideSchema", () => {
  it("parses qualification overrides", () => {
    const override = { yearsExperience: 3, degreeRequired: false }
    expect(minQualOverrideSchema.parse(override)).toEqual(override)
  })
})

describe("seekerContactInfoSchema", () => {
  it("parses contact info with email", () => {
    const info = { name: "Jane", email: "jane@example.com", location: "NYC" }
    expect(seekerContactInfoSchema.parse(info)).toMatchObject(info)
  })

  it("parses contact info without email", () => {
    const info = { name: "Jane", location: null }
    expect(seekerContactInfoSchema.parse(info)).toMatchObject(info)
  })

  it("passes through extra fields", () => {
    const info = { name: "Jane", phone: "555-1234" }
    const result = seekerContactInfoSchema.parse(info)
    expect(result).toHaveProperty("phone", "555-1234")
  })
})

describe("seekerAvailabilitySchema", () => {
  it("parses availability", () => {
    const avail = { available: true }
    expect(seekerAvailabilitySchema.parse(avail)).toMatchObject(avail)
  })

  it("passes through extra fields", () => {
    const avail = { available: true, startDate: "2026-04-01" }
    const result = seekerAvailabilitySchema.parse(avail)
    expect(result).toHaveProperty("startDate", "2026-04-01")
  })
})

describe("auditMetadataSchema", () => {
  it("parses arbitrary metadata", () => {
    const meta = { action: "key_rotated", previousKeyId: "abc" }
    expect(auditMetadataSchema.parse(meta)).toEqual(meta)
  })
})

describe("safeParseJson", () => {
  it("returns parsed value on success", () => {
    const result = safeParseJson(notifPrefsSchema, { matchCreated: false, mutualAccept: true })
    expect(result).toEqual({ matchCreated: false, mutualAccept: true })
  })

  it("returns raw value on failure", () => {
    const badValue = "not an object"
    const result = safeParseJson(notifPrefsSchema, badValue)
    expect(result).toBe(badValue)
  })
})

describe("safeParseJsonArray", () => {
  it("parses valid array items", () => {
    const items = [
      { title: "Dev", company: "A", startDate: "2020-01-01" },
      { title: "Lead", company: "B", startDate: "2022-01-01" },
    ]
    const result = safeParseJsonArray(experienceEntrySchema, items)
    expect(result).toHaveLength(2)
    expect(result[0]).toHaveProperty("title", "Dev")
  })

  it("returns raw items for invalid entries", () => {
    const items = [{ title: "Dev", company: "A", startDate: "2020-01-01" }, "bad entry"]
    const result = safeParseJsonArray(experienceEntrySchema, items)
    expect(result).toHaveLength(2)
    expect(result[1]).toBe("bad entry")
  })
})
