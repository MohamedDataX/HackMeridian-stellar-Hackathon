import { lpVault } from "@stellar-scaffold/app-lib/clients"
import { useState } from "react"
import {
	useAction,
	useMaturities,
	useNow,
	useParams,
	useShares,
	useUsdcBalance,
	useVault,
} from "../hooks/useFx"
import { useWallet } from "../hooks/useWallet"
import {
	BPS,
	ONE,
	explain,
	fmtAmount,
	fmtShare,
	parseAmount,
	send,
	timeLeft,
} from "../lib/fx"
import styles from "./Fx.module.css"

const Vault = () => {
	const { address, signTransaction } = useWallet()
	const now = useNow()
	const { data: vault } = useVault()
	const { data: params } = useParams()
	const { data: maturities = [] } = useMaturities()
	const { data: mine } = useShares(address)
	const { data: usdc } = useUsdcBalance(address)
	const { run, pending } = useAction()
	const [amount, setAmount] = useState("1000000")

	const limit =
		vault && params ? (vault.total * params.max_loss_bps) / BPS : undefined
	const engagedPct =
		vault && limit ? Number((vault.engaged * 10_000n) / (limit || 1n)) / 100 : 0
	const myValue =
		mine && vault ? (mine.shares * vault.sharePrice) / ONE : undefined
	const live = maturities.filter((m) => m.fixing == null || m.net_usd !== 0n)
	const maxNet = live.reduce(
		(max, m) => (m.net_usd < 0n ? -m.net_usd : m.net_usd) > max
			? (m.net_usd < 0n ? -m.net_usd : m.net_usd)
			: max,
		1n,
	)

	const act = (label: string, assets: bigint) =>
		run(label, async () => {
			if (!address) return
			const args = { assets, receiver: address, operator: address }
			await send(
				label === "Deposit"
					? lpVault.deposit({ ...args, from: address }, { publicKey: address })
					: lpVault.withdraw({ ...args, owner: address }, { publicKey: address }),
				signTransaction,
			)
		})

	let parsed: bigint | undefined
	try {
		parsed = parseAmount(amount)
	} catch {
		parsed = undefined
	}

	return (
		<div className={styles.page}>
			<section className={styles.intro}>
				<h1>Liquidity vault</h1>
				<p>
					Liquidity providers back the hedges that do not offset each other.
					Hedging fees, losing margins and close-out penalties raise the
					share price. Only liquidity not engaged in open hedges can be
					withdrawn.
				</p>
			</section>

			<div className={styles.stats}>
				<Stat label="Vault assets" value={vault && `${fmtAmount(vault.total, 0)} USDC`} />
				<Stat label="Share price" value={vault && fmtShare(vault.sharePrice)} />
				<Stat label="Engaged in hedges" value={vault && `${fmtAmount(vault.engaged, 0)} USDC`} />
				<Stat label="Free to withdraw" value={vault && `${fmtAmount(vault.free, 0)} USDC`} />
			</div>

			<div className={styles.grid}>
				<div className="card">
					<h2>Net exposure by maturity</h2>
					<p className={styles.muted}>
						Left: companies that pay EUR. Right: companies that receive EUR.
						Opposite hedges cancel out; the vault backs only the gap.
					</p>
					{live.length === 0 && <p className={styles.muted}>No open maturity.</p>}
					{live.map((m) => {
						const pct = Number(((m.net_usd < 0n ? -m.net_usd : m.net_usd) * 100n) / maxNet)
						return (
							<div key={m.timestamp.toString()} className={styles.gaugeRow}>
								<span>
									{new Date(Number(m.timestamp) * 1000).toLocaleTimeString()}
									{m.fixing == null && ` · ${timeLeft(m.timestamp, now)}`}
								</span>
								<div className={styles.gauge}>
									<div
										className={m.net_usd < 0n ? styles.gaugeLeft : styles.gaugeRight}
										style={{ width: `${pct / 2}%` }}
									/>
								</div>
								<span>
									{m.net_usd === 0n ? "balanced" : `${fmtAmount(m.net_usd, 0)} USD`}
								</span>
							</div>
						)
					})}
					<p className={styles.muted}>
						Engaged: {engagedPct.toFixed(1)} % of the limit (
						{params ? Number(params.max_loss_bps) / 100 : 50} % of vault assets).
					</p>
					<div className={styles.meter}>
						<div style={{ width: `${Math.min(engagedPct, 100)}%` }} />
					</div>
				</div>

				<div className="card">
					<h2>Your position</h2>
					<dl className={styles.facts}>
						<dt>tUSDC balance</dt>
						<dd>{usdc !== undefined ? fmtAmount(usdc) : "…"}</dd>
						<dt>Shares</dt>
						<dd>{mine ? fmtAmount(mine.shares) : "…"}</dd>
						<dt>Share value</dt>
						<dd>{myValue !== undefined ? `${fmtAmount(myValue)} USDC` : "…"}</dd>
						<dt>Withdrawable now</dt>
						<dd>{mine ? `${fmtAmount(mine.maxWithdraw)} USDC` : "…"}</dd>
					</dl>
					<label className={styles.field}>
						<span>Amount (USDC)</span>
						<input value={amount} onChange={(e) => setAmount(e.target.value)} inputMode="decimal" />
					</label>
					<div className={styles.actions}>
						<button
							className={styles.primary}
							disabled={!address || !parsed || Boolean(pending)}
							onClick={() => parsed && void act("Deposit", parsed)}
						>
							Deposit
						</button>
						<button
							disabled={!address || !parsed || Boolean(pending)}
							onClick={() => parsed && void act("Withdraw", parsed)}
						>
							Withdraw
						</button>
						<button
							disabled={!address || !mine?.maxWithdraw || Boolean(pending)}
							onClick={() => mine && void act("Withdraw", mine.maxWithdraw)}
						>
							Withdraw max
						</button>
					</div>
					{!address && <p className={styles.muted}>Connect a wallet to deposit.</p>}
					{amount && !parsed && <p className={styles.error}>{explain(new Error("Invalid amount"))}</p>}
				</div>
			</div>
		</div>
	)
}

const Stat = ({ label, value }: { label: string; value?: string }) => (
	<div className={`card ${styles.stat}`}>
		<span>{label}</span>
		<strong>{value ?? "…"}</strong>
	</div>
)

export default Vault
