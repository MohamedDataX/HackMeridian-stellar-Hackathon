import { BarChart3, Check, ShieldCheck, Zap } from "lucide-react"
import { useNavigate } from "react-router-dom"
import SiteHeader from "../components/SiteHeader"
import { useParams } from "../hooks/useFx"

/** Basis points to a percentage label, e.g. 30 -> "0.30%". */
const pct = (bps: number) => `${(bps / 100).toFixed(2)}%`

const INCLUDED = [
	{
		icon: Zap,
		title: "Hedging",
		items: [
			"EUR/USD forwards on monthly maturities",
			"Opposite hedges offset each other",
			"Margin calls and top-ups",
			"One fixing per maturity",
			"Settlement in USDC in seconds",
		],
	},
	{
		icon: ShieldCheck,
		title: "Security",
		items: [
			"Soroban smart contracts on Stellar",
			"Oracle freshness checks",
			"Net exposure limit for the vault",
			"Liquidity withdrawals capped to free funds",
			"Pause switch",
		],
	},
	{
		icon: BarChart3,
		title: "Reporting",
		items: [
			"Live mark-to-market",
			"Margin health per position",
			"Net exposure per maturity",
			"Every action visible on Stellar Expert",
		],
	},
]

export default function Pricing() {
	const navigate = useNavigate()
	const { data: p } = useParams()

	// Fees and margins come from the contract's parameters
	const fee = Number(p?.fee_bps ?? 30n)
	const down = (fee * Number(p?.fee_down_bps ?? 5000n)) / 10_000
	const up = (fee * Number(p?.fee_up_bps ?? 20000n)) / 10_000
	const im = Number(p?.im_bps ?? 500n)
	const mm = Number(p?.mm_bps ?? 300n)
	const penalty = Number(p?.penalty_bps ?? 100n)
	const cap = Number(p?.cap_bps ?? 2000n)
	const carry = Number(p?.carry_bps ?? 150n)

	const tiers = [
		["Your hedge balances the maturity", pct(down), "Opposite side to the open net exposure"],
		["Neutral hedge", pct(fee), "Base fee"],
		["Your hedge widens the net exposure", pct(up), "Same side as the open net exposure"],
	]

	const compare = [
		["Forward rate", `Reflector spot + ${pct(carry)} p.a. differential, shown`, "Spread not disclosed"],
		["Hedging fee", `${pct(down)} – ${pct(up)}, shown before signing`, "Not disclosed"],
		["Collateral", `${pct(im)} margin, no credit line`, "Credit line"],
		["Settlement", "USDC, in seconds", "Bank transfer"],
	]

	return (
		<div className="flex flex-col min-h-screen bg-white">
			<SiteHeader />

			<main className="flex-1">
				{/* Hero */}
				<section className="bg-sky-50/60">
					<div className="max-w-5xl mx-auto px-6 py-20 text-center">
						<h1 className="text-4xl md:text-5xl font-bold tracking-tight text-slate-800 mb-5">
							Transparent pricing, <span className="text-sky-500">no surprises.</span>
						</h1>
						<p className="text-lg text-slate-600 mb-12">
							No setup fees. No monthly fees. Pay per hedge, with every term shown before you sign.
						</p>

						<div className="grid sm:grid-cols-2 gap-6 max-w-2xl mx-auto">
							<div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-8">
								<div className="text-sm text-slate-500 mb-2">Hedge pricing from</div>
								<div className="text-5xl font-bold tracking-tight text-slate-800">{pct(down)}</div>
								<div className="text-xs text-slate-400 mt-2 font-mono">{down} BPS</div>
							</div>
							<div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-8">
								<div className="text-sm text-slate-500 mb-2">Initial margin</div>
								<div className="text-5xl font-bold tracking-tight text-slate-800">{pct(im).replace(".00", "")}</div>
								<div className="text-xs text-slate-400 mt-2">refunded at maturity</div>
							</div>
						</div>
					</div>
				</section>

				{/* Key benefits */}
				<section className="max-w-5xl mx-auto px-6 py-12">
					<div className="text-center text-xs font-semibold tracking-widest text-slate-500 mb-6">KEY BENEFITS</div>
					<div className="grid grid-cols-2 md:grid-cols-4 gap-3">
						{["No setup fees", "No monthly fees", "Pay per hedge", "Full transparency"].map((b) => (
							<div key={b} className="bg-sky-50 text-slate-700 text-sm font-medium text-center rounded-lg py-3">
								{b}
							</div>
						))}
					</div>
				</section>

				{/* Fee tiers */}
				<section className="bg-slate-900 text-white">
					<div className="max-w-5xl mx-auto px-6 py-20">
						<h2 className="text-3xl font-bold text-center mb-3">Zepho pricing tiers</h2>
						<p className="text-slate-400 text-center mb-12">
							The fee depends on how your hedge moves the vault&apos;s net exposure on its maturity.
						</p>
						<div className="divide-y divide-white/10 border-y border-white/10">
							<div className="grid grid-cols-3 py-4 text-sm text-slate-400">
								<span>Your hedge</span>
								<span className="text-center">Fee (of the order value)</span>
								<span className="text-right">When</span>
							</div>
							{tiers.map(([who, value, when]) => (
								<div key={who} className="grid grid-cols-3 py-5 items-center">
									<span className="font-medium">{who}</span>
									<span className="text-center text-2xl font-semibold text-sky-400 font-mono">{value}</span>
									<span className="text-right text-sm text-slate-400">{when}</span>
								</div>
							))}
						</div>
						<div className="grid sm:grid-cols-4 gap-4 mt-10 text-center">
							{[
								["Initial margin", pct(im)],
								["Maintenance margin", pct(mm)],
								["Close-out penalty", pct(penalty)],
								["Payout cap", pct(cap)],
							].map(([label, value]) => (
								<div key={label} className="rounded-xl border border-white/10 py-4">
									<div className="text-xs text-slate-400 mb-1">{label}</div>
									<div className="font-mono font-semibold">{value}</div>
								</div>
							))}
						</div>
					</div>
				</section>

				{/* No hidden markups */}
				<section className="max-w-4xl mx-auto px-6 py-20">
					<h2 className="text-3xl font-bold text-slate-800 text-center mb-3">No hidden markups</h2>
					<p className="text-slate-600 text-center mb-10">
						Banks and brokers build their margin into the rate. Zepho shows the forward points and the fee separately.
					</p>
					<div className="grid grid-cols-3 gap-3 text-sm">
						<span />
						<span className="text-center font-semibold text-slate-800">Zepho</span>
						<span className="text-center font-semibold text-slate-800">Bank / broker</span>
						{compare.map(([label, zepho, bank]) => (
							<div key={label} className="contents">
								<span className="bg-sky-50 rounded-lg px-4 py-3 font-medium text-slate-700">{label}</span>
								<span className="rounded-lg px-4 py-3 text-center text-slate-800 border border-slate-100">{zepho}</span>
								<span className="rounded-lg px-4 py-3 text-center text-slate-500 border border-slate-100">{bank}</span>
							</div>
						))}
					</div>

					<div className="mt-12 rounded-2xl border border-slate-200 p-8">
						<h3 className="font-semibold text-slate-800 mb-2">What are forward points?</h3>
						<p className="text-slate-600 text-sm leading-relaxed">
							The interest rate difference between USD and EUR, built into the forward rate:{" "}
							<span className="font-mono text-slate-800">K = S₀ × (1 + d × t)</span>, with S₀ the Reflector spot rate,
							d the published differential ({pct(carry)} a year today) and t the time to maturity.
						</p>
					</div>
				</section>

				{/* What's included */}
				<section className="bg-sky-50/60">
					<div className="max-w-5xl mx-auto px-6 py-20">
						<h2 className="text-3xl font-bold text-slate-800 mb-3">What&apos;s included</h2>
						<p className="text-slate-600 mb-12">Every hedge comes with the full clearing toolkit.</p>
						<div className="grid md:grid-cols-3 gap-10">
							{INCLUDED.map(({ icon: Icon, title, items }) => (
								<div key={title}>
									<div className="flex items-center gap-2 mb-5 text-slate-800 font-semibold">
										<Icon className="w-5 h-5 text-sky-500" /> {title}
									</div>
									<ul className="space-y-3">
										{items.map((i) => (
											<li key={i} className="flex gap-2 text-sm text-slate-600">
												<Check className="w-4 h-4 text-sky-500 shrink-0 mt-0.5" /> {i}
											</li>
										))}
									</ul>
								</div>
							))}
						</div>
					</div>
				</section>

				{/* CTA */}
				<section className="max-w-5xl mx-auto px-6 py-20 text-center">
					<h2 className="text-3xl font-bold text-slate-800 mb-6">Lock your next order&apos;s rate.</h2>
					<button
						onClick={() => void navigate("/connect")}
						className="bg-sky-500 hover:bg-sky-600 text-white px-7 py-3.5 rounded-lg text-base font-semibold transition-colors"
					>
						Connect Wallet
					</button>
				</section>
			</main>
		</div>
	)
}
