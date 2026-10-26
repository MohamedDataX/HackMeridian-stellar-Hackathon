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

/** FX_SHOTS_DIR saves a sharp screenshot of each step, e.g. for the demo film. */
const SHOTS = process.env.FX_SHOTS_DIR
let shotCount = 0
async function shot(page: Page, name: string) {
	if (!SHOTS) return
	await page.waitForTimeout(1_500)
	shotCount += 1
	await page.screenshot({
		path: `${SHOTS}/${String(shotCount).padStart(2, "0")}-${name}.png`,
	})
}

async function actor(browser: Browser, secret: string) {
	const context = await browser.newContext(
		SHOTS ? { viewport: { width: 1440, height: 900 }, deviceScaleFactor: 2 } : {},
	)
	const page = await context.newPage()
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
	await operator.goto("/app/operator")
	await act(operator, "Back to Reflector", "Back to Reflector")
	await operator.getByLabel("In (minutes)").fill(String(MATURITY_MINUTES))
	await operator.getByLabel("Priced as (days)").fill("360")
	await act(operator, "Open Maturity", "Open maturity")
	const maturityOpenedAt = Date.now()
	await shot(operator, "operator")

	// Liquidity provider deposits
	await provider.goto("/app/lp")
	await provider.getByLabel("Amount (USDC)").fill("1000000")
	await act(provider, /^Deposit$/, "Deposit")
	await shot(provider, "lp-deposit")

	// Two opposite hedges on the new maturity (the first open one)
	for (const [page, id] of [
		[manufacturer, "manufacturer"],
		[foundry, "foundry"],
	] as const) {
		await page.goto(`/app/${id}`)
		await expect(page.getByRole("button", { name: /Lock Rate/ })).toBeEnabled({
			timeout: 30_000,
		})
		await shot(page, `${id}-quote`)
		await act(page, /Lock Rate/, "Hedge")
		await shot(page, `${id}-locked`)
	}
	await provider.reload()
	await shot(provider, "lp-balanced")

	// The euro dips: the foundry's hedge falls under its margin
	await operator.goto("/app/operator")
	await act(operator, "1.0800", "Set rate")
	await shot(operator, "operator-dip")

	await foundry.goto("/app/foundry")
	await expect(
		foundry.getByRole("button", { name: "Start Margin Call" }),
	).toBeVisible({ timeout: 30_000 })
	await shot(foundry, "foundry-under-margin")
	await act(foundry, "Start Margin Call", "Margin call")
	await expect(
		foundry.getByRole("button", { name: "Top Up Collateral" }),
	).toBeVisible({ timeout: 30_000 })
	await shot(foundry, "foundry-call-active")
	await act(foundry, "Top Up Collateral", "Top up")
	await expect(
		foundry.getByRole("button", { name: "Top Up Collateral" }),
	).toHaveCount(0, { timeout: 30_000 })
	await shot(foundry, "foundry-topped-up")

	// Fixing at −5 % against K, once the maturity has passed
	await operator.goto("/app/operator")
	await act(operator, "1.0793", "Set rate")
	const wait = maturityOpenedAt + MATURITY_MINUTES * 60_000 + 15_000 - Date.now()
	if (wait > 0) await operator.waitForTimeout(wait)

	await shot(operator, "operator-due")
	// Fix every maturity due, older empty ones included
	const fix = operator.getByRole("button", { name: "Record Fixing" })
	while ((await fix.count()) > 0) {
		await act(operator, "Record Fixing", "Fixing")
		await operator.waitForTimeout(5_000)
	}

	// Settle every hedge of the maturity, from the operator account
	const settle = operator.getByRole("button", { name: /^Settle NDF/ })
	await expect(settle.first()).toBeVisible({ timeout: 30_000 })
	await shot(operator, "operator-fixed")
	for (let i = 0; i < 2; i++) {
		await act(operator, /^Settle NDF/, "Settle")
		await operator.waitForTimeout(2_000)
	}
	await expect(settle).toHaveCount(0, { timeout: 30_000 })
	for (const [page, name] of [
		[manufacturer, "manufacturer-settled"],
		[foundry, "foundry-settled"],
		[provider, "lp-settled"],
	] as const) {
		await page.reload()
		await shot(page, name)
	}
	await operator.goto("/")
	await shot(operator, "landing")
	await operator.goto("/connect")
	await shot(operator, "connect")
	await operator.goto("/app/operator")

	await act(operator, "Back to Reflector", "Back to Reflector")
})
