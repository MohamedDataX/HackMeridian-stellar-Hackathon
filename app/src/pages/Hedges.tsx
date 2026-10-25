import { fxVault } from "@stellar-scaffold/app-lib/clients"
import { useState } from "react"
import {
	useAction,
	useHedges,
	useMarginStatus,
	useMaturities,
	useNow,
	useParams,
} from "../hooks/useFx"
import { useWallet } from "../hooks/useWallet"
import {
	accountLabel,
	BPS,
	explain,
	fmtAmount,
	fmtRate,
	fmtSigned,
	send,
	timeLeft,
	type Tx,
} from "../lib/fx"
import styles from "./Fx.module.css"

type Hedge = NonNullable<ReturnType<typeof useHedges>["data"]>[number]
type Maturity = NonNullable<ReturnType<typeof useMaturities>["data"]>[number]

/** Top-ups add this share of N × K on top of the shortfall: the forward rate
 * keeps moving between the quote and the signature. */
const TOP_UP_BUFFER_BPS = 100n

const Hedges = () => {
	const { address } = useWallet()
	const now = useNow()
	const { data: hedges = [], isLoading } = useHedges()
	const { data: maturities = [] } = useMaturities()
	const [mineOnly, setMineOnly] = useState(false)

	const byTime = new Map(maturities.map((m) => [m.timestamp.toString(), m]))
	const shown = hedges.filter((h) => !mineOnly || h.company === address)

	return (
		<div className={styles.page}>
			<section className={styles.intro}>
				<h1>Hedges</h1>
				<p>
					Each hedge is marked at today&apos;s forward rate. A hedge below its
					maintenance margin can be called by anyone; its company tops up or
					it is closed out after the delay. At maturity, the fixing records
					one rate and every hedge settles at it.
				</p>
				<label className={styles.check}>
					<input
						type="checkbox"
						checked={mineOnly}
						onChange={(e) => setMineOnly(e.target.checked)}
					/>
					Only my hedges
				</label>
			</section>

			<FixBar maturities={maturities} now={now} />

			{isLoading && <p className={styles.muted}>Loading…</p>}
			{!isLoading && shown.length === 0 && (
				<p className={styles.muted}>No hedge yet.</p>
			)}
			<div className={styles.list}>
				{shown.map((h) => (
					<HedgeCard
						key={h.id}
						hedge={h}
						maturity={byTime.get(h.maturity.toString())}
						now={now}
					/>
				))}
			</div>
		</div>
	)
}

/** Maturities past T and not fixed yet. */
const FixBar = ({ maturities, now }: { maturities: Maturity[]; now: number }) => {
	const { address, signTransaction } = useWallet()
	const { run, pending } = useAction()
	const due = maturities.filter(
		(m) => m.fixing == null && Number(m.timestamp) <= now,
	)
	if (due.length === 0) return null
	return (
		<div className={`card ${styles.notice}`}>
			{due.map((m) => (
				<div key={m.timestamp.toString()} className={styles.row}>
					<span>
						Maturity {new Date(Number(m.timestamp) * 1000).toLocaleTimeString()}{" "}
						reached: record the fixing.
					</span>
					<button
						className={styles.primary}
						disabled={!address || Boolean(pending)}
						onClick={() =>
							void run("Fixing", () =>
								send(
									fxVault.fix(
										{ maturity: m.timestamp },
										{ publicKey: address },
									),
									signTransaction,
								),
							)
						}
					>
						{pending === "Fixing" ? "Signing…" : "Record fixing"}
					</button>
				</div>
			))}
		</div>
	)
}

const HedgeCard = ({
	hedge: h,
	maturity,
	now,
}: {
	hedge: Hedge
	maturity?: Maturity
	now: number
}) => {
	const { address, signTransaction } = useWallet()
	const { data: params } = useParams()
	const { run, pending } = useAction()
	const isOpen = h.status.tag === "Open"
	const fixed = maturity?.fixing != null
	const margin = useMarginStatus(h.id, isOpen && !fixed)
	const st = margin.data
	const mine = h.company === address

	const call = <T,>(label: string, build: () => Promise<Tx<T>>) =>
		run(label, () => send(build(), signTransaction))
	const opts = { publicKey: address }

	const buffer = (h.notional_usd * TOP_UP_BUFFER_BPS) / BPS
	const topUpAmount = st ? st.shortfall + buffer : buffer
	const callPending = st?.call_deadline != null
	const deadlinePassed = callPending && Number(st?.call_deadline) <= now
	const sideText = h.side.tag === "SellEur" ? "Receives EUR" : "Pays EUR"

	let state = "Open"
	let tone = styles.ok
	if (!isOpen) {
		state = h.status.tag === "Settled" ? "Settled" : "Closed out"
		tone = styles.done
	} else if (fixed) {
		state = "Fixed: ready to settle"
		tone = styles.warn
	} else if (callPending) {
		state = deadlinePassed
			? "Margin call expired"
			: `Margin call: ${timeLeft(st?.call_deadline ?? 0n, now)} left`
		tone = styles.bad
	} else if (st && st.shortfall > 0n) {
		state = "Under margin"
		tone = styles.bad
	}

	return (
		<div className="card">
			<div className={styles.row}>
				<h3>
					#{h.id} · {accountLabel(h.company)} {mine && <em>(you)</em>}
				</h3>
				<span className={`${styles.badge} ${tone}`}>{state}</span>
			</div>
			<dl className={styles.facts}>
				<dt>Exposure</dt>
				<dd>
					{sideText} · {fmtAmount(h.notional, 0)} EUR
				</dd>
				<dt>Locked rate K</dt>
				<dd>{fmtRate(h.strike)}</dd>
				<dt>Maturity</dt>
				<dd>
					{new Date(Number(h.maturity) * 1000).toLocaleString()}
					{isOpen && !fixed && ` (in ${timeLeft(h.maturity, now)})`}
				</dd>
				{fixed && (
					<>
						<dt>Fixing</dt>
						<dd>{fmtRate(maturity?.fixing as bigint)}</dd>
					</>
				)}
				<dt>Margin deposited</dt>
				<dd>{fmtAmount(isOpen ? h.margin : 0n)} USDC</dd>
				{st && (
					<>
						<dt>Unrealized result</dt>
						<dd>{st.loss > 0n ? fmtSigned(-st.loss) : "≥ 0"} USDC</dd>
						<dt>Margin required</dt>
						<dd>
							{fmtAmount(st.required)} USDC
							{st.shortfall > 0n && (
								<strong className={styles.bad}>
									{" "}
									· missing {fmtAmount(st.shortfall)}
								</strong>
							)}
						</dd>
					</>
				)}
				<dt>Fee paid</dt>
				<dd>{fmtAmount(h.fee)} USDC</dd>
			</dl>
			{margin.error && <p className={styles.error}>{explain(margin.error)}</p>}

			{isOpen && (
				<div className={styles.actions}>
					{fixed && (
						<button
							className={styles.primary}
							disabled={!address || Boolean(pending)}
							onClick={() =>
								void call("Settle", () => fxVault.settle({ id: h.id }, opts))
							}
						>
							Settle
						</button>
					)}
					{!fixed && st && st.shortfall > 0n && !callPending && (
						<button
							disabled={!address || Boolean(pending)}
							onClick={() =>
								void call("Margin call", () =>
									fxVault.margin_call({ id: h.id }, opts),
								)
							}
						>
							Start margin call
						</button>
					)}
					{!fixed && mine && (callPending || (st && st.shortfall > 0n)) && (
						<button
							className={styles.primary}
							disabled={Boolean(pending)}
							onClick={() =>
								void call("Top up", () =>
									fxVault.top_up({ id: h.id, amount: topUpAmount }, opts),
								)
							}
						>
							Top up {fmtAmount(topUpAmount)} USDC
						</button>
					)}
					{!fixed && deadlinePassed && st && st.shortfall > 0n && (
						<button
							disabled={!address || Boolean(pending)}
							onClick={() =>
								void call("Close out", () =>
									fxVault.close_out({ id: h.id }, opts),
								)
							}
						>
							Close out ({Number(params?.penalty_bps ?? 100n) / 100} % penalty)
						</button>
					)}
				</div>
			)}
		</div>
	)
}

export default Hedges
