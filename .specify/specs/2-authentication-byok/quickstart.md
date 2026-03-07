# Quickstart & Validation — 2-authentication-byok

**Branch**: `2-authentication-byok`
**Created**: 2026-02-23

This guide describes how to manually validate that the feature is working correctly in a local development environment.

---

## Prerequisites

```bash
# All from Feature 1 setup
pnpm install
pnpm db:migrate          # applies new employer BYOK columns
cp .env.example .env.local   # fill in real values
pnpm dev                 # starts on http://localhost:3000
```

Required `.env.local` values for this feature:

- `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY` — from Clerk dashboard
- `CLERK_SECRET_KEY` — from Clerk dashboard (needed for Clerk Backend SDK)
- `ENCRYPTION_KEY` — 64 hex chars (from `openssl rand -hex 32`)
- `ENCRYPTION_IV_SALT` — any string (from `openssl rand -hex 16`)
- `DATABASE_URL` — NeonDB connection string

---

## Scenario 1: Job Seeker Full Onboarding

**Goal**: New user signs up, selects Job Seeker role, sets up BYOK key, lands on job seeker dashboard.

1. Open `http://localhost:3000/sign-up`
2. Complete Clerk sign-up with email + password (or social)
3. ✅ **Gate 1**: Should be redirected to `/onboarding/role` automatically
4. Select "I'm looking for work" card
5. Click Continue
6. ✅ **Gate 2**: Should be redirected to `/setup/api-key`
7. Select "OpenAI" as provider
8. Read the cost estimate (should show "$2–$8/month" range)
9. Enter a valid OpenAI API key (`sk-proj-...` format)
10. Click Validate & Save
11. ✅ Loading spinner visible during validation (≤ 10 seconds)
12. ✅ Redirected to job seeker dashboard
13. ✅ Job seeker dashboard accessible; employer routes return 403/redirect

---

## Scenario 2: Employer Full Onboarding

**Goal**: New user signs up, selects Employer role, provides company name, sets up BYOK key.

1. Open `http://localhost:3000/sign-up` (use different email/incognito)
2. Complete Clerk sign-up
3. ✅ Redirected to `/onboarding/role`
4. Select "I'm hiring" card
5. ✅ Company name input appears below the card
6. Enter a company name (e.g., "Acme Corp")
7. Click Continue
8. ✅ Redirected to `/setup/api-key`
9. Enter a valid Anthropic API key (`sk-ant-...` format)
10. Click Validate & Save
11. ✅ Redirected to employer dashboard
12. ✅ Employer dashboard accessible; job seeker routes return 403/redirect

---

## Scenario 3: Invalid API Key Rejection

**Goal**: Invalid key is rejected with a clear error; nothing is stored.

1. Complete sign-up and reach `/setup/api-key`
2. Enter a fake key: `sk-invalid-key-that-does-not-exist`
3. Click Validate & Save
4. ✅ Error message displayed: "This API key was not recognized by OpenAI. Please check the key and try again."
5. ✅ Page stays on `/setup/api-key` (not redirected)
6. ✅ Check DB: `SeekerSettings.byokApiKeyEncrypted` should still be null

---

## Scenario 4: Onboarding Gates (Bypass Attempts)

**Goal**: Middleware correctly blocks incomplete users.

1. Log in as user with NO role set (fresh account, `/onboarding/role` not completed)
2. Try to navigate directly to `/seeker/dashboard`
3. ✅ Redirected to `/onboarding/role`

4. Complete role selection but NOT BYOK setup
5. Try to navigate directly to `/employer/dashboard`
6. ✅ Redirected to `/setup/api-key`

7. Complete both steps
8. Try to navigate to `/onboarding/role` again
9. ✅ Redirected away (to `/setup/api-key` or dashboard — not shown the role page again)

---

## Scenario 5: Key Rotation (Settings Page)

**Goal**: User can replace their API key; old key is gone after successful replacement.

1. Log in as a user who has already configured a BYOK key
2. Navigate to `/account/api-key`
3. ✅ Current key status shown: provider name + masked key (e.g., "OpenAI — sk-...xxxx")
4. Click "Replace Key"
5. Enter a new valid key
6. Click Validate & Save
7. ✅ Success: masked key display updates to show new key's last 4 chars
8. ✅ Check DB: `byokApiKeyEncrypted` has changed (different ciphertext)

---

## Scenario 6: Key Deletion

**Goal**: User can delete their key; AI features become inaccessible.

1. Log in as user with BYOK key configured
2. Navigate to `/account/api-key`
3. Click "Delete Key"
4. ✅ Confirmation dialog appears
5. Confirm deletion
6. ✅ Key removed from DB (byokApiKeyEncrypted = null)
7. ✅ Redirected to `/setup/api-key` (hard gate re-engages)
8. Try to navigate to dashboard
9. ✅ Redirected to `/setup/api-key`

---

## Scenario 7: Security — Key Never Exposed

**Goal**: Raw API key never visible in network traffic, logs, or client state.

1. Open browser DevTools → Network tab
2. Complete BYOK key submission (Scenario 1 or 2)
3. Inspect the `byok.storeKey` tRPC request:
   - ✅ Request body contains `apiKey` (sent to server — this is expected)
4. Inspect the `byok.storeKey` tRPC response:
   - ✅ Response body does NOT contain `apiKey` or `byokApiKeyEncrypted`
   - ✅ Response contains only `{ success: true, provider: 'openai', maskedKey: 'sk-...xxxx' }`
5. Open React DevTools → Components
   - ✅ No component state contains the raw API key after submission

---

## Automated Test Run

```bash
# Run all unit tests for this feature
pnpm test tests/unit/server/api/routers/onboarding.test.ts
pnpm test tests/unit/server/api/routers/byok.test.ts
pnpm test tests/unit/middleware.test.ts

# Run integration tests (requires DATABASE_URL)
pnpm test tests/integration/onboarding.test.ts

# Run E2E tests (requires dev server running)
pnpm test:e2e tests/e2e/onboarding.spec.ts
```

---

## Common Issues

| Symptom                                          | Likely Cause                               | Fix                                                            |
| ------------------------------------------------ | ------------------------------------------ | -------------------------------------------------------------- |
| Stuck on `/onboarding/role` after selecting role | Clerk metadata update failed               | Check `CLERK_SECRET_KEY` in `.env.local`                       |
| Provider validation timeout                      | Network issue or API key blocked           | Check key validity on provider dashboard                       |
| Employer dashboard shows 403                     | `clerkOrgId` not set in middleware context | Ensure org creation succeeded and `orgId` is in Clerk session  |
| `/setup/api-key` shows on every login            | `hasByokKey` not updated in Clerk metadata | Check tRPC `storeKey` mutation completes Clerk metadata update |
