import { ArrowRight, Landmark } from "lucide-react"
import { useNavigate } from "react-router-dom"

export default function Landing() {
	const navigate = useNavigate()
	const onLaunch = () => void navigate("/connect")

	return (
		<div className="flex flex-col min-h-screen bg-white">
			<header className="border-b border-slate-200 bg-white sticky top-0 z-50">
				<div className="max-w-7xl mx-auto px-6 h-20 flex items-center justify-between">
					<div className="flex items-center gap-3">
						<div className="w-10 h-10 bg-slate-900 rounded-xl flex items-center justify-center">
							<Landmark className="text-white w-5 h-5" />
						</div>
						<span className="font-semibold text-xl tracking-tight text-slate-900">
							FX Hedge Vault
						</span>
					</div>
					<button
						onClick={onLaunch}
						className="bg-blue-600 hover:bg-blue-700 text-white px-6 py-2.5 rounded-lg text-sm font-medium transition-colors"
					>
						Launch App
					</button>
				</div>
			</header>

			<main className="flex-1 flex flex-col items-center justify-center text-center px-6 py-24">
				<h1 className="text-5xl md:text-7xl font-semibold tracking-tight text-slate-900 mb-6 max-w-4xl">
					Protect tomorrow&apos;s margins.
				</h1>

				<p className="text-lg md:text-xl text-slate-500 mb-10 max-w-2xl leading-relaxed">
					The institutional B2B infrastructure for Cash-Settled FX Forwards.
					Lock future exchange rates instantly with minimal margin and
					verifiable execution.
				</p>

				<button
					onClick={onLaunch}
					className="bg-slate-900 hover:bg-slate-800 text-white px-8 py-4 rounded-xl text-base font-medium transition-all shadow-lg flex items-center gap-2"
				>
					Connect Wallet <ArrowRight className="w-5 h-5" />
				</button>
			</main>
		</div>
	)
}
