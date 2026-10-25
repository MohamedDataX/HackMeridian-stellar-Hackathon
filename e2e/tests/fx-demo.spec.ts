import { test, expect, type Browser, type Page } from "@playwright/test"
import { Keypair } from "@stellar/stellar-sdk"
import { connectFakeFreighter } from "../util/fake-freighter"

/**
 * The full demo, in the browser, against the contracts on testnet: deposit,
 * two opposite hedges, a euro dip with a margin call and a top-up, then the
 * fixing and the settlements.
 *
 * Real transactions: it runs only with the demo accounts' secret keys, e.g.
 *   FX_E2E=1 FX_ADMIN=$(stellar keys show admin) ... npx playwright test fx-demo
 */
const SECRETS = {
	operator: process.env.FX_ADMIN,
	manufacturer: process.env.FX_FABRICANT,
	foundry: process.env.FX_FONDEUR,
	provider: process.env.FX_APPORTEUR,
}

test.skip(
	!process.env.FX_E2E || Object.values(SECRETS).some((s) => !s),
	"testnet demo: set FX_E2E=1 and the FX_* secret keys",
)

const MATURITY_MINUTES = 4

async function actor(browser: Browser, secret: string) {
	const page = await browser.newPage()
	await connectFakeFreighter(page, Keypair.fromSecret(secret), {
		onSign: "approve",
	})
	return page
}

/** Click and wait for the action's success notification. */
async function act(page: Page, button: RegExp | string, label: string) {
	await page.getByRole("button", { name: button }).first().click()
	await expect(page.getByText(`${label}: done`).last()).toBeVisible({
		timeout: 60_000,
	})
}

test("hedge, margin call, top-up, fixing and settlement", async ({
	browser,
}) => {
	test.setTimeout(12 * 60_000)
	const operator = await actor(browser, SECRETS.operator!)
	const manufacturer = await actor(browser, SECRETS.manufacturer!)
	const foundry = await actor(browser, SECRETS.foundry!)
	const provider = await actor(browser, SECRETS.provider!)

	// Operator: real Reflector rate, maturity a few minutes away priced as 360 days
	await operator.goto("/demo")
	await act(operator, "Back to Reflector", "Back to Reflector")
	await operator.getByLabel("In (minutes)").fill(String(MATURITY_MINUTES))
	await operator.getByLabel("Priced as (days)").fill("360")
	await act(operator, "Open maturity", "Open maturity")
	const maturityOpenedAt = Date.now()

	// Liquidity provider deposits
	await provider.goto("/vault")
	await provider.getByLabel("Amount (USDC)").fill("1000000")
	await act(provider, /^Deposit$/, "Deposit")

	// Two opposite hedges on the new maturity (the first open one)
	await manufacturer.goto("/")
	await manufacturer.getByRole("button", { name: /I receive EUR/ }).click()
	await expect(manufacturer.getByRole("button", { name: /^Lock/ })).toBeVisible({
		timeout: 30_000,
	})
	await act(manufacturer, /^Lock/, "Hedge")

	await foundry.goto("/")
	await foundry.getByRole("button", { name: /I pay EUR/ }).click()
	await expect(foundry.getByRole("button", { name: /^Lock/ })).toBeVisible({
		timeout: 30_000,
	})
	await act(foundry, /^Lock/, "Hedge")

	// The euro dips: the foundry's hedge falls under its margin
	await operator.goto("/demo")
	await act(operator, "1.0800", "Set demo rate")

	await foundry.goto("/hedges")
	await foundry.getByLabel("Only my hedges").check()
	const card = foundry.locator(".card", { hasText: "(you)" }).first()
	await expect(card.getByText("Under margin")).toBeVisible({ timeout: 30_000 })
	await card.getByRole("button", { name: "Start margin call" }).click()
	await expect(foundry.getByText("Margin call: done").last()).toBeVisible({
		timeout: 60_000,
	})
	await expect(card.getByText(/Margin call: .* left/)).toBeVisible({
		timeout: 30_000,
	})
	await card.getByRole("button", { name: /^Top up/ }).click()
	await expect(foundry.getByText("Top up: done").last()).toBeVisible({
		timeout: 60_000,
	})
	await expect(card.getByText("Open", { exact: true })).toBeVisible({
		timeout: 30_000,
	})

	// Fixing at −5 % against K, once the maturity has passed
	await operator.goto("/demo")
	await act(operator, "1.0793", "Set demo rate")
	const wait = maturityOpenedAt + MATURITY_MINUTES * 60_000 + 15_000 - Date.now()
	if (wait > 0) await operator.waitForTimeout(wait)

	await operator.goto("/hedges")
	await act(operator, "Record fixing", "Fixing")

	// Settle every hedge of the maturity, from any account
	const settle = operator.getByRole("button", { name: "Settle" })
	await expect(settle.first()).toBeVisible({ timeout: 30_000 })
	for (let i = 0; i < 2; i++) {
		await act(operator, "Settle", "Settle")
		await operator.waitForTimeout(2_000)
	}
	await expect(settle).toHaveCount(0, { timeout: 30_000 })

	await operator.goto("/demo")
	await act(operator, "Back to Reflector", "Back to Reflector")
})
