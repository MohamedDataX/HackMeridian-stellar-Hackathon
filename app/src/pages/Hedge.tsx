import { fxVault } from "@stellar-scaffold/app-lib/clients"
import { useQuery } from "@tanstack/react-query"
import { useState } from "react"
import { Link } from "react-router-dom"
import { useAction, useMaturities, useNow, useParams } from "../hooks/useFx"
import { useWallet } from "../hooks/useWallet"
import {
	accountLabel,
	explain,
	fmtAmount,
	fmtRate,
	parseAmount,
	read,
	send,
	timeLeft,
} from "../lib/fx"
import styles from "./Fx.module.css"

type SideTag = "SellEur" | "BuyEur"

const Hedge = () => {
	const { address, signTransaction } = useWallet()
	const now = useNow()
	const { data: maturities = [] } = useMaturities()
	const { data: params } = useParams()
	const { run, pending } = useAction()

	const [notional, setNotional] = useState("1000000")
	const [side, setSide] = useState<SideTag>("SellEur")
	const [picked, setPicked] = useState<string>()

	const open = maturities.filter((m) => Number(m.timestamp) > now)
	const maturity =
		open.find((m) => m.timestamp.toString() === picked) ?? open[0]

	let amount: bigint | undefined
	try {
		amount = parseAmount(notional)
	} catch {
		amount = undefined
	}

	const quote = useQuery({
		queryKey: ["quote", amount?.toString(), side, maturity?.timestamp.toString()],
		queryFn: () =>
			read(
				fxVault.quote({
					notional: amount as bigint,
					side: { tag: side, values: undefined },
					maturity: (maturity as { timestamp: bigint }).timestamp,
				}),
			),
		enabled: Boolean(amount && maturity),
		refetchInterval: 4_000,
	})

	const lock = () =>
		run("Hedge", async () => {
			if (!address || !amount || !maturity || !quote.data) return
			await send(
				fxVault.open_hedge(
					{
						company: address,
						notional: amount,
						side: { tag: side, values: undefined },
						maturity: maturity.timestamp,
						strike: quote.data.strike,
					},
					{ publicKey: address },
				),
				signTransaction,
			)
		})

	const q = quote.data
	const capPct = params ? Number(params.cap_bps) / 100 : 20

	return (
		<div className={styles.page}>
			<section className={styles.intro}>
				<h1>Lock your EUR/USD rate from order to delivery</h1>
				<p>
					Pick the delivery month and the euro amount. You lock today&apos;s
					forward rate. The vault settles the difference in USDC at maturity,
					and companies with the opposite exposure offset your risk.
				</p>
			</section>

			<div className={styles.grid}>
				<div className="card">
					<h2>Hedge an order</h2>
					<label className={styles.field}>
						<span>Order amount (EUR)</span>
						<input
							value={notional}
							onChange={(e) => setNotional(e.target.value)}
							inputMode="decimal"
						/>
					</label>

					<div className={styles.field}>
						<span>Your exposure</span>
						<div className={styles.segmented}>
							<button
								className={side === "SellEur" ? styles.on : ""}
								onClick={() => setSide("SellEur")}
							>
								I receive EUR
								<small>lose if the euro falls</small>
							</button>
							<button
								className={side === "BuyEur" ? styles.on : ""}
								onClick={() => setSide("BuyEur")}
							>
								I pay EUR
								<small>lose if the euro rises</small>
							</button>
						</div>
					</div>

					<label className={styles.field}>
						<span>Maturity</span>
						<select
							value={maturity?.timestamp.toString() ?? ""}
							onChange={(e) => setPicked(e.target.value)}
						>
							{open.length === 0 && <option value="">No open maturity</option>}
							{open.map((m) => (
								<option key={m.timestamp.toString()} value={m.timestamp.toString()}>
									{new Date(Number(m.timestamp) * 1000).toLocaleString()} (in{" "}
									{timeLeft(m.timestamp, now)}
									{m.pricing_secs !== undefined
										? `, demo: priced as ${Math.round(Number(m.pricing_secs) / 86_400)} days`
										: ""}
									)
								</option>
							))}
						</select>
					</label>
				</div>

				<div className="card">
					<h2>Quote</h2>
					{!maturity && (
						<p className={styles.muted}>
							No maturity is open. The operator opens one in the{" "}
							<Link to="/demo">demo panel</Link>.
						</p>
					)}
					{quote.error && (
						<p className={styles.error}>{explain(quote.error)}</p>
					)}
					{q && (
						<>
							<dl className={styles.facts}>
								<dt>Spot rate (oracle)</dt>
								<dd>{fmtRate(q.spot)}</dd>
								<dt>Interest differential</dt>
								<dd>{params ? `${Number(params.carry_bps) / 100} % a year` : "…"}</dd>
								<dt>Locked forward rate K</dt>
								<dd className={styles.big}>{fmtRate(q.strike)}</dd>
								<dt>Value of the order</dt>
								<dd>{fmtAmount(q.notional_usd)} USDC</dd>
								<dt>Margin (refunded at maturity)</dt>
								<dd>{fmtAmount(q.margin)} USDC</dd>
								<dt>Hedging fee</dt>
								<dd>{fmtAmount(q.fee)} USDC</dd>
							</dl>
							<p className={styles.muted}>
								Payout capped at {capPct} % of the order value. The fee is
								lower when your hedge offsets the vault&apos;s net exposure.
							</p>
							<button
								className={styles.primary}
								disabled={!address || Boolean(pending)}
								onClick={() => void lock()}
							>
								{pending === "Hedge"
									? "Signing…"
									: address
										? `Lock ${fmtRate(q.strike, 4)} as ${accountLabel(address)}`
										: "Connect a wallet to hedge"}
							</button>
						</>
					)}
				</div>
			</div>
		</div>
	)
}

export default Hedge
