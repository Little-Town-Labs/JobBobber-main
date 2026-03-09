import { describe, it, expect, vi, beforeEach } from "vitest"

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

vi.mock("server-only", () => ({}))

const mockAuditLogCreate = vi.fn()

vi.mock("@/lib/db", () => ({
  db: {
    auditLog: {
      create: (...args: unknown[]) => mockAuditLogCreate(...args),
    },
  },
}))

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("logAudit", () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it("writes to DB with all required fields", async () => {
    mockAuditLogCreate.mockResolvedValue({ id: "audit_01" })

    const { logAudit } = await import("@/lib/audit")
    await logAudit({
      actorId: "user_123",
      actorType: "JOB_SEEKER",
      action: "profile.updated",
      result: "SUCCESS",
    })

    expect(mockAuditLogCreate).toHaveBeenCalledOnce()
    expect(mockAuditLogCreate).toHaveBeenCalledWith({
      data: {
        actorId: "user_123",
        actorType: "JOB_SEEKER",
        action: "profile.updated",
        entityType: undefined,
        entityId: undefined,
        metadata: {},
        ipHash: null,
        result: "SUCCESS",
      },
    })
  })

  it("includes optional fields when provided", async () => {
    mockAuditLogCreate.mockResolvedValue({ id: "audit_02" })

    const { logAudit } = await import("@/lib/audit")
    await logAudit({
      actorId: "emp_456",
      actorType: "EMPLOYER",
      action: "posting.created",
      entityType: "JobPosting",
      entityId: "post_789",
      metadata: { title: "Senior Engineer" },
      ipHash: "abc123hash",
      result: "SUCCESS",
    })

    expect(mockAuditLogCreate).toHaveBeenCalledWith({
      data: {
        actorId: "emp_456",
        actorType: "EMPLOYER",
        action: "posting.created",
        entityType: "JobPosting",
        entityId: "post_789",
        metadata: { title: "Senior Engineer" },
        ipHash: "abc123hash",
        result: "SUCCESS",
      },
    })
  })

  it("does not throw on DB error (fire-and-forget)", async () => {
    mockAuditLogCreate.mockRejectedValue(new Error("DB connection failed"))

    const { logAudit } = await import("@/lib/audit")

    // Should not throw
    await expect(
      logAudit({
        actorId: "user_123",
        actorType: "SYSTEM",
        action: "cleanup.ran",
        result: "FAILURE",
      }),
    ).resolves.toBeUndefined()
  })
})

describe("hashIp", () => {
  const originalEnv = process.env["AUDIT_IP_SALT"]

  beforeEach(() => {
    vi.clearAllMocks()
  })

  afterEach(() => {
    if (originalEnv !== undefined) {
      process.env["AUDIT_IP_SALT"] = originalEnv
    } else {
      delete process.env["AUDIT_IP_SALT"]
    }
  })

  it("produces deterministic SHA-256 output", async () => {
    process.env["AUDIT_IP_SALT"] = "test-salt-value"

    const { hashIp } = await import("@/lib/audit")
    const hash1 = hashIp("192.168.1.1")
    const hash2 = hashIp("192.168.1.1")

    expect(hash1).toBe(hash2)
    expect(hash1).toMatch(/^[a-f0-9]{64}$/) // SHA-256 hex is 64 chars
  })

  it("produces different hashes for different IPs", async () => {
    process.env["AUDIT_IP_SALT"] = "test-salt-value"

    const { hashIp } = await import("@/lib/audit")
    const hash1 = hashIp("192.168.1.1")
    const hash2 = hashIp("10.0.0.1")

    expect(hash1).not.toBe(hash2)
  })

  it("returns null when no IP provided", async () => {
    process.env["AUDIT_IP_SALT"] = "test-salt-value"

    const { hashIp } = await import("@/lib/audit")

    expect(hashIp(null)).toBeNull()
    expect(hashIp(undefined)).toBeNull()
    expect(hashIp("")).toBeNull()
  })

  it("returns null when AUDIT_IP_SALT not set", async () => {
    delete process.env["AUDIT_IP_SALT"]

    const { hashIp } = await import("@/lib/audit")
    const result = hashIp("192.168.1.1")

    expect(result).toBeNull()
  })
})
