import {
	ArrowDown,
	ArrowRight,
	Building2,
	Check,
	Cpu,
	ExternalLink,
	Eye,
	Factory,
	Landmark,
	ShieldCheck,
} from "lucide-react"
import { useEffect, useRef, useState } from "react"
import { useNavigate } from "react-router-dom"
import SiteHeader from "../components/SiteHeader"
import StackSection from "../components/StackSection"
import { useParams, useVault } from "../hooks/useFx"
import { useReveal } from "../hooks/useReveal"

const REPO = "https://github.com/MohamedDataX/HackMeridian-stellar-Hackathon"
const EXPERT =
	"https://stellar.expert/explorer/testnet/contract/CBRJ6VSKB44BSCCJVMYT3CFDXHAEGJUXQFBPSGAW76W6IZCJEZRVR2VH"

/** Worked example from the white paper: 1,000,000 EUR at K = 1.10. */
const ORDER_USD = 1_100_000
const usd = (v: number) => `$${Math.round(v).toLocaleString("en-US")}`
const pct = (v: number) => `${(v * 100).toFixed(2)}%`

/** Technologies Zepho is built with, for the moving logo band. */
const TECH = [
	["Stellar", "/logos/stellar.svg"],
	["Soroban (Rust)", "/logos/rust.svg"],
	["Reflector", "/logos/reflector.svg"],
	["OpenZeppelin", "/logos/openzeppelin.svg"],
	["USDC", "/logos/usdc.svg"],
	["Freighter", "/logos/freighter.png"],
] as const

export default function Landing() {
	const navigate = useNavigate()
	const onLaunch = () => void navigate("/connect")
	const { data: p } = useParams()
	const { data: vault } = useVault()
	useReveal()

	// Fees and margins come from the contract's parameters
	const fee = Number(p?.fee_bps ?? 30n) / 10_000
	const down = (fee * Number(p?.fee_down_bps ?? 5000n)) / 10_000
	const up = (fee * Number(p?.fee_up_bps ?? 20000n)) / 10_000
	const im = Number(p?.im_bps ?? 500n) / 10_000
	const mm = Number(p?.mm_bps ?? 300n) / 10_000
	const penalty = Number(p?.penalty_bps ?? 100n) / 10_000
	const cap = Number(p?.cap_bps ?? 2000n) / 10_000
	const carry = Number(p?.carry_bps ?? 150n) / 10_000

	const stats = [
		["~5 s", "Settlement", "on Stellar"],
		[pct(down), "Hedge fee", "from"],
		[`${im * 100}%`, "Initial margin", "no credit line"],
		["1", "Fixing", "per maturity"],
	]

	const ways = [
		{
			icon: Factory,
			name: "Manufacturer",
			tag: "Pays USD, receives EUR",
			kpi: pct(down),
			kpiLabel: "Fee from",
			id: "manufacturer",
			style:
				"bg-gradient-to-br from-slate-900 via-slate-800 to-slate-600 text-white",
		},
		{
			icon: Cpu,
			name: "Foundry",
			tag: "Pays EUR, receives USD",
			kpi: `${im * 100}%`,
			kpiLabel: "Initial margin",
			id: "foundry",
			style:
				"bg-gradient-to-br from-slate-400 via-slate-200 to-slate-50 text-slate-900",
		},
		{
			icon: Building2,
			name: "Liquidity Provider",
			tag: "Back the net, earn the fees",
			id: "lp",
			kpi: vault ? (Number(vault.sharePrice) / 1e7).toFixed(4) : "…",
			kpiLabel: "Share price, live",
			style:
				"bg-gradient-to-br from-slate-200 via-white to-white text-slate-900 border border-slate-200",
		},
	]

	const bars = [
		{ label: "Fee, widening hedge", value: ORDER_USD * up },
		{ label: "Fee, neutral hedge", value: ORDER_USD * fee },
		{ label: "Fee, balancing hedge", value: ORDER_USD * down, hero: true },
		{ label: "Unhedged, euro −5%", value: ORDER_USD * 0.05 },
	]

	const tiers = [
		[
			"Your hedge balances the maturity",
			pct(down),
			"Opposite side to the open net exposure",
		],
		["Neutral hedge", pct(fee), "Base fee"],
		[
			"Your hedge widens the net exposure",
			pct(up),
			"Same side as the open net exposure",
		],
	]

	const compare = [
		[
			"Forward rate",
			`Reflector spot + ${pct(carry)} p.a., shown`,
			"Spread not disclosed",
		],
		[
			"Hedging fee",
			`${pct(down)} – ${pct(up)}, shown before signing`,
			"Not disclosed",
		],
		["Collateral", `${im * 100}% margin, no credit line`, "Credit line"],
		["Settlement", "USDC, in seconds", "Bank transfer"],
	]

	const trust = [
		{
			icon: Eye,
			title: "Radical Transparency",
			text: "Every hedge, margin call and settlement is a public Stellar transaction. The forward points and the fee are shown before signing.",
		},
		{
			icon: Landmark,
			title: "Regulated Distribution",
			text: "Zepho is infrastructure. Licensed FX partners onboard their business clients, run KYC and distribute the hedges.",
		},
		{
			icon: ShieldCheck,
			title: "Rigorous Risk Management",
			text: "Initial and maintenance margins, margin calls, close-out with penalty, and a net exposure limit for the vault.",
		},
	]

	return (
		<div id="top" className="flex flex-col min-h-screen bg-white">
			<SiteHeader />

			{/* Hero */}
			<section className="relative bg-black text-white overflow-hidden min-h-screen flex flex-col">
				<Swoosh />
				<div className="relative flex-1 flex flex-col items-center justify-center text-center px-6 pt-24">
					<h1 className="reveal font-display font-light text-6xl md:text-8xl tracking-tight leading-[1.02] mb-8">
						Protect tomorrow&apos;s
						<br />
						margins
					</h1>
					<p className="reveal text-slate-400 max-w-xl mb-10">
						EUR/USD forwards for the semiconductor supply chain, settled in USDC
						on Stellar.
					</p>
					<a
						href="#ways"
						className="reveal flex items-center gap-2 bg-white/10 hover:bg-white/15 border border-white/15 pl-5 pr-1.5 py-1.5 rounded-full text-sm font-medium"
					>
						Explore Zepho
						<span className="w-7 h-7 rounded-full bg-sky-500 flex items-center justify-center">
							<ArrowDown className="w-4 h-4" />
						</span>
					</a>
				</div>
				<div className="relative max-w-7xl w-full mx-auto px-6 pb-12 grid grid-cols-2 md:grid-cols-4 gap-8">
					{stats.map(([value, label, sub]) => (
						<div key={label} className="reveal flex items-end gap-3">
							<span className="font-display font-light text-4xl md:text-5xl">
								{value}
							</span>
							<span className="text-[11px] leading-tight text-slate-400 pb-1.5">
								{label}
								<br />
								{sub}
							</span>
						</div>
					))}
				</div>
			</section>

			{/* Technology band */}
			<section className="border-b border-slate-100 py-8 overflow-hidden">
				<div className="text-center text-[11px] font-semibold tracking-widest text-slate-400 mb-6">
					BUILT WITH
				</div>
				<div className="relative [mask-image:linear-gradient(to_right,transparent,black_12%,black_88%,transparent)]">
					<div className="marquee flex w-max gap-16">
						{[...TECH, ...TECH, ...TECH, ...TECH].map(([name, src], i) => (
							<div
								key={i}
								className="flex items-center gap-3 text-slate-500 shrink-0"
							>
								<img
									src={src}
									alt=""
									className="h-7 w-7 object-contain opacity-70 grayscale"
								/>
								<span className="text-lg font-semibold tracking-tight">
									{name}
								</span>
							</div>
						))}
					</div>
				</div>
			</section>

			{/* Ways to use */}
			<section id="ways" className="max-w-6xl w-full mx-auto px-6 py-28">
				<h2 className="reveal font-display font-light text-4xl md:text-5xl text-center tracking-tight mb-14">
					Ways to use Zepho
				</h2>
				<div className="grid md:grid-cols-3 gap-5">
					{ways.map((w) => (
						<div
							key={w.id}
							className={`reveal relative rounded-2xl p-7 h-80 flex flex-col overflow-hidden ${w.style}`}
						>
							<div className="flex justify-between items-start">
								<div>
									<div className="font-display text-3xl font-light leading-tight">
										{w.name}
									</div>
									<div className="text-sm opacity-70 mt-1">{w.tag}</div>
								</div>
								<span className="w-9 h-9 rounded-full bg-sky-500 text-white flex items-center justify-center">
									<w.icon className="w-4 h-4" />
								</span>
							</div>
							<div className="mt-auto">
								<div className="text-xs opacity-60 mb-1">{w.kpiLabel}</div>
								<div className="font-display font-light text-5xl mb-5">
									{w.kpi}
								</div>
								<button
									onClick={() => void navigate(`/app/${w.id}`)}
									className="flex items-center gap-2 bg-sky-500 hover:bg-sky-600 text-white pl-4 pr-1 py-1 rounded-full text-xs font-semibold"
								>
									Launch App
									<span className="w-6 h-6 rounded-full bg-white text-sky-500 flex items-center justify-center">
										<ArrowRight className="w-3.5 h-3.5" />
									</span>
								</button>
							</div>
						</div>
					))}
				</div>
			</section>

			{/* Stack */}
			<StackSection />

			{/* Diagram */}
			<section className="bg-black text-white">
				<div className="max-w-6xl mx-auto px-6 py-28">
					<h2 className="reveal font-display font-light text-4xl md:text-5xl text-center tracking-tight mb-3">
						Hedging costs a fraction of the risk
					</h2>
					<p className="reveal text-center text-sm text-slate-400 mb-16">
						Protecting a 1,000,000 € order sold at 1.10 USD per EUR
					</p>
					<Bars bars={bars} />
					<p className="text-center text-[11px] text-slate-500 mt-6">
						Zepho fees from the contract parameters. Unhedged: margin lost if
						the euro falls 5% before payment.
					</p>
				</div>
			</section>

			{/* Pricing */}
			<section
				id="pricing"
				className="max-w-5xl w-full mx-auto px-6 py-28 scroll-mt-20"
			>
				<h2 className="reveal font-display font-light text-4xl md:text-5xl text-center tracking-tight mb-4">
					Transparent pricing
				</h2>
				<p className="reveal text-center text-slate-500 mb-14">
					No setup fees. No monthly fees. Pay per hedge, with every term shown
					before you sign.
				</p>
				<div className="reveal divide-y divide-slate-100 border-y border-slate-100 mb-8">
					{tiers.map(([who, value, when]) => (
						<div key={who} className="grid grid-cols-3 py-5 items-center">
							<span className="font-medium text-slate-800">{who}</span>
							<span className="text-center font-display font-light text-3xl text-sky-500">
								{value}
							</span>
							<span className="text-right text-sm text-slate-500">{when}</span>
						</div>
					))}
				</div>
				<div className="reveal grid grid-cols-2 md:grid-cols-4 gap-3 mb-16">
					{[
						["Initial margin", im],
						["Maintenance margin", mm],
						["Close-out penalty", penalty],
						["Payout cap", cap],
					].map(([label, v]) => (
						<div
							key={label as string}
							className="rounded-xl bg-slate-50 py-4 text-center"
						>
							<div className="text-xs text-slate-500 mb-1">
								{label as string}
							</div>
							<div className="font-mono font-semibold text-slate-800">
								{pct(v as number)}
							</div>
						</div>
					))}
				</div>
				<div className="reveal grid grid-cols-3 gap-3 text-sm">
					<span />
					<span className="text-center font-semibold text-slate-800">
						Zepho
					</span>
					<span className="text-center font-semibold text-slate-800">
						Bank / broker
					</span>
					{compare.map(([label, zepho, bank]) => (
						<div key={label} className="contents">
							<span className="bg-sky-50 rounded-lg px-4 py-3 font-medium text-slate-700">
								{label}
							</span>
							<span className="rounded-lg px-4 py-3 text-center text-slate-800 border border-slate-100">
								{zepho}
							</span>
							<span className="rounded-lg px-4 py-3 text-center text-slate-500 border border-slate-100">
								{bank}
							</span>
						</div>
					))}
				</div>
			</section>

			{/* Trust */}
			<section className="bg-black text-white">
				<div className="max-w-6xl mx-auto px-6 py-28">
					<h2 className="reveal font-display font-light text-4xl md:text-5xl text-center tracking-tight mb-14">
						Institutional-grade by design
						<br />
						Verifiable by default
					</h2>
					<div className="grid md:grid-cols-3 gap-5">
						{trust.map((t) => (
							<div
								key={t.title}
								className="reveal rounded-2xl bg-gradient-to-b from-zinc-800 to-zinc-950 p-7 h-72 flex flex-col"
							>
								<span className="w-8 h-8 rounded-full bg-sky-500 flex items-center justify-center">
									<t.icon className="w-4 h-4" />
								</span>
								<div className="font-display font-light text-2xl mt-auto mb-3">
									{t.title}
								</div>
								<p className="text-sm text-slate-400 leading-relaxed">
									{t.text}
								</p>
							</div>
						))}
					</div>
				</div>
			</section>

			{/* About */}
			<section
				id="about"
				className="max-w-3xl w-full mx-auto px-6 py-28 scroll-mt-20"
			>
				<h2 className="reveal font-display font-light text-4xl md:text-5xl tracking-tight mb-6">
					About <span className="text-sky-500">Zepho</span>
				</h2>
				<p className="reveal text-lg text-slate-600 leading-relaxed mb-8">
					Semiconductor companies set prices months before they are paid, often
					in another currency. Zepho lets them lock their EUR/USD rate from
					order to delivery, at a transparent price, by matching companies whose
					currency risks are opposite.
				</p>
				<ul className="reveal space-y-3 mb-10">
					{[
						"A company locks a forward rate on a monthly maturity, with a 5% margin and no credit line.",
						"Opposite hedges on the same maturity cancel out; a liquidity vault backs only the gap.",
						"At maturity, one oracle fixing settles every hedge in USDC on Stellar.",
					].map((t) => (
						<li key={t} className="flex gap-3 text-slate-600">
							<Check className="w-5 h-5 text-sky-500 shrink-0 mt-0.5" /> {t}
						</li>
					))}
				</ul>
				<div className="reveal flex flex-wrap gap-3">
					<button
						onClick={onLaunch}
						className="flex items-center gap-2 bg-sky-500 hover:bg-sky-600 text-white pl-5 pr-1.5 py-1.5 rounded-full text-sm font-semibold"
					>
						Connect Wallet
						<span className="w-7 h-7 rounded-full bg-white text-sky-500 flex items-center justify-center">
							<ArrowRight className="w-4 h-4" />
						</span>
					</button>
					<a
						href={REPO}
						target="_blank"
						rel="noreferrer"
						className="inline-flex items-center gap-2 border border-slate-300 hover:border-slate-900 text-slate-800 px-5 py-2.5 rounded-full text-sm font-semibold"
					>
						Source code <ExternalLink className="w-4 h-4" />
					</a>
					<a
						href={EXPERT}
						target="_blank"
						rel="noreferrer"
						className="inline-flex items-center gap-2 border border-slate-300 hover:border-slate-900 text-slate-800 px-5 py-2.5 rounded-full text-sm font-semibold"
					>
						Contract on Stellar Expert <ExternalLink className="w-4 h-4" />
					</a>
				</div>
			</section>

			<footer className="border-t border-slate-100 py-8 px-6 text-center text-xs text-slate-400">
				Zepho runs on the Stellar testnet with test USDC. An FX forward sold to
				companies is a regulated derivative, distributed through licensed
				partners. This website is not an offer of a financial instrument.
			</footer>
		</div>
	)
}

/** Bars that grow when the chart scrolls into view; one highlighted. */
const Bars = ({
	bars,
}: {
	bars: { label: string; value: number; hero?: boolean }[]
}) => {
	const ref = useRef<HTMLDivElement>(null)
	const [inView, setInView] = useState(false)
	useEffect(() => {
		const io = new IntersectionObserver(
			([e]) => e?.isIntersecting && setInView(true),
			{ threshold: 0.3 },
		)
		if (ref.current) io.observe(ref.current)
		return () => io.disconnect()
	}, [])
	const max = Math.max(...bars.map((b) => b.value))
	return (
		<div ref={ref} className="grid grid-cols-4 gap-3 items-end h-[440px]">
			{bars.map((b, i) => (
				<div
					key={b.label}
					className="flex flex-col items-center justify-end h-full"
				>
					<div className="text-[10px] text-slate-400 mb-1">USD</div>
					<div
						className={`font-display font-light mb-3 ${b.hero ? "text-4xl" : "text-2xl"}`}
					>
						{usd(b.value)}
					</div>
					<div
						className={`w-full rounded-t-md flex items-start justify-center pt-4 text-xs font-semibold overflow-hidden ${
							b.hero
								? "bg-sky-500 text-white"
								: "bg-gradient-to-b from-zinc-700 to-zinc-900 text-slate-200"
						}`}
						style={{
							height: inView ? `${60 + (300 * b.value) / max}px` : "0px",
							transition: `height 1.1s cubic-bezier(0.16,1,0.3,1) ${i * 0.12}s`,
						}}
					>
						{b.label}
					</div>
				</div>
			))}
		</div>
	)
}

/** Two chrome ribbons sweeping across the hero. */
const Swoosh = () => (
	<svg
		className="absolute inset-0 w-full h-full pointer-events-none"
		viewBox="0 0 1440 720"
		preserveAspectRatio="xMidYMid slice"
		aria-hidden
	>
		<defs>
			<linearGradient id="chrome" x1="0" y1="0" x2="1" y2="1">
				<stop offset="0" stopColor="#f8fafc" stopOpacity="0.9" />
				<stop offset="0.35" stopColor="#64748b" stopOpacity="0.55" />
				<stop offset="0.6" stopColor="#e2e8f0" stopOpacity="0.8" />
				<stop offset="1" stopColor="#0f172a" stopOpacity="0.2" />
			</linearGradient>
		</defs>
		<path
			d="M-80 760 C 140 520, 260 160, 470 -40"
			fill="none"
			stroke="url(#chrome)"
			strokeWidth="46"
			strokeLinecap="round"
		/>
		<path
			d="M-40 760 C 180 520, 300 160, 510 -40"
			fill="none"
			stroke="#94a3b8"
			strokeOpacity="0.35"
			strokeWidth="1.5"
		/>
		<path
			d="M1150 780 C 1240 560, 1330 300, 1520 40"
			fill="none"
			stroke="url(#chrome)"
			strokeWidth="46"
			strokeLinecap="round"
		/>
		<path
			d="M1110 780 C 1200 560, 1290 300, 1480 40"
			fill="none"
			stroke="#94a3b8"
			strokeOpacity="0.35"
			strokeWidth="1.5"
		/>
	</svg>
)
