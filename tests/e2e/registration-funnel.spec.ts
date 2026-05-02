/**
 * T5.1 — E2E tests for the registration funnel.
 *
 * Funnel: `/` (landing) → `/sign-up` (Clerk) → `/onboarding/role`
 *         → `/setup/api-key` (BYOK) → `/welcome`
 *
 * These tests require:
 * - A running dev server (pnpm dev)
 * - A real Clerk test tenant with configured test users
 * - PLAYWRIGHT_BASE_URL set to the dev server URL
 * - CLERK_E2E_SEEKER_EMAIL / CLERK_E2E_SEEKER_PASSWORD env vars
 *
 * Tests are skipped when PLAYWRIGHT_E2E_ENABLED is not set.
 *
 * NOTE: These tests are intentionally in RED state — the /welcome page UI
 * has not been built yet. This is the TDD RED phase.
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
  await page.waitForURL(/\/(onboarding|setup|welcome)/)
}

// ---------------------------------------------------------------------------
// Feature area 1: Landing page
// ---------------------------------------------------------------------------

test.describe("Landing page", () => {
  skipIfNotEnabled("hero section is visible", async ({ page }) => {
    await page.goto("/")
    const hero = page.locator("[data-testid='hero']")
    await expect(hero).toBeVisible()
  })

  skipIfNotEnabled('"Get started free" CTA links to /sign-up', async ({ page }) => {
    await page.goto("/")
    const cta = page.getByRole("link", { name: /get started free/i })
    await expect(cta).toBeVisible()
    await expect(cta).toHaveAttribute("href", /\/sign-up/)
  })
})

// ---------------------------------------------------------------------------
// Feature area 2: /welcome — first visit (no key generated yet)
// ---------------------------------------------------------------------------

test.describe("/welcome — first visit", () => {
  skipIfNotEnabled(
    '"Generate your API key" button is visible and no key is auto-generated on load',
    async ({ page }) => {
      const email = process.env["CLERK_E2E_SEEKER_EMAIL"]!
      const password = process.env["CLERK_E2E_SEEKER_PASSWORD"]!

      await signIn(page, email, password)

      // Complete role step if redirected there first
      if (page.url().includes("/onboarding/role")) {
        await page.getByLabel(/job seeker/i).click()
        await page.getByRole("button", { name: /continue/i }).click()
        await page.waitForURL(/\/(setup|welcome)/)
      }

      // Skip BYOK setup step if present (navigate directly to welcome)
      await page.goto("/welcome")
      await page.waitForURL(/\/welcome/)

      // The generate button must be present
      const generateButton = page.getByRole("button", { name: /generate your api key/i })
      await expect(generateButton).toBeVisible()

      // No masked key should be displayed on first load
      const maskedKey = page.locator("[data-testid='masked-api-key']")
      await expect(maskedKey).not.toBeVisible()
    },
  )
})

// ---------------------------------------------------------------------------
// Feature area 3: /welcome — after key is generated
// ---------------------------------------------------------------------------

test.describe("/welcome — after key is generated", () => {
  skipIfNotEnabled(
    "shows masked key starting with jb_live_, copy button, and one-time warning",
    async ({ page }) => {
      const email = process.env["CLERK_E2E_SEEKER_EMAIL"]!
      const password = process.env["CLERK_E2E_SEEKER_PASSWORD"]!

      await signIn(page, email, password)

      // Navigate to welcome and trigger key generation
      await page.goto("/welcome")
      await page.waitForURL(/\/welcome/)

      const generateButton = page.getByRole("button", { name: /generate your api key/i })
      await generateButton.click()

      // Masked key must start with jb_live_
      const maskedKey = page.locator("[data-testid='masked-api-key']")
      await expect(maskedKey).toBeVisible({ timeout: 10_000 })
      const keyText = await maskedKey.textContent()
      expect(keyText).toMatch(/jb_live_/)

      // Copy button must be present
      const copyButton = page.getByRole("button", { name: /copy/i })
      await expect(copyButton).toBeVisible()

      // One-time warning must be displayed
      await expect(page.getByText(/this key will not be shown again/i)).toBeVisible()
    },
  )
})

// ---------------------------------------------------------------------------
// Feature area 4: /welcome — revisit after key already exists
// ---------------------------------------------------------------------------

test.describe("/welcome — revisit after key exists", () => {
  skipIfNotEnabled(
    "shows key management list with masked prefix, not the generate button",
    async ({ page }) => {
      const email = process.env["CLERK_E2E_SEEKER_EMAIL"]!
      const password = process.env["CLERK_E2E_SEEKER_PASSWORD"]!

      await signIn(page, email, password)

      // First visit: generate a key
      await page.goto("/welcome")
      await page.waitForURL(/\/welcome/)

      const generateButton = page.getByRole("button", { name: /generate your api key/i })
      if (await generateButton.isVisible()) {
        await generateButton.click()
        await expect(page.locator("[data-testid='masked-api-key']")).toBeVisible({
          timeout: 10_000,
        })
      }

      // Revisit the page
      await page.goto("/welcome")
      await page.waitForURL(/\/welcome/)

      // Key management list (masked prefix) should be shown
      const keyList = page.locator("[data-testid='api-key-list']")
      await expect(keyList).toBeVisible()

      // Generate button must NOT be visible on revisit
      await expect(page.getByRole("button", { name: /generate your api key/i })).not.toBeVisible()
    },
  )
})

// ---------------------------------------------------------------------------
// Feature area 5: /docs link on /welcome
// ---------------------------------------------------------------------------

test.describe("/welcome — docs navigation", () => {
  skipIfNotEnabled(
    "docs link is visible on /welcome and navigates to the docs page",
    async ({ page }) => {
      const email = process.env["CLERK_E2E_SEEKER_EMAIL"]!
      const password = process.env["CLERK_E2E_SEEKER_PASSWORD"]!

      await signIn(page, email, password)

      await page.goto("/welcome")
      await page.waitForURL(/\/welcome/)

      const docsLink = page.getByRole("link", { name: /docs/i })
      await expect(docsLink).toBeVisible()

      await docsLink.click()
      await expect(page).toHaveURL(/\/docs/, { timeout: 10_000 })
    },
  )
})
