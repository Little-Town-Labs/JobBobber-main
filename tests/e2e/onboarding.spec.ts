/**
 * T5.3 — E2E tests for the onboarding flow and BYOK key management.
 *
 * These tests require:
 * - A running dev server (pnpm dev)
 * - A real Clerk test tenant with configured test users
 * - PLAYWRIGHT_BASE_URL set to the dev server URL
 * - CLERK_E2E_SEEKER_EMAIL / CLERK_E2E_SEEKER_PASSWORD env vars
 * - CLERK_E2E_EMPLOYER_EMAIL / CLERK_E2E_EMPLOYER_PASSWORD env vars
 * - OPENAI_E2E_TEST_KEY — a valid key for provider verification tests
 *
 * Tests are skipped when PLAYWRIGHT_E2E_ENABLED is not set.
 *
 * @see .specify/specs/2-authentication-byok/quickstart.md — manual validation guide
 */
import { test, expect, type Page } from "@playwright/test"

const e2eEnabled = !!process.env["PLAYWRIGHT_E2E_ENABLED"]
const skipIfNotEnabled = e2eEnabled ? test : test.skip

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

async function signIn(page: Page, email: string, password: string) {
  await page.goto("/sign-in")
  await page.getByLabel(/email/i).fill(email)
  await page.getByRole("button", { name: /continue/i }).click()
  await page.getByLabel(/password/i).fill(password)
  await page.getByRole("button", { name: /sign in/i }).click()
  await page.waitForURL(/\/(onboarding|setup|dashboard|employer)/)
}

async function signOut(page: Page) {
  // Clerk provides a sign-out button in the UserButton component
  await page.goto("/")
  const userButton = page.locator("[data-testid='user-button']")
  if (await userButton.isVisible()) {
    await userButton.click()
    await page.getByRole("button", { name: /sign out/i }).click()
  }
}

// ---------------------------------------------------------------------------
// Flow 1: Job Seeker full onboarding
// ---------------------------------------------------------------------------

skipIfNotEnabled("Job Seeker: full onboarding flow", async ({ page }) => {
  const email = process.env["CLERK_E2E_SEEKER_EMAIL"]!
  const password = process.env["CLERK_E2E_SEEKER_PASSWORD"]!
  const apiKey = process.env["OPENAI_E2E_TEST_KEY"]!

  await signIn(page, email, password)

  // Step 1: Role selection
  await page.waitForURL(/\/onboarding\/role/)
  await page.getByLabel(/job seeker/i).click()
  await page.getByRole("button", { name: /continue/i }).click()

  // Step 2: BYOK setup
  await page.waitForURL(/\/setup\/api-key/)
  await page.getByLabel(/api key/i).fill(apiKey)
  await page.getByRole("button", { name: /save/i }).click()

  // Should redirect to dashboard after completing onboarding
  await expect(page).toHaveURL(/dashboard/, { timeout: 15_000 })

  await signOut(page)
})

// ---------------------------------------------------------------------------
// Flow 2: Employer full onboarding
// ---------------------------------------------------------------------------

skipIfNotEnabled("Employer: full onboarding flow with company name", async ({ page }) => {
  const email = process.env["CLERK_E2E_EMPLOYER_EMAIL"]!
  const password = process.env["CLERK_E2E_EMPLOYER_PASSWORD"]!
  const apiKey = process.env["OPENAI_E2E_TEST_KEY"]!

  await signIn(page, email, password)

  // Step 1: Role selection — choose Employer
  await page.waitForURL(/\/onboarding\/role/)
  await page.getByLabel(/employer/i).click()
  const companyNameInput = page.getByLabel(/company name/i)
  await expect(companyNameInput).toBeVisible()
  await companyNameInput.fill("E2E Test Corp")
  await page.getByRole("button", { name: /continue/i }).click()

  // Step 2: BYOK setup
  await page.waitForURL(/\/setup\/api-key/)
  await page.getByLabel(/api key/i).fill(apiKey)
  await page.getByRole("button", { name: /save/i }).click()

  await expect(page).toHaveURL(/employer|dashboard/, { timeout: 15_000 })

  await signOut(page)
})

// ---------------------------------------------------------------------------
// Flow 3: Invalid API key shows error — nothing stored
// ---------------------------------------------------------------------------

skipIfNotEnabled("BYOK: invalid API key shows error message", async ({ page }) => {
  const email = process.env["CLERK_E2E_SEEKER_EMAIL"]!
  const password = process.env["CLERK_E2E_SEEKER_PASSWORD"]!

  await signIn(page, email, password)
  await page.waitForURL(/\/setup\/api-key/)

  await page.getByLabel(/api key/i).fill("sk-proj-totallyinvalidkey12345")
  await page.getByRole("button", { name: /save/i }).click()

  // Error alert should appear
  await expect(page.getByRole("alert")).toBeVisible({ timeout: 10_000 })

  // URL should not have changed (still on setup page)
  await expect(page).toHaveURL(/\/setup\/api-key/)

  await signOut(page)
})

// ---------------------------------------------------------------------------
// Flow 4: Gate bypass — navigating directly to dashboard requires onboarding
// ---------------------------------------------------------------------------

skipIfNotEnabled("Gate: unauthenticated user is redirected to sign-in", async ({ page }) => {
  await page.goto("/")
  // Should be redirected to Clerk sign-in
  await expect(page).toHaveURL(/sign-in|\/sign-in/, { timeout: 5_000 })
})

skipIfNotEnabled(
  "Gate: user without role cannot access dashboard (redirected to role selection)",
  async ({ page }) => {
    // This test requires a fresh user account with no role set
    // It validates the middleware onboarding gate
    const email = process.env["CLERK_E2E_SEEKER_EMAIL"]!
    const password = process.env["CLERK_E2E_SEEKER_PASSWORD"]!

    await signIn(page, email, password)

    // Attempt to navigate directly to dashboard
    await page.goto("/dashboard")

    // Should be redirected to role selection (or setup step 1)
    await expect(page).toHaveURL(/\/onboarding\/role/, { timeout: 5_000 })

    await signOut(page)
  },
)

// ---------------------------------------------------------------------------
// Flow 5: Key replacement via account settings
// ---------------------------------------------------------------------------

skipIfNotEnabled("Account settings: replace API key", async ({ page }) => {
  const email = process.env["CLERK_E2E_SEEKER_EMAIL"]!
  const password = process.env["CLERK_E2E_SEEKER_PASSWORD"]!
  const apiKey = process.env["OPENAI_E2E_TEST_KEY"]!

  await signIn(page, email, password)

  // Navigate to account API key settings
  await page.goto("/account/api-key")

  // If a key is present, click Change; if not, form should already be visible
  const changeButton = page.getByRole("button", { name: /change/i })
  if (await changeButton.isVisible()) {
    await changeButton.click()
  }

  await page.getByLabel(/api key/i).fill(apiKey)
  await page.getByRole("button", { name: /save/i }).click()

  // Masked key should now be visible in the UI
  await expect(page.getByText(/sk-/)).toBeVisible({ timeout: 10_000 })

  await signOut(page)
})

// ---------------------------------------------------------------------------
// Flow 6: Key deletion
// ---------------------------------------------------------------------------

skipIfNotEnabled("Account settings: delete API key", async ({ page }) => {
  const email = process.env["CLERK_E2E_SEEKER_EMAIL"]!
  const password = process.env["CLERK_E2E_SEEKER_PASSWORD"]!

  await signIn(page, email, password)

  await page.goto("/account/api-key")

  // Click delete
  await page.getByRole("button", { name: /delete/i }).click()

  // After deletion the add-key form should appear
  await expect(page.getByText(/no api key configured/i)).toBeVisible({ timeout: 5_000 })

  await signOut(page)
})

// ---------------------------------------------------------------------------
// Flow 7: Role enforcement — job seeker cannot access employer routes
// ---------------------------------------------------------------------------

skipIfNotEnabled("Role enforcement: job seeker cannot access employer routes", async ({ page }) => {
  const email = process.env["CLERK_E2E_SEEKER_EMAIL"]!
  const password = process.env["CLERK_E2E_SEEKER_PASSWORD"]!

  await signIn(page, email, password)

  // Attempt to access an employer-only route
  await page.goto("/employer/dashboard")

  // Should be redirected or get a 403/forbidden response
  const url = page.url()
  const isForbiddenOrRedirected =
    url.includes("forbidden") ||
    url.includes("dashboard") === false ||
    url.includes("employer") === false

  expect(isForbiddenOrRedirected || (await page.title()).toLowerCase().includes("403")).toBe(true)

  await signOut(page)
})
