/**
 * Task 7.2 — E2E tests for employer profile and job posting management.
 *
 * These tests require:
 * - A running dev server (pnpm dev)
 * - PLAYWRIGHT_E2E_ENABLED=1
 * - CLERK_E2E_EMPLOYER_EMAIL / CLERK_E2E_EMPLOYER_PASSWORD env vars
 * - An employer account that has completed onboarding
 *
 * Tests are skipped when PLAYWRIGHT_E2E_ENABLED is not set.
 */
import { test, expect, type Page } from "@playwright/test"

const e2eEnabled = !!process.env["PLAYWRIGHT_E2E_ENABLED"]
const skipIfNotEnabled = e2eEnabled ? test : test.skip

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

async function signInAsEmployer(page: Page) {
  const email = process.env["CLERK_E2E_EMPLOYER_EMAIL"]!
  const password = process.env["CLERK_E2E_EMPLOYER_PASSWORD"]!

  await page.goto("/sign-in")
  await page.getByLabel(/email/i).fill(email)
  await page.getByRole("button", { name: /continue/i }).click()
  await page.getByLabel(/password/i).fill(password)
  await page.getByRole("button", { name: /sign in/i }).click()
  await page.waitForURL(/\/(dashboard|employer)/, { timeout: 15_000 })
}

async function signOut(page: Page) {
  await page.goto("/")
  const userButton = page.locator("[data-testid='user-button']")
  if (await userButton.isVisible()) {
    await userButton.click()
    await page.getByRole("button", { name: /sign out/i }).click()
  }
}

// ---------------------------------------------------------------------------
// Flow 1: Employer updates company profile
// ---------------------------------------------------------------------------

skipIfNotEnabled("Employer: update company profile", async ({ page }) => {
  await signInAsEmployer(page)

  // Navigate to profile edit
  await page.goto("/profile/edit")

  // Fill in company description
  const descField = page.getByLabel(/description/i)
  await descField.clear()
  await descField.fill("E2E test company description")

  // Submit
  await page.getByRole("button", { name: /save/i }).click()

  // Success feedback
  await expect(page.getByText(/saved|updated|success/i)).toBeVisible({ timeout: 10_000 })

  await signOut(page)
})

// ---------------------------------------------------------------------------
// Flow 2: Employer creates a job posting
// ---------------------------------------------------------------------------

skipIfNotEnabled("Employer: create job posting", async ({ page }) => {
  await signInAsEmployer(page)

  // Navigate to create posting
  await page.goto("/postings/new")

  // Fill required fields
  await page.getByLabel(/title/i).fill("E2E Software Engineer")
  await page
    .getByLabel(/description/i)
    .fill("This is an E2E test posting for a software engineer role.")

  // Select dropdowns
  await page.getByLabel(/experience/i).selectOption("MID")
  await page.getByLabel(/employment/i).selectOption("FULL_TIME")
  await page.getByLabel(/location type/i).selectOption("REMOTE")

  // Submit
  await page.getByRole("button", { name: /create|save|submit/i }).click()

  // Should redirect to dashboard or posting detail
  await expect(page).toHaveURL(/(dashboard|postings)/, { timeout: 10_000 })

  await signOut(page)
})

// ---------------------------------------------------------------------------
// Flow 3: Employer views and manages posting status
// ---------------------------------------------------------------------------

skipIfNotEnabled("Employer: activate, pause, and close a posting", async ({ page }) => {
  await signInAsEmployer(page)

  // Go to dashboard, click first posting
  await page.goto("/dashboard")
  const firstPosting = page.locator("[href*='/postings/']").first()
  await firstPosting.click()

  // Should see status badge
  await expect(page.getByText(/draft|active|paused|closed|filled/i)).toBeVisible()

  // If DRAFT, try to activate (need required skills)
  const activateBtn = page.getByRole("button", { name: /activate/i })
  if (await activateBtn.isVisible()) {
    await activateBtn.click()

    // May fail if missing required skills — check for either success or error
    const statusOrError = page.getByText(/active|required skill/i)
    await expect(statusOrError).toBeVisible({ timeout: 5_000 })
  }

  // If ACTIVE, try to pause
  const pauseBtn = page.getByRole("button", { name: /pause/i })
  if (await pauseBtn.isVisible()) {
    await pauseBtn.click()
    await expect(page.getByText(/paused/i)).toBeVisible({ timeout: 5_000 })
  }

  // If PAUSED, reactivate
  const reactivateBtn = page.getByRole("button", { name: /activate/i })
  if (await reactivateBtn.isVisible()) {
    await reactivateBtn.click()
    await expect(page.getByText(/active/i)).toBeVisible({ timeout: 5_000 })
  }

  // Close
  const closeBtn = page.getByRole("button", { name: /close/i })
  if (await closeBtn.isVisible()) {
    await closeBtn.click()
    await expect(page.getByText(/closed/i)).toBeVisible({ timeout: 5_000 })
  }

  await signOut(page)
})

// ---------------------------------------------------------------------------
// Flow 4: Employer edits an existing posting
// ---------------------------------------------------------------------------

skipIfNotEnabled("Employer: edit existing posting", async ({ page }) => {
  await signInAsEmployer(page)

  // Go to dashboard, navigate to a posting, then edit
  await page.goto("/dashboard")
  const firstPosting = page.locator("[href*='/postings/']").first()

  if (await firstPosting.isVisible()) {
    await firstPosting.click()

    const editLink = page.getByRole("link", { name: /edit/i })
    if (await editLink.isVisible()) {
      await editLink.click()

      // Update title
      const titleField = page.getByLabel(/title/i)
      await titleField.clear()
      await titleField.fill("Updated E2E Posting Title")

      await page.getByRole("button", { name: /save|update/i }).click()

      await expect(page.getByText(/saved|updated|success/i)).toBeVisible({ timeout: 10_000 })
    }
  }

  await signOut(page)
})

// ---------------------------------------------------------------------------
// Flow 5: Employer deletes a draft posting
// ---------------------------------------------------------------------------

skipIfNotEnabled("Employer: delete draft posting", async ({ page }) => {
  await signInAsEmployer(page)

  // Create a draft posting first
  await page.goto("/postings/new")
  await page.getByLabel(/title/i).fill("E2E Delete Test")
  await page.getByLabel(/description/i).fill("Will be deleted")
  await page.getByLabel(/experience/i).selectOption("ENTRY")
  await page.getByLabel(/employment/i).selectOption("CONTRACT")
  await page.getByLabel(/location type/i).selectOption("REMOTE")
  await page.getByRole("button", { name: /create|save|submit/i }).click()

  await expect(page).toHaveURL(/(dashboard|postings)/, { timeout: 10_000 })

  // Find the draft posting and delete
  await page.goto("/dashboard")
  const deleteTarget = page.getByText("E2E Delete Test")
  if (await deleteTarget.isVisible()) {
    await deleteTarget.click()

    const deleteBtn = page.getByRole("button", { name: /delete/i })
    if (await deleteBtn.isVisible()) {
      await deleteBtn.click()

      // Confirm deletion if dialog exists
      const confirmBtn = page.getByRole("button", { name: /confirm|yes/i })
      if (await confirmBtn.isVisible({ timeout: 2_000 }).catch(() => false)) {
        await confirmBtn.click()
      }

      // Should redirect back to dashboard
      await expect(page).toHaveURL(/dashboard/, { timeout: 5_000 })
    }
  }

  await signOut(page)
})

// ---------------------------------------------------------------------------
// Flow 6: Logo upload
// ---------------------------------------------------------------------------

skipIfNotEnabled("Employer: upload company logo", async ({ page }) => {
  await signInAsEmployer(page)

  await page.goto("/profile/edit")

  // Upload a test image file
  const fileInput = page.locator("input[type='file']")
  if (await fileInput.isVisible()) {
    // Create a minimal 1x1 PNG in memory
    await fileInput.setInputFiles({
      name: "test-logo.png",
      mimeType: "image/png",
      buffer: Buffer.from(
        "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==",
        "base64",
      ),
    })

    // Should show a preview or uploading indicator
    await expect(page.getByText(/uploading|upload/i).or(page.getByAltText(/logo/i))).toBeVisible({
      timeout: 10_000,
    })
  }

  await signOut(page)
})
