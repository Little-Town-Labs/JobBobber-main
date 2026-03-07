/**
 * Feature 8: Private Negotiation Parameters — E2E Test Stubs
 *
 * Gated behind PLAYWRIGHT_E2E_ENABLED env var.
 * These stubs validate critical user flows when a real Clerk session is available.
 */
import { test, expect } from "@playwright/test"

const E2E_ENABLED = process.env.PLAYWRIGHT_E2E_ENABLED === "true"

test.describe("Private Settings E2E", () => {
  test.skip(!E2E_ENABLED, "E2E tests require PLAYWRIGHT_E2E_ENABLED=true")

  test("seeker can save and reload private settings", async ({ page }) => {
    // TODO: Authenticate as seeker via Clerk
    await page.goto("/settings/private")

    await expect(page.getByTestId("seeker-private-settings-form")).toBeVisible()
    await expect(page.getByTestId("privacy-notice")).toContainText("never shared with employers")

    await page.fill("#minSalary", "120000")
    await page.fill("#dealBreakers", "No relocation")
    await page.click('button[type="submit"]')

    await expect(page.getByText("Settings saved successfully")).toBeVisible()

    // Reload and verify persistence
    await page.reload()
    await expect(page.locator("#minSalary")).toHaveValue("120000")
  })

  test("employer can save and reload per-posting settings", async ({ page }) => {
    // TODO: Authenticate as employer via Clerk, navigate to a posting
    await page.goto("/postings/test-posting-id/settings")

    await expect(page.getByTestId("job-settings-form")).toBeVisible()
    await expect(page.getByTestId("privacy-notice")).toContainText("never shared with candidates")

    await page.fill("#trueMaxSalary", "180000")
    await page.selectOption("#urgency", "HIGH")
    await page.click('button[type="submit"]')

    await expect(page.getByText("Settings saved successfully")).toBeVisible()
  })

  test("settings page shows unavailable message when flag OFF", async ({ page }) => {
    // This test requires PRIVATE_PARAMS flag to be OFF
    // TODO: Configure flag state for test environment
    await page.goto("/settings/private")
    await expect(page.getByText("not yet available")).toBeVisible()
  })
})
