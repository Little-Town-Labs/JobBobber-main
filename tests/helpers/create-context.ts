/**
 * tRPC context factories for test scaffolding.
 *
 * Each factory returns a mock context object matching what tRPC middleware
 * injects into procedure handlers.
 *
 * @see tests/helpers/create-entities.test.ts
 */
import { vi } from "vitest"
import { createMockJobSeeker, createMockEmployer } from "./create-entities"

function createMockDb() {
  return {
    jobSeeker: { findUnique: vi.fn(), findMany: vi.fn(), create: vi.fn(), update: vi.fn() },
    employer: { findUnique: vi.fn(), findMany: vi.fn(), create: vi.fn(), update: vi.fn() },
    jobPosting: {
      findUnique: vi.fn(),
      findMany: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      count: vi.fn(),
    },
    match: {
      findUnique: vi.fn(),
      findMany: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      count: vi.fn(),
      groupBy: vi.fn(),
    },
    agentConversation: { findMany: vi.fn() },
    seekerSettings: { findUnique: vi.fn(), upsert: vi.fn() },
    jobSettings: { findUnique: vi.fn(), upsert: vi.fn() },
  }
}

export function createMockProtectedContext(overrides?: Record<string, unknown>) {
  return {
    userId: "user-test-123",
    orgId: null,
    orgRole: null,
    userRole: null,
    db: createMockDb(),
    ...overrides,
  }
}

export function createMockSeekerContext(overrides?: Record<string, unknown>) {
  const seeker = createMockJobSeeker()
  return {
    userId: seeker.clerkUserId,
    orgId: null,
    orgRole: null,
    userRole: "JOB_SEEKER" as const,
    seeker,
    db: createMockDb(),
    ...overrides,
  }
}

export function createMockEmployerContext(overrides?: Record<string, unknown>) {
  const employer = createMockEmployer()
  return {
    userId: "user-emp-123",
    orgId: employer.clerkOrgId,
    orgRole: "org:member" as const,
    userRole: "EMPLOYER" as const,
    employer,
    db: createMockDb(),
    ...overrides,
  }
}

export function createMockAdminContext(overrides?: Record<string, unknown>) {
  const employer = createMockEmployer()
  return {
    userId: "user-admin-123",
    orgId: employer.clerkOrgId,
    orgRole: "org:admin" as const,
    userRole: "EMPLOYER" as const,
    employer,
    db: createMockDb(),
    ...overrides,
  }
}

export function createMockOnboardingContext(overrides?: Record<string, unknown>) {
  return {
    userId: "user-onboard-123",
    orgId: null,
    orgRole: null,
    userRole: null,
    db: createMockDb(),
    ...overrides,
  }
}
