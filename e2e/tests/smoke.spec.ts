import { test, expect } from "@playwright/test"

test("landing page mounts", async ({ page }) => {
	const response = await page.goto("/")
	expect(response?.ok()).toBeTruthy()
	await expect(page.getByRole("heading", { level: 1 })).toContainText(
		"Protect tomorrow's",
	)
})

test("connect page lists the personas", async ({ page }) => {
	await page.goto("/")
	await page.getByRole("button", { name: "Launch App" }).first().click()
	for (const name of ["Manufacturer", "Foundry", "Liquidity Provider", "Operator"])
		await expect(page.getByText(name, { exact: true }).first()).toBeVisible()
})

test("corporate terminal shows the quote form", async ({ page }) => {
	await page.goto("/app/manufacturer")
	await expect(page.getByText("Notional Amount (EUR)")).toBeVisible()
	await expect(page.getByRole("button", { name: /Receive EUR/ })).toBeVisible()
	await expect(page.getByRole("button", { name: /Lock Rate/ })).toBeVisible()
})

test("liquidity vault terminal shows the KPIs", async ({ page }) => {
	await page.goto("/app/lp")
	await expect(page.getByText("Total Value Locked")).toBeVisible()
	await expect(page.getByText("Net Exposure Allocation")).toBeVisible()
})

test("pricing section shows the fees from the contract", async ({ page }) => {
	await page.goto("/")
	await page.getByRole("link", { name: "Pricing" }).click()
	await expect(page.getByRole("heading", { name: "Transparent pricing" })).toBeVisible()
	await expect(page.getByText("0.15%").first()).toBeVisible({ timeout: 15_000 })
})

test("about section and technology band", async ({ page }) => {
	await page.goto("/")
	await page.getByRole("link", { name: "About" }).click()
	await expect(page.getByRole("heading", { name: "About Zepho" })).toBeVisible()
	await expect(page.getByText("Reflector", { exact: true }).first()).toBeAttached()
})
