import { connectWallet, shortAddress } from "@stellar-scaffold/app-lib"
import { ArrowRight, ShieldCheck, Wallet } from "lucide-react"
import { useNavigate } from "react-router-dom"
import { useWallet } from "../hooks/useWallet"
import { PROFILES } from "../lib/personas"

export default function Login() {
	const navigate = useNavigate()
	const { address, isPending } = useWallet()

	return (
		<div className="min-h-screen bg-slate-50 flex items-center justify-center p-6 relative">
			<button
				onClick={() => void navigate("/")}
				className="absolute top-8 left-8 text-slate-500 hover:text-slate-900 flex items-center gap-2 font-medium transition-colors"
			>
				<ArrowRight className="w-5 h-5 rotate-180" /> Back
			</button>

			<div className="bg-white p-10 rounded-2xl shadow-xl border border-slate-200 max-w-md w-full">
				<div className="w-12 h-12 mb-6 bg-blue-50 text-blue-600 rounded-xl flex items-center justify-center border border-blue-100">
					<Wallet className="w-6 h-6" />
				</div>

				<h1 className="text-2xl font-semibold text-slate-900 mb-2">Connect Wallet</h1>
				<p className="text-slate-500 mb-8 text-sm">
					Select a persona to access the respective dashboard.
				</p>

				<div className="space-y-3">
					{Object.values(PROFILES).map((p) => {
						const Icon = p.icon
						const connected = Boolean(address) && address === p.address
						return (
							<button
								key={p.id}
								onClick={() => void navigate(`/app/${p.id}`)}
								className={`w-full flex items-center gap-4 bg-white border hover:border-blue-600 hover:bg-blue-50 hover:shadow-sm text-left p-4 rounded-xl transition-all duration-200 group ${connected ? "border-blue-600" : "border-slate-200"}`}
							>
								<div className="w-10 h-10 rounded-lg bg-slate-100 group-hover:bg-blue-100 flex items-center justify-center text-slate-600 group-hover:text-blue-600 transition-colors">
									<Icon className="w-5 h-5" />
								</div>
								<div>
									<div className="font-semibold text-slate-900 group-hover:text-blue-700">
										{p.name}
									</div>
									<div className="text-xs text-slate-500 mt-0.5">{p.role}</div>
								</div>
							</button>
						)
					})}
				</div>

				<div className="mt-8 pt-6 border-t border-slate-100 flex items-center justify-center gap-2 text-xs text-slate-400 font-mono">
					<ShieldCheck className="w-4 h-4" />
					{address ? (
						<span>Freighter connected · {shortAddress(address)}</span>
					) : (
						<button
							onClick={() => void connectWallet()}
							disabled={isPending}
							className="underline hover:text-slate-900"
						>
							Connect Freighter
						</button>
					)}
				</div>
			</div>
		</div>
	)
}
