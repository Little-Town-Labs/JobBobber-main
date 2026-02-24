# Data Model — 2-authentication-byok

**Branch**: `2-authentication-byok`
**Created**: 2026-02-23

This document describes the data model changes required for Feature 2. The base schema was established in Feature 1 (`prisma/schema.prisma`). This feature requires one additive migration.

---

## Schema Changes

### New `onboardingProcedure` tier in tRPC (not a schema change)

The existing `protectedProcedure` requires `ctx.userRole` to already exist — it cannot be used for procedures that create the role. A new `onboardingProcedure` tier must be added to `src/server/api/trpc.ts`:

```typescript
// Requires userId only — userRole may be null
export const onboardingProcedure = t.procedure.use(
  t.middleware(({ ctx, next }) => {
    if (!ctx.userId) throw new TRPCError({ code: "UNAUTHORIZED" })
    return next({ ctx: { ...ctx, userId: ctx.userId } })
  }),
)
```

Used by: `onboarding.setRole` and `byok.storeKey` (called before role/BYOK exist).

---

### New Fields on `Employer` Model

The `Employer` model needs account-level BYOK key storage to support the onboarding hard gate before any job postings exist.

```prisma
model Employer {
  // ... existing fields ...

  // NEW: Account-level BYOK key (encrypted).
  // Stores the employer's default LLM API key for all agent operations.
  // Never returned in any API response — write-only after submission.
  // Feature 4 may override at the job-posting level via JobSettings.
  byokApiKeyEncrypted String?   // AES-256-GCM encrypted via src/lib/encryption.ts
  byokProvider        String?   // 'openai' | 'anthropic'
  byokKeyValidatedAt  DateTime? // Timestamp of last successful validation
  byokMaskedKey       String?   // last 4 chars of plaintext: "sk-...xxxx" — non-sensitive display value
}
```

**Migration**: Additive — nullable columns, no data migration required. Safe to run on live database.

**No other schema changes** are required. The `SeekerSettings` table already has `byokApiKeyEncrypted` and `byokProvider` fields (established in Feature 1).

---

## Clerk Metadata Structure

Clerk user `publicMetadata` stores two fields managed by this feature:

```typescript
interface ClerkUserPublicMetadata {
  role?: "JOB_SEEKER" | "EMPLOYER" // set during /onboarding/role
  hasByokKey?: boolean // set to true after BYOK key stored; false after deletion
}
```

These values are available in:

- **Server (tRPC context)**: `sessionClaims.metadata.role` and `sessionClaims.metadata.hasByokKey`
- **Middleware**: `auth().sessionClaims.metadata.role` — used for redirect gates
- **Client**: via `useUser().user.publicMetadata` (Clerk React hooks)

---

## Entities Managed by This Feature

### `JobSeeker` (created during role selection for JOB_SEEKER role)

| Field         | Value at Creation       | Source                                           |
| ------------- | ----------------------- | ------------------------------------------------ |
| `clerkUserId` | From Clerk session      | `auth().userId`                                  |
| `name`        | From Clerk user profile | `user.fullName ?? user.firstName ?? 'Anonymous'` |
| `skills`      | `[]`                    | Default                                          |
| `urls`        | `[]`                    | Default                                          |

A `SeekerSettings` row is also created immediately after `JobSeeker` creation (empty — all fields nullable).

### `SeekerSettings` (BYOK key storage for job seekers)

| Field                 | Updated by                                             |
| --------------------- | ------------------------------------------------------ |
| `byokApiKeyEncrypted` | `byok.storeKey` mutation (encrypted value)             |
| `byokProvider`        | `byok.storeKey` mutation (`'openai'` or `'anthropic'`) |

### `Employer` (created during role selection for EMPLOYER role)

| Field            | Value at Creation                     | Source                     |
| ---------------- | ------------------------------------- | -------------------------- |
| `clerkOrgId`     | From newly created Clerk Organization | Clerk Backend SDK response |
| `name`           | Company name from form input          | User-provided              |
| All other fields | `null` / `[]` / `{}`                  | Defaults                   |

### `EmployerMember` (join record — employer admin)

| Field         | Value                          |
| ------------- | ------------------------------ |
| `employerId`  | ID of newly created `Employer` |
| `clerkUserId` | From Clerk session             |
| `role`        | `ADMIN`                        |
| `invitedBy`   | `null` (self-registered)       |

### `Employer` (BYOK key storage for employers — new fields)

| Field                 | Updated by                                 |
| --------------------- | ------------------------------------------ |
| `byokApiKeyEncrypted` | `byok.storeKey` mutation (encrypted value) |
| `byokProvider`        | `byok.storeKey` mutation                   |
| `byokKeyValidatedAt`  | `byok.storeKey` mutation (timestamp)       |

---

## Data Flow: Role Selection

```
POST /api/trpc/onboarding.setRole
  ├── Input: { role: 'JOB_SEEKER', name?: string }
  │     └── Creates: JobSeeker + SeekerSettings
  │           └── Updates Clerk: publicMetadata.role = 'JOB_SEEKER'
  │
  └── Input: { role: 'EMPLOYER', companyName: string }
        └── Creates: Clerk Org → Employer → EmployerMember (ADMIN)
              └── Updates Clerk: publicMetadata.role = 'EMPLOYER'
```

## Data Flow: BYOK Key Storage

```
POST /api/trpc/byok.storeKey
  ├── Input: { provider: 'openai', apiKey: 'sk-...' }
  │
  ├── Validates: GET https://api.openai.com/v1/models (key → header)
  │
  ├── Encrypts: encrypt(apiKey, userId) → base64 ciphertext
  │
  ├── Stores (JOB_SEEKER):
  │     SeekerSettings.byokApiKeyEncrypted = ciphertext
  │     SeekerSettings.byokProvider = 'openai'
  │
  ├── Stores (EMPLOYER):
  │     Employer.byokApiKeyEncrypted = ciphertext
  │     Employer.byokProvider = 'openai'
  │     Employer.byokKeyValidatedAt = now()
  │
  └── Updates Clerk: publicMetadata.hasByokKey = true
```

## Data Flow: BYOK Key Deletion

```
POST /api/trpc/byok.deleteKey
  ├── Clears (JOB_SEEKER): SeekerSettings.byokApiKeyEncrypted = null, byokProvider = null
  ├── Clears (EMPLOYER):   Employer.byokApiKeyEncrypted = null, byokProvider = null
  └── Updates Clerk: publicMetadata.hasByokKey = false
```

---

## Indexes

No new indexes required. Existing indexes cover all query patterns for this feature:

- `JobSeeker.clerkUserId` — unique index (established in Feature 1)
- `Employer.clerkOrgId` — unique index (established in Feature 1)
- `EmployerMember.[employerId, clerkUserId]` — unique composite (established in Feature 1)

---

## Privacy Invariants

The following invariants are enforced at the tRPC procedure level and must never be violated:

1. `SeekerSettings.byokApiKeyEncrypted` — NEVER returned in any API response. The `getKeyStatus` query returns only `{ hasKey: boolean, provider, maskedKey }`.
2. `Employer.byokApiKeyEncrypted` — same invariant.
3. The encryption key (`ENCRYPTION_KEY` env var) and IV salt (`ENCRYPTION_IV_SALT`) are server-only — never accessible client-side.
4. The `userId` used as the HMAC input for IV derivation is the Clerk `userId` string — stable per user, never rotated.

---

## Prisma Migration (to be generated)

```bash
# After adding fields to schema.prisma:
pnpm db:migrate --name add_employer_byok_fields
```

Expected migration SQL (auto-generated by Prisma):

```sql
ALTER TABLE "employers"
  ADD COLUMN "byok_api_key_encrypted" TEXT,
  ADD COLUMN "byok_provider"          TEXT,
  ADD COLUMN "byok_key_validated_at"  TIMESTAMP(3);
```
