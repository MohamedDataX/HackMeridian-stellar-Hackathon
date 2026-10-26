import { fxVault } from "@stellar-scaffold/app-lib/clients"
import { useQuery } from "@tanstack/react-query"
import { AlertCircle, Info, Lock, TrendingDown, TrendingUp } from "lucide-react"
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
	BPS,
	explain,
	fmtAmount,
	fmtRate,
	parseAmount,
	read,
	send,
	timeLeft,
} from "../lib/fx"
import { type Profile } from "../lib/personas"

type Hedge = NonNullable<ReturnType<typeof useHedges>["data"]>[number]
type Maturity = NonNullable<ReturnType<typeof useMaturities>["data"]>[number]
type Direction = "receive" | "pay"

/** Top-ups add 1 % of N × K on top of the shortfall: the forward rate keeps
 * moving between the quote and the signature. */
const TOP_UP_BUFFER_BPS = 100n

const side = (d: Direction) => ({
	tag: d === "receive" ? ("SellEur" as const) : ("BuyEur" as const),
	values: undefined,
})

export default function CorporateTerminal({ profile }: { profile: Profile }) {
	const { address, signTransaction } = useWallet()
	const now = useNow()
	const { data: params } = useParams()
	const { data: maturities = [] } = useMaturities()
	const { data: hedges = [] } = useHedges()
	const { run, pending } = useAction()

	const [notional, setNotional] = useState("1000000")
	const [direction, setDirection] = useState<Direction>(
		profile.id === "foundry" ? "pay" : "receive",
	)
	const [picked, setPicked] = useState<string>()

	const open = maturities.filter((m) => Number(m.timestamp) > now)
	const maturity = open.find((m) => m.timestamp.toString() === picked) ?? open[0]
	const byTime = new Map(maturities.map((m) => [m.timestamp.toString(), m]))
	const positions = hedges.filter((h) => h.company === profile.address)

	let amount: bigint | undefined
	try {
		amount = parseAmount(notional)
	} catch {
		amount = undefined
	}

	const quote = useQuery({
		queryKey: ["quote", amount?.toString(), direction, maturity?.timestamp.toString()],
		queryFn: () =>
			read(
				fxVault.quote({
					notional: amount as bigint,
					side: side(direction),
					maturity: (maturity as Maturity).timestamp,
				}),
			),
		enabled: Boolean(amount && maturity),
		refetchInterval: 4_000,
	})
	const q = quote.data

	const lock = () =>
		run("Hedge", async () => {
			if (!address || !amount || !maturity || !q) return
			await send(
				fxVault.open_hedge(
					{
						company: address,
						notional: amount,
						side: side(direction),
						maturity: maturity.timestamp,
						strike: q.strike,
					},
					{ publicKey: address },
				),
				signTransaction,
			)
		})

	const imPct = params ? Number(params.im_bps) / 100 : 5

	return (
		<div className="space-y-10">
			{/* Title */}
			<div>
				<h1 className="text-2xl font-semibold text-slate-900">Corporate Terminal</h1>
				<p className="text-sm text-slate-500 mt-1">
					Lock NDF contracts and monitor your margin health.
				</p>
			</div>

			<div className="grid lg:grid-cols-12 gap-8">
				{/* Form Input Side */}
				<div className="lg:col-span-7 space-y-6">
					<div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm">
						<label className="block text-sm font-medium text-slate-900 mb-4">
							Exposure Direction
						</label>
						<div className="grid grid-cols-2 gap-4">
							<button
								onClick={() => setDirection("receive")}
								className={`p-4 rounded-lg border text-left transition-all ${direction === "receive" ? "border-blue-600 bg-blue-50 ring-1 ring-blue-600" : "border-slate-200 hover:border-slate-300"}`}
							>
								<div className="flex items-center justify-between mb-1">
									<span className={`font-semibold text-sm ${direction === "receive" ? "text-blue-900" : "text-slate-700"}`}>
										Receive EUR
									</span>
									<TrendingDown className={`w-4 h-4 ${direction === "receive" ? "text-blue-600" : "text-slate-400"}`} />
								</div>
								<p className="text-xs text-slate-500">Hedging export revenue</p>
							</button>
							<button
								onClick={() => setDirection("pay")}
								className={`p-4 rounded-lg border text-left transition-all ${direction === "pay" ? "border-blue-600 bg-blue-50 ring-1 ring-blue-600" : "border-slate-200 hover:border-slate-300"}`}
							>
								<div className="flex items-center justify-between mb-1">
									<span className={`font-semibold text-sm ${direction === "pay" ? "text-blue-900" : "text-slate-700"}`}>
										Pay EUR
									</span>
									<TrendingUp className={`w-4 h-4 ${direction === "pay" ? "text-blue-600" : "text-slate-400"}`} />
								</div>
								<p className="text-xs text-slate-500">Hedging supplier costs</p>
							</button>
						</div>
					</div>

					<div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm grid sm:grid-cols-2 gap-6">
						<div>
							<label htmlFor="notional" className="block text-sm font-medium text-slate-900 mb-2">
								Notional Amount (EUR)
							</label>
							<div className="relative">
								<span className="absolute inset-y-0 left-0 pl-3 flex items-center text-slate-400 font-mono">€</span>
								<input
									id="notional"
									inputMode="decimal"
									value={notional}
									onChange={(e) => setNotional(e.target.value)}
									className="w-full pl-8 pr-4 py-2.5 bg-slate-50 border border-slate-200 rounded-md font-mono text-slate-900 focus:outline-none focus:ring-1 focus:ring-blue-600"
								/>
							</div>
						</div>
						<div>
							<label htmlFor="maturity" className="block text-sm font-medium text-slate-900 mb-2">
								Maturity
							</label>
							<select
								id="maturity"
								value={maturity?.timestamp.toString() ?? ""}
								onChange={(e) => setPicked(e.target.value)}
								className="w-full px-3 py-2.5 bg-slate-50 border border-slate-200 rounded-md text-slate-900 focus:outline-none focus:ring-1 focus:ring-blue-600"
							>
								{open.length === 0 && <option value="">No open maturity</option>}
								{open.map((m) => (
									<option key={m.timestamp.toString()} value={m.timestamp.toString()}>
										{m.pricing_secs !== undefined
											? `${Math.round(Number(m.pricing_secs) / 86_400)} Days`
											: new Date(Number(m.timestamp) * 1000).toLocaleDateString()}{" "}
										(ends in {timeLeft(m.timestamp, now)})
									</option>
								))}
							</select>
						</div>
					</div>
				</div>

				{/* Quote Builder Side */}
				<div className="lg:col-span-5">
					<div className="bg-slate-900 rounded-xl p-6 shadow-lg border border-slate-800">
						<div className="flex justify-between items-center mb-6">
							<h3 className="text-white font-medium">Indicative Quote</h3>
							<span className="text-[10px] uppercase tracking-wider text-slate-400 border border-slate-700 px-2 py-0.5 rounded flex items-center gap-1">
								<Info className="w-3 h-3" /> Reflector
							</span>
						</div>

						{!maturity && (
							<p className="text-sm text-slate-400 mb-6">
								No maturity is open: the Operator opens one.
							</p>
						)}
						{quote.error && <p className="text-sm text-rose-400 mb-6">{explain(quote.error)}</p>}

						<div className="space-y-4 mb-8">
							<Row label="Spot (EUR/USD)" value={q ? fmtRate(q.spot, 4) : "—"} />
							<Row
								label="Rate Differential"
								value={params ? `+${(Number(params.carry_bps) / 100).toFixed(2)}% p.a.` : "—"}
								valueClass="text-blue-400"
							/>
							<Row
								label="Forward Rate (K)"
								value={q ? fmtRate(q.strike, 4) : "—"}
								strong
							/>
							<Row label="USD Notional" value={q ? `$${fmtAmount(q.notional_usd)}` : "—"} />
							<div className="flex justify-between items-center pt-2">
								<span className="text-slate-300 font-medium">Initial Margin ({imPct}%)</span>
								<span className="font-mono font-semibold text-lg text-emerald-400">
									{q ? `$${fmtAmount(q.margin)}` : "—"}
								</span>
							</div>
						</div>

						<button
							onClick={() => void lock()}
							disabled={!address || !q || Boolean(pending)}
							className="w-full py-3.5 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white rounded-lg text-sm font-medium transition-colors flex items-center justify-center gap-2"
						>
							<Lock className="w-4 h-4" />
							{pending === "Hedge" ? "Signing…" : "Lock Rate & Deposit Margin"}
						</button>
						{q && (
							<p className="text-[11px] text-slate-500 mt-3 text-center">
								Fee {fmtAmount(q.fee)} USDC · margin refunded at maturity
							</p>
						)}
					</div>
				</div>
			</div>

			{/* Active Positions */}
			<div className="pt-6 border-t border-slate-200">
				<h2 className="text-xl font-semibold text-slate-900 mb-6">Active Positions</h2>
				{positions.length === 0 && (
					<p className="text-sm text-slate-500">No position for this account yet.</p>
				)}
				<div className="space-y-4">
					{positions.map((h) => (
						<PositionCard
							key={h.id}
							hedge={h}
							maturity={byTime.get(h.maturity.toString())}
							now={now}
						/>
					))}
				</div>
			</div>
		</div>
	)
}

const Row = ({
	label,
	value,
	valueClass = "text-slate-300",
	strong = false,
}: {
	label: string
	value: string
	valueClass?: string
	strong?: boolean
}) => (
	<div className="flex justify-between items-center pb-3 border-b border-slate-800">
		<span className={strong ? "text-slate-300 font-medium" : "text-slate-400 text-sm"}>{label}</span>
		<span className={`font-mono ${strong ? "text-white font-semibold text-lg" : valueClass}`}>{value}</span>
	</div>
)

function PositionCard({
	hedge: h,
	maturity,
	now,
}: {
	hedge: Hedge
	maturity?: Maturity
	now: number
}) {
	const { address, signTransaction } = useWallet()
	const { run, pending } = useAction()
	const isOpen = h.status.tag === "Open"
	const fixed = maturity?.fixing != null
	const { data: st } = useMarginStatus(h.id, isOpen && !fixed)
	const opts = { publicKey: address }

	const callActive = st?.call_deadline != null
	const deficit = Boolean(st && st.shortfall > 0n)
	const topUp = (st ? st.shortfall : 0n) + (h.notional_usd * TOP_UP_BUFFER_BPS) / BPS
	const fill = st && st.required > 0n ? Math.min(100, Number((st.margin * 100n) / st.required) / 2) : 100
	const mtm = st ? (st.loss > 0n ? `-$${fmtAmount(st.loss)}` : "+$0.00") : "—"

	let status = "Healthy"
	if (!isOpen) status = h.status.tag === "Settled" ? "Settled" : "Closed Out"
	else if (fixed) status = "Fixed"
	else if (callActive) status = "Call Active"
	else if (deficit) status = "Under Margin"

	return (
		<div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden p-6 grid grid-cols-1 md:grid-cols-12 gap-6 items-center">
			<div className="md:col-span-3">
				<div className="text-xs text-slate-400 font-semibold uppercase tracking-wider mb-1">Contract ID</div>
				<div className="font-mono text-slate-900 font-semibold mb-1">NDF-{h.id}</div>
				<div className="text-sm text-slate-600">{h.side.tag === "SellEur" ? "Receive EUR" : "Pay EUR"}</div>
			</div>

			<div className="md:col-span-3">
				<div className="text-xs text-slate-400 font-semibold uppercase tracking-wider mb-1">Terms</div>
				<div className="font-mono text-sm text-slate-900">€ {fmtAmount(h.notional, 0)}</div>
				<div className="font-mono text-xs text-slate-500">K = {fmtRate(h.strike, 4)}</div>
				{fixed && (
					<div className="font-mono text-xs text-slate-500">Fixing = {fmtRate(maturity?.fixing as bigint, 4)}</div>
				)}
			</div>

			<div className="md:col-span-2">
				<div className="text-xs text-slate-400 font-semibold uppercase tracking-wider mb-1">Mark-to-Market</div>
				<div className={`font-mono text-sm font-semibold ${st && st.loss > 0n ? "text-rose-600" : "text-emerald-600"}`}>
					{isOpen ? mtm : "—"}
				</div>
				{isOpen && !fixed && (
					<div className="text-xs text-slate-500">ends in {timeLeft(h.maturity, now)}</div>
				)}
			</div>

			<div className="md:col-span-4 bg-slate-50 p-4 rounded-lg border border-slate-100">
				{deficit || callActive ? (
					<>
						<div className="flex justify-between items-end mb-2">
							<div className="text-xs text-rose-500 font-semibold uppercase tracking-wider">Margin Deficit</div>
							<div className="text-xs font-mono font-medium text-rose-600 bg-rose-50 px-2 py-0.5 rounded border border-rose-200 flex items-center gap-1">
								<AlertCircle className="w-3 h-3" /> {status}
								{callActive && ` · ${timeLeft(st?.call_deadline ?? 0n, now)}`}
							</div>
						</div>
						<div className="h-2 w-full bg-slate-200 rounded-full overflow-hidden relative">
							<div className="absolute top-0 bottom-0 left-1/2 w-0.5 bg-rose-600 z-10" title="Maintenance Threshold"></div>
							<div className="h-full bg-rose-500 rounded-full" style={{ width: `${fill}%` }}></div>
						</div>
						{callActive ? (
							<button
								onClick={() => void run("Top up", () => send(fxVault.top_up({ id: h.id, amount: topUp }, opts), signTransaction))}
								disabled={!address || Boolean(pending)}
								className="w-full mt-3 py-2 bg-slate-900 hover:bg-slate-800 disabled:opacity-50 text-white rounded text-xs font-medium transition-colors"
							>
								Top Up Collateral
							</button>
						) : (
							<button
								onClick={() => void run("Margin call", () => send(fxVault.margin_call({ id: h.id }, opts), signTransaction))}
								disabled={!address || Boolean(pending)}
								className="w-full mt-3 py-2 bg-slate-900 hover:bg-slate-800 disabled:opacity-50 text-white rounded text-xs font-medium transition-colors"
							>
								Start Margin Call
							</button>
						)}
					</>
				) : (
					<>
						<div className="flex justify-between items-end mb-2">
							<div className="text-xs text-slate-500 font-semibold uppercase tracking-wider">Margin Status</div>
							<div className={`text-xs font-mono font-medium px-2 py-0.5 rounded border ${isOpen ? "text-emerald-600 bg-emerald-50 border-emerald-200" : "text-slate-500 bg-slate-100 border-slate-200"}`}>
								{status}
							</div>
						</div>
						<div className="h-2 w-full bg-slate-200 rounded-full overflow-hidden relative">
							<div className={`h-full rounded-full ${isOpen ? "bg-emerald-500" : "bg-slate-300"}`} style={{ width: isOpen ? `${fill}%` : "100%" }}></div>
						</div>
						{isOpen && fixed && (
							<button
								onClick={() => void run("Settle", () => send(fxVault.settle({ id: h.id }, opts), signTransaction))}
								disabled={!address || Boolean(pending)}
								className="w-full mt-3 py-2 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white rounded text-xs font-medium transition-colors"
							>
								Settle
							</button>
						)}
					</>
				)}
			</div>
		</div>
	)
}
