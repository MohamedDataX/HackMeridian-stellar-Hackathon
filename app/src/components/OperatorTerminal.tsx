import { demoOracle, fxVault } from "@stellar-scaffold/app-lib/clients"
import { useState } from "react"
import {
	useAction,
	useHedges,
	useMaturities,
	useNow,
	useOracle,
} from "../hooks/useFx"
import { useWallet } from "../hooks/useWallet"
import { fmtRate, parseRate, send, timeLeft } from "../lib/fx"

const PRESETS = ["1.1193", "1.0800", "1.0793"]

/** Operator controls: the oracle rate, maturities, fixing and settlement. */
export default function OperatorTerminal() {
	const { address, signTransaction } = useWallet()
	const now = useNow()
	const { data: oracle } = useOracle()
	const { data: maturities = [] } = useMaturities()
	const { data: hedges = [] } = useHedges()
	const { run, pending } = useAction()
	const [minutes, setMinutes] = useState("4")
	const [days, setDays] = useState("360")
	const opts = { publicKey: address }
	const busy = !address || Boolean(pending)

	const due = maturities.filter((m) => m.fixing == null && Number(m.timestamp) <= now)
	const fixed = new Set(maturities.filter((m) => m.fixing != null).map((m) => m.timestamp.toString()))
	const toSettle = hedges.filter((h) => h.status.tag === "Open" && fixed.has(h.maturity.toString()))

	const setPrice = (p: string) =>
		run("Set rate", () => send(demoOracle.set_price({ price: parseRate(p) }, opts), signTransaction))

	return (
		<div className="space-y-10">
			<div>
				<h1 className="text-2xl font-semibold text-slate-900">Operator Dashboard</h1>
				<p className="text-sm text-slate-500 mt-1">Oracle relay, maturities and settlement.</p>
			</div>

			<div className="grid lg:grid-cols-3 gap-6">
				<div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm">
					<div className="text-[11px] text-slate-500 uppercase tracking-wider font-semibold mb-2">EUR/USD Oracle</div>
					<div className="text-3xl font-semibold font-mono text-slate-900">
						{oracle?.demo ? fmtRate(oracle.demo.price, 4) : "…"}
					</div>
					<div className="text-xs text-slate-500 mb-5">
						{oracle ? (oracle.manual != null ? "Manual rate" : "Relaying Reflector") : ""}
					</div>
					<div className="flex flex-wrap gap-2">
						{PRESETS.map((p) => (
							<button key={p} onClick={() => void setPrice(p)} disabled={busy}
								className="px-3 py-1.5 rounded-lg border border-slate-200 hover:bg-slate-50 disabled:opacity-50 font-mono text-sm">
								{p}
							</button>
						))}
						<button onClick={() => void run("Back to Reflector", () => send(demoOracle.relay(opts), signTransaction))} disabled={busy}
							className="px-3 py-1.5 rounded-lg bg-slate-900 hover:bg-slate-800 disabled:opacity-50 text-white text-sm">
							Back to Reflector
						</button>
					</div>
				</div>

				<div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm">
					<div className="text-[11px] text-slate-500 uppercase tracking-wider font-semibold mb-4">Open Maturity</div>
					<div className="grid grid-cols-2 gap-3 mb-4">
						<label className="text-xs text-slate-500">
							In (minutes)
							<input value={minutes} onChange={(e) => setMinutes(e.target.value)} inputMode="numeric"
								className="mt-1 w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-md font-mono text-slate-900" />
						</label>
						<label className="text-xs text-slate-500">
							Priced as (days)
							<input value={days} onChange={(e) => setDays(e.target.value)} inputMode="numeric"
								className="mt-1 w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-md font-mono text-slate-900" />
						</label>
					</div>
					<button
						onClick={() => void run("Open maturity", () => send(fxVault.open_maturity({
							timestamp: BigInt(Math.floor(Date.now() / 1000) + Number(minutes) * 60),
							pricing_secs: BigInt(Number(days) * 86_400),
						}, opts), signTransaction))}
						disabled={busy}
						className="w-full py-2.5 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white rounded-lg text-sm font-medium"
					>
						Open Maturity
					</button>
				</div>

				<div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm">
					<div className="text-[11px] text-slate-500 uppercase tracking-wider font-semibold mb-4">Fixing & Settlement</div>
					{due.length === 0 && toSettle.length === 0 && (
						<p className="text-sm text-slate-500">
							{maturities.some((m) => m.fixing == null && Number(m.timestamp) > now)
								? `Next maturity in ${timeLeft(Math.min(...maturities.filter((m) => m.fixing == null && Number(m.timestamp) > now).map((m) => Number(m.timestamp))), now)}`
								: "Nothing to fix or settle."}
						</p>
					)}
					<div className="space-y-2">
						{due.map((m) => (
							<button key={m.timestamp.toString()} disabled={busy}
								onClick={() => void run("Fixing", () => send(fxVault.fix({ maturity: m.timestamp }, opts), signTransaction))}
								className="w-full py-2.5 bg-slate-900 hover:bg-slate-800 disabled:opacity-50 text-white rounded-lg text-sm font-medium">
								Record Fixing
							</button>
						))}
						{toSettle.map((h) => (
							<button key={h.id} disabled={busy}
								onClick={() => void run("Settle", () => send(fxVault.settle({ id: h.id }, opts), signTransaction))}
								className="w-full py-2.5 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white rounded-lg text-sm font-medium">
								Settle NDF-{h.id}
							</button>
						))}
					</div>
				</div>
			</div>
		</div>
	)
}
