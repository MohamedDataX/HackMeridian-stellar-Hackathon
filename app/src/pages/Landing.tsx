import { ArrowRight } from "lucide-react"
import { useNavigate } from "react-router-dom"
import SiteHeader from "../components/SiteHeader"

export default function Landing() {
	const navigate = useNavigate()
	const onLaunch = () => void navigate("/connect")

	return (
		<div className="flex flex-col min-h-screen bg-white">
			<SiteHeader />

			<main className="flex-1 max-w-7xl w-full mx-auto px-6 grid lg:grid-cols-2 gap-16 items-center py-20">
				<div>
					<h1 className="text-5xl md:text-6xl font-bold tracking-tight text-slate-800 mb-6 leading-[1.05]">
						Protect tomorrow&apos;s <span className="text-sky-500">margins.</span>
					</h1>

					<p className="text-xl text-slate-600 mb-3 max-w-xl leading-relaxed">
						The institutional B2B infrastructure for Cash-Settled FX Forwards.
						Lock future exchange rates instantly with{" "}
						<span className="text-sky-500 font-semibold">minimal margin</span> and{" "}
						<span className="text-sky-500 font-semibold">verifiable execution</span>.
					</p>
					<p className="text-base italic text-slate-500 mb-10">Settled in USDC on Stellar.</p>

					<button
						onClick={onLaunch}
						className="bg-sky-500 hover:bg-sky-600 text-white px-7 py-3.5 rounded-lg text-base font-semibold transition-colors flex items-center gap-2"
					>
						Connect Wallet <ArrowRight className="w-5 h-5" />
					</button>
				</div>

				<div className="relative h-[520px] hidden lg:block">
					<img
						src="/quote.png"
						alt="Forward quote"
						className="absolute right-0 top-0 w-[360px] rounded-2xl border border-slate-100 shadow-xl"
					/>
					<img
						src="/exposure.png"
						alt="Net exposure allocation"
						className="absolute left-0 bottom-0 w-[440px] rounded-2xl border border-slate-100 shadow-xl"
					/>
				</div>
			</main>
		</div>
	)
}
