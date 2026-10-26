import {
	connectWallet,
	disconnectWallet,
	shortAddress,
} from "@stellar-scaffold/app-lib"
import { ChevronDown, Landmark, LogOut, Wallet } from "lucide-react"
import { Navigate, useNavigate, useParams } from "react-router-dom"
import CorporateTerminal from "../components/CorporateTerminal"
import LiquidityVaultTerminal from "../components/LiquidityVaultTerminal"
import OperatorTerminal from "../components/OperatorTerminal"
import { useWallet } from "../hooks/useWallet"
import { PROFILES } from "../lib/personas"

export default function Dashboard() {
	const { profileId = "" } = useParams()
	const navigate = useNavigate()
	const { address, isPending } = useWallet()
	const profile = PROFILES[profileId]
	if (!profile) return <Navigate to="/connect" replace />

	const mismatch = Boolean(address) && address !== profile.address
	const onLogout = async () => {
		await disconnectWallet()
		void navigate("/")
	}

	return (
		<div className="flex flex-col h-screen">
			{/* HEADER */}
			<header className="bg-white border-b border-slate-200 h-16 shrink-0 flex items-center justify-between px-6 sticky top-0 z-20">
				<div className="flex items-center gap-6">
					<div className="flex items-center gap-3">
						<div className="w-8 h-8 bg-slate-900 rounded-lg flex items-center justify-center">
							<Landmark className="text-white w-4 h-4" />
						</div>
						<span className="font-semibold text-slate-900 tracking-tight">FX Hedge Vault</span>
					</div>
					<div className="hidden md:flex items-center gap-2 px-3 py-1 rounded bg-amber-50 border border-amber-200 text-amber-700 text-[10px] font-bold uppercase tracking-wider">
						Stellar Testnet
					</div>
				</div>

				<div className="flex items-center gap-4">
					{/* Profile Switcher */}
					<div className="relative group">
						<select
							value={profile.id}
							onChange={(e) => void navigate(`/app/${e.target.value}`)}
							aria-label="Persona"
							className="appearance-none bg-slate-50 border border-slate-200 text-slate-700 text-sm rounded-lg focus:ring-2 focus:ring-blue-600 outline-none block pl-9 pr-8 py-2 font-medium cursor-pointer hover:bg-slate-100 transition-colors"
						>
							{Object.values(PROFILES).map((p) => (
								<option key={p.id} value={p.id}>
									{p.name} ({p.role.split(" ")[0]})
								</option>
							))}
						</select>
						<profile.icon className="w-4 h-4 text-slate-500 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
						<ChevronDown className="w-4 h-4 text-slate-400 absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
					</div>

					{address ? (
						<div
							title={mismatch ? `Switch Freighter to the ${profile.name} account to sign` : address}
							className={`hidden sm:flex items-center gap-2 px-3 py-2 rounded-lg border text-xs font-medium font-mono ${mismatch ? "bg-amber-50 border-amber-200 text-amber-700" : "bg-slate-50 border-slate-200 text-slate-600"}`}
						>
							<Wallet className={`w-3.5 h-3.5 ${mismatch ? "text-amber-600" : "text-blue-600"}`} />
							{shortAddress(address)}
						</div>
					) : (
						<button
							onClick={() => void connectWallet()}
							disabled={isPending}
							className="flex items-center gap-2 px-3 py-2 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-xs font-medium"
						>
							<Wallet className="w-3.5 h-3.5" /> Connect
						</button>
					)}

					<button
						onClick={() => void onLogout()}
						className="p-2 text-slate-400 hover:text-slate-900 hover:bg-slate-100 rounded-lg transition-colors"
						title="Disconnect"
					>
						<LogOut className="w-5 h-5" />
					</button>
				</div>
			</header>

			{/* DYNAMIC CONTENT ROUTING based on profile type */}
			<main className="flex-1 overflow-y-auto p-6 md:p-10">
				<div className="max-w-6xl mx-auto">
					{profile.type === "corporate" && <CorporateTerminal key={profile.id} profile={profile} />}
					{profile.type === "lp" && <LiquidityVaultTerminal />}
					{profile.type === "admin" && <OperatorTerminal />}
				</div>
			</main>
		</div>
	)
}
