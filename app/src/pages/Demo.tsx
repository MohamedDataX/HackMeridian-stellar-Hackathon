import { demoOracle, fxVault } from "@stellar-scaffold/app-lib/clients"
import { useState } from "react"
import { useAction, useMaturities, useNow, useOracle } from "../hooks/useFx"
import { useWallet } from "../hooks/useWallet"
import {
	ACCOUNTS,
	accountLabel,
	explain,
	fmtRate,
	parseRate,
	send,
	timeLeft,
} from "../lib/fx"
import styles from "./Fx.module.css"

const OPERATOR = Object.keys(ACCOUNTS).find((a) => ACCOUNTS[a] === "Operator")

const PRESETS = ["1.1193", "1.1000", "1.0800", "1.0793"]

/** Operator panel: replay twelve months in a few minutes. */
const Demo = () => {
	const { address, signTransaction } = useWallet()
	const now = useNow()
	const { data: oracle, error } = useOracle()
	const { data: maturities = [] } = useMaturities()
	const { run, pending } = useAction()
	const [rate, setRate] = useState("1.0800")
	const [minutes, setMinutes] = useState("10")
	const [days, setDays] = useState("360")
	const opts = { publicKey: address }
	const isOperator = address === OPERATOR

	const setPrice = (text: string) =>
		run("Set demo rate", () =>
			send(demoOracle.set_price({ price: parseRate(text) }, opts), signTransaction),
		)

	const openMaturity = () =>
		run("Open maturity", () =>
			send(
				fxVault.open_maturity(
					{
						timestamp: BigInt(Math.floor(Date.now() / 1000) + Number(minutes) * 60),
						pricing_secs: BigInt(Number(days) * 86_400),
					},
					opts,
				),
				signTransaction,
			),
		)

	return (
		<div className={styles.page}>
			<section className={styles.intro}>
				<h1>Demo panel</h1>
				<p>
					Hidden in production. The demo oracle relays the real Reflector
					EUR/USD feed, or the operator sets the rate to replay a move of the
					euro. Maturities a few minutes away are priced as twelve months.
				</p>
				{!isOperator && (
					<p className={styles.warnText}>
						Rate and maturity actions need the operator account (
						{OPERATOR && accountLabel(OPERATOR)}). Connected:{" "}
						{address ? accountLabel(address) : "none"}.
					</p>
				)}
			</section>

			<div className={styles.grid}>
				<div className="card">
					<h2>EUR/USD rate</h2>
					{error && <p className={styles.error}>{explain(error)}</p>}
					<dl className={styles.facts}>
						<dt>Reflector (real feed)</dt>
						<dd>{oracle?.reflector ? fmtRate(oracle.reflector.price) : "…"}</dd>
						<dt>Rate used by the vault</dt>
						<dd className={styles.big}>
							{oracle?.demo ? fmtRate(oracle.demo.price) : "…"}
						</dd>
						<dt>Mode</dt>
						<dd>{oracle ? (oracle.manual != null ? "Manual (demo)" : "Relay of Reflector") : "…"}</dd>
					</dl>
					<label className={styles.field}>
						<span>Set the rate</span>
						<input value={rate} onChange={(e) => setRate(e.target.value)} inputMode="decimal" />
					</label>
					<div className={styles.actions}>
						<button
							className={styles.primary}
							disabled={!address || Boolean(pending)}
							onClick={() => void setPrice(rate)}
						>
							Set rate
						</button>
						{PRESETS.map((p) => (
							<button
								key={p}
								disabled={!address || Boolean(pending)}
								onClick={() => {
									setRate(p)
									void setPrice(p)
								}}
							>
								{p}
							</button>
						))}
						<button
							disabled={!address || Boolean(pending)}
							onClick={() =>
								void run("Back to Reflector", () =>
									send(demoOracle.relay(opts), signTransaction),
								)
							}
						>
							Back to Reflector
						</button>
					</div>
				</div>

				<div className="card">
					<h2>Maturities</h2>
					<div className={styles.inline}>
						<label className={styles.field}>
							<span>In (minutes)</span>
							<input value={minutes} onChange={(e) => setMinutes(e.target.value)} inputMode="numeric" />
						</label>
						<label className={styles.field}>
							<span>Priced as (days)</span>
							<input value={days} onChange={(e) => setDays(e.target.value)} inputMode="numeric" />
						</label>
					</div>
					<button
						className={styles.primary}
						disabled={!address || Boolean(pending)}
						onClick={() => void openMaturity()}
					>
						Open maturity
					</button>
					<ul className={styles.plain}>
						{maturities.map((m) => (
							<li key={m.timestamp.toString()}>
								{new Date(Number(m.timestamp) * 1000).toLocaleTimeString()} ·{" "}
								{m.fixing != null
									? `fixed at ${fmtRate(m.fixing)}`
									: Number(m.timestamp) > now
										? `in ${timeLeft(m.timestamp, now)}`
										: "due for fixing"}
							</li>
						))}
					</ul>
				</div>
			</div>
		</div>
	)
}

export default Demo
