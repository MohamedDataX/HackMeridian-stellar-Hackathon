import { errorMessage, type signTransaction } from "@stellar-scaffold/app-lib"

/**
 * The part of a generated client's AssembledTransaction used here. Typed
 * structurally: each generated client bundles its own stellar-sdk copy.
 */
export interface Tx<T> {
	result: T
	signAndSend(opts: {
		signTransaction: typeof signTransaction
	}): Promise<{ result: T }>
}

/** Amounts (USDC, EUR notionals) have 7 decimals. */
export const ONE = 10_000_000n
/** Rates (USD per EUR) have 14 decimals. */
export const RATE_ONE = 100_000_000_000_000n
export const BPS = 10_000n

/** Demo testnet accounts, labelled in the UI. */
export const ACCOUNTS: Record<string, string> = {
	GAVFGU5H7H76TOT4HHV6VBVI4XISGQSFKL4ICIJNVSJ7ODKLWL7EWKPS: "Operator",
	GDE7X6OVNHDTAIDWQ3K7KT6CXF2DET7DQA52SDY6Q3Q6ICNFHXJM2B34: "Manufacturer",
	GCREY2LQAWTN7SN4E2AYF4OZMHRLFHZ6TASCQVFK7L2IQ66G3LM4P7EB: "Foundry",
	GA46XQ6LNPJWOMLTLOTIWHJJCVCBR4DFO2GTUIX3DOGPZTA52BART5OR: "Liquidity provider",
}

export const accountLabel = (address: string) =>
	ACCOUNTS[address] ?? `${address.slice(0, 4)}…${address.slice(-4)}`

export const EUR = { tag: "Other" as const, values: ["EUR"] as [string] }

/** Parse a decimal string ("1000000.5") into fixed-point units. */
export const parseFixed = (text: string, decimals: number): bigint => {
	const clean = text.replace(/[\s,_]/g, "")
	if (!/^\d+(\.\d+)?$/.test(clean)) throw new Error(`Invalid number: ${text}`)
	const [whole, frac = ""] = clean.split(".")
	return BigInt(whole + frac.padEnd(decimals, "0").slice(0, decimals))
}

export const parseAmount = (text: string) => parseFixed(text, 7)
export const parseRate = (text: string) => parseFixed(text, 14)

const formatFixed = (value: bigint, decimals: number, shown: number) => {
	const negative = value < 0n
	const abs = negative ? -value : value
	const scale = 10n ** BigInt(decimals)
	const rounding = 10n ** BigInt(decimals - shown) / 2n
	const rounded = shown < decimals ? abs + rounding : abs
	const whole = rounded / scale
	const frac = (rounded % scale)
		.toString()
		.padStart(decimals, "0")
		.slice(0, shown)
	const wholeText = whole.toLocaleString("en-US")
	return `${negative ? "−" : ""}${wholeText}${shown ? `.${frac}` : ""}`
}

export const fmtAmount = (value: bigint, shown = 2) => formatFixed(value, 7, shown)
export const fmtRate = (value: bigint, shown = 5) => formatFixed(value, 14, shown)
export const fmtShare = (value: bigint) => formatFixed(value, 7, 7)

export const fmtSigned = (value: bigint) =>
	`${value > 0n ? "+" : ""}${fmtAmount(value)}`

/** "4m 12s", "3d 2h", or "now" when the time has passed. */
export const timeLeft = (target: bigint | number, now: number) => {
	let s = Number(target) - now
	if (s <= 0) return "now"
	const d = Math.floor(s / 86_400)
	s -= d * 86_400
	const h = Math.floor(s / 3_600)
	s -= h * 3_600
	const m = Math.floor(s / 60)
	s -= m * 60
	if (d) return `${d}d ${h}h`
	if (h) return `${h}h ${m}m`
	if (m) return `${m}m ${s}s`
	return `${s}s`
}

export const nowSecs = () => Math.floor(Date.now() / 1000)

const FX_ERRORS: Record<number, string> = {
	1: "New hedges are paused",
	2: "Invalid parameters",
	3: "The amount must be positive",
	4: "Unknown maturity",
	5: "This maturity already exists",
	6: "This maturity has passed",
	7: "The oracle has no price",
	8: "The oracle price is too old",
	9: "The vault cannot take more net exposure on this maturity",
	10: "Unknown hedge",
	11: "The maturity has not been reached yet",
	12: "This maturity is already fixed",
	13: "Waiting for the fixing",
	14: "This hedge is already closed",
	15: "No oracle price at the maturity yet",
	16: "The margin is sufficient",
	17: "No margin call is pending",
	18: "The margin call delay is still running",
	19: "The rate moved since the quote, please retry",
	1000: "The vault is already linked",
	1001: "The vault is not linked",
	1002: "This exceeds the liquidity not engaged in hedges",
	1003: "The vault does not have enough liquidity",
	1004: "The amount must be positive",
}

/** Readable message for a wallet, simulation or contract error. */
export const explain = (e: unknown): string => {
	const text = e instanceof Error ? e.message : String(e)
	const code = /Error\(Contract, #(\d+)\)/.exec(text)?.[1]
	const known = code ? FX_ERRORS[Number(code)] : undefined
	if (known) return known
	if (/balance is not sufficient|resulting balance/i.test(text))
		return "Not enough tUSDC"
	if (/trustline/i.test(text)) return "This account has no tUSDC trustline"
	return errorMessage(e)
}

/** Simulate a read-only call and return its value. */
export const read = async <T>(call: Promise<Tx<T>>) =>
	(await call).result

/** Sign with the connected wallet, submit, and return the call's value. */
export const send = async <T>(
	call: Promise<Tx<T>>,
	sign: typeof signTransaction,
) => {
	const tx = await call
	const sent = await tx.signAndSend({ signTransaction: sign })
	return sent.result
}
