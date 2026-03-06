/**
 * E2E tests for match dashboard critical flows.
 *
 * Tests require a running dev server and Clerk test credentials.
 * Skipped when PLAYWRIGHT_E2E_ENABLED is not set.
 *
 * @see .specify/specs/7-testing-infrastructure/spec.md — US-4
 */
import { test, expect, type Page } from "@playwright/test"

const e2eEnabled = !!process.env["PLAYWRIGHT_E2E_ENABLED"]
const skipIfNotEnabled = e2eEnabled ? test : test.skip

async function signIn(page: Page, email: string, password: string) {
  await page.goto("/sign-in")
  await page.getByLabel(/email/i).fill(email)
  await page.getByRole("button", { name: /continue/i }).click()
  await page.getByLabel(/password/i).fill(password)
  await page.getByRole("button", { name: /sign in/i }).click()
  await page.waitForURL(/\/(seeker|employer|dashboard)/)
}

// ---------------------------------------------------------------------------
// Flow 1: Unauthenticated redirect
// ---------------------------------------------------------------------------

skipIfNotEnabled("Unauthenticated user redirected from /matches", async ({ page }) => {
  await page.goto("/seeker/matches")
  // Clerk middleware should redirect to sign-in
  await expect(page).toHaveURL(/sign-in/, { timeout: 5_000 })
})

// ---------------------------------------------------------------------------
// Flow 2: Seeker views matches dashboard
// ---------------------------------------------------------------------------

skipIfNotEnabled("Seeker can view matches dashboard", async ({ page }) => {
  const email = process.env["CLERK_E2E_SEEKER_EMAIL"]!
  const password = process.env["CLERK_E2E_SEEKER_PASSWORD"]!

  await signIn(page, email, password)
  await page.goto("/seeker/matches")

  // Should render the matches page with status tabs
  await expect(page.getByRole("tablist")).toBeVisible({ timeout: 10_000 })
  await expect(page.getByRole("tab", { name: /all/i })).toBeVisible()
  await expect(page.getByRole("tab", { name: /pending/i })).toBeVisible()
})

// ---------------------------------------------------------------------------
// Flow 3: Employer views posting matches
// ---------------------------------------------------------------------------

skipIfNotEnabled("Employer can view matches for a job posting", async ({ page }) => {
  const email = process.env["CLERK_E2E_EMPLOYER_EMAIL"]!
  const password = process.env["CLERK_E2E_EMPLOYER_PASSWORD"]!

  await signIn(page, email, password)

  // Navigate to postings list first
  await page.goto("/postings")

  // Click first posting's matches link (if any postings exist)
  const matchesLink = page.getByRole("link", { name: /matches/i }).first()
  if (await matchesLink.isVisible({ timeout: 5_000 }).catch(() => false)) {
    await matchesLink.click()

    // Should show match list with filter tabs
    await expect(page.getByRole("tablist")).toBeVisible({ timeout: 10_000 })
  }
})

// ---------------------------------------------------------------------------
// Flow 4: Match accept/decline updates UI
// ---------------------------------------------------------------------------

skipIfNotEnabled("Accept/decline updates match card status", async ({ page }) => {
  const email = process.env["CLERK_E2E_SEEKER_EMAIL"]!
  const password = process.env["CLERK_E2E_SEEKER_PASSWORD"]!

  await signIn(page, email, password)
  await page.goto("/seeker/matches")

  // Wait for match list to load
  await page.waitForSelector("[data-testid='match-card'], [data-testid='matches-empty']", {
    timeout: 10_000,
  })

  // If matches exist, try accepting the first one
  const acceptButton = page.getByRole("button", { name: /accept/i }).first()
  if (await acceptButton.isVisible({ timeout: 3_000 }).catch(() => false)) {
    await acceptButton.click()

    // The card should reflect the updated status
    await expect(page.getByText(/accepted/i).first()).toBeVisible({ timeout: 5_000 })
  }
})
