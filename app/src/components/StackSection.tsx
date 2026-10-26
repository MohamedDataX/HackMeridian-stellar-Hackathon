import { Hourglass, Layers } from "lucide-react"
import { useEffect, useRef, useState } from "react"
import { scrollProgress } from "../hooks/useReveal"

/** The Zepho stack, bottom layer first. */
const LAYERS = [
	[
		"Settlement Layer",
		"Stellar settles every transaction in about 5 seconds, for a fraction of a cent, with final settlement.",
	],
	[
		"Currency Layer",
		"USDC through the Stellar Asset Contract: margins, fees and payouts move as a dollar stablecoin.",
	],
	[
		"Oracle Layer",
		"Reflector's EUR/USD feed (SEP-40) prices every quote, marks every hedge and records one fixing per maturity.",
	],
	[
		"Liquidity Layer",
		"An OpenZeppelin vault (SEP-56): liquidity providers back only the net exposure and earn the fees.",
	],
	[
		"Hedging Layer",
		"Zepho's Soroban contracts: forward rates, netting of opposite hedges, margin calls, close-out and settlement.",
	],
] as const

const INTRO_END = 0.16
const STEP = (1 - INTRO_END - 0.08) / LAYERS.length

/** Scroll-pinned stack: the intro blurs away, then each layer drops onto the pile. */
export default function StackSection() {
	const ref = useRef<HTMLElement>(null)
	const [p, setP] = useState(0)

	useEffect(() => {
		const on = () => ref.current && setP(scrollProgress(ref.current))
		on()
		window.addEventListener("scroll", on, { passive: true })
		window.addEventListener("resize", on)
		return () => {
			window.removeEventListener("scroll", on)
			window.removeEventListener("resize", on)
		}
	}, [])

	const intro = Math.min(1, Math.max(0, (p - 0.06) / (INTRO_END - 0.06)))
	const shown =
		p < INTRO_END
			? 0
			: Math.min(LAYERS.length, Math.floor((p - INTRO_END) / STEP) + 1)
	const active = Math.max(0, shown - 1)
	const layer = LAYERS[active] ?? LAYERS[0]

	return (
		<section ref={ref} id="stack" className="relative h-[600vh] bg-white">
			<div className="sticky top-0 h-screen overflow-hidden">
				{/* Intro */}
				<div
					className="absolute inset-0 flex flex-col items-center justify-center text-center px-6"
					style={{
						opacity: 1 - intro,
						transform: `translateY(${-56 * intro}px)`,
						filter: `blur(${32 * intro}px)`,
						pointerEvents: intro > 0.5 ? "none" : "auto",
					}}
				>
					<h2 className="font-display font-light text-5xl md:text-6xl tracking-tight text-slate-900 mb-4">
						One stack for
						<br />
						corporate FX
					</h2>
					<p className="text-sm text-slate-500 max-w-md">
						Settlement, currency, oracle, liquidity and hedging, assembled on
						Stellar from the ground up.
					</p>
				</div>

				{/* Body */}
				<div
					className="absolute inset-0 max-w-6xl mx-auto px-6 grid md:grid-cols-2 gap-10 items-center"
					style={{ opacity: shown > 0 ? 1 : 0, transition: "opacity 0.4s" }}
				>
					<div className="relative h-[420px]">
						{LAYERS.map(([name], i) => (
							<Plate
								key={name}
								index={i}
								name={name}
								visible={i < shown}
								top={i === LAYERS.length - 1}
							/>
						))}
					</div>

					<div
						key={active}
						className="rounded-2xl bg-slate-50 p-8 min-h-[220px] flex flex-col animate-[fadein_0.5s_ease]"
					>
						<div className="flex items-center gap-2 text-xs font-semibold text-slate-700">
							<span className="w-6 h-6 rounded-full bg-sky-500 text-white flex items-center justify-center">
								<Layers className="w-3.5 h-3.5" />
							</span>
							Zepho Stack
						</div>
						<div className="font-display font-light text-4xl text-slate-900 mt-4 mb-auto">
							{layer[0]}
						</div>
						<p className="text-sm text-slate-600 mt-8 leading-relaxed">
							{layer[1]}
						</p>
						<div className="flex gap-1.5 mt-6">
							{LAYERS.map(([name], i) => (
								<span
									key={name}
									className={`h-1 flex-1 rounded-full ${i < shown ? "bg-sky-500" : "bg-slate-200"}`}
								/>
							))}
						</div>
					</div>
				</div>
			</div>
		</section>
	)
}

/** One isometric plate; the top one carries the brand. */
const Plate = ({
	index,
	name,
	visible,
	top,
}: {
	index: number
	name: string
	visible: boolean
	top: boolean
}) => {
	const id = `plate-${index}`
	return (
		<div
			className="absolute left-1/2 w-[400px] -ml-[200px]"
			style={{
				bottom: `${40 + index * 36}px`,
				zIndex: index,
				opacity: visible ? 1 : 0,
				transform: visible ? "none" : "translateY(-90px)",
				filter: visible ? "none" : "blur(12px)",
				transition:
					"opacity 0.6s ease, transform 0.8s cubic-bezier(0.16,1,0.3,1), filter 0.6s ease",
			}}
		>
			<svg viewBox="0 0 400 248" className="w-full drop-shadow-xl" aria-hidden>
				<defs>
					<linearGradient id={`${id}-top`} x1="0" y1="0" x2="1" y2="1">
						<stop offset="0" stopColor={top ? "#38bdf8" : "#0a0a0a"} />
						<stop offset="1" stopColor={top ? "#0284c7" : "#3f3f46"} />
					</linearGradient>
				</defs>
				<polygon
					points="200,0 400,115 200,230 0,115"
					fill={`url(#${id}-top)`}
				/>
				<polygon
					points="0,115 200,230 200,246 0,131"
					fill={top ? "#0369a1" : "#18181b"}
				/>
				<polygon
					points="200,230 400,115 400,131 200,246"
					fill={top ? "#075985" : "#27272a"}
				/>
				<text
					x="0"
					y="0"
					transform="translate(300,186) rotate(-29.9)"
					fontSize="11"
					fill={top ? "#e0f2fe" : "#a1a1aa"}
					textAnchor="middle"
					fontFamily="Plus Jakarta Sans, sans-serif"
				>
					{name}
				</text>
			</svg>
			{top && (
				<div className="absolute left-[34%] top-[50%] flex items-center gap-1.5 text-white font-extrabold text-lg -rotate-[30deg] skew-x-[30deg]">
					<Hourglass className="w-4 h-4" strokeWidth={2.5} /> zepho
				</div>
			)}
		</div>
	)
}
