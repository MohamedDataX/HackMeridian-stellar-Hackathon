import { lpVault } from "@stellar-scaffold/app-lib/clients"
import { useState } from "react"
import {
	useAction,
	useHedges,
	useShares,
	useUsdcBalance,
	useVault,
} from "../hooks/useFx"
import { useWallet } from "../hooks/useWallet"
import { ONE, fmtAmount, parseAmount, send } from "../lib/fx"

const millions = (v: bigint) => `€${(Number(v / ONE) / 1e6).toFixed(2)}M`

export default function LiquidityVaultTerminal() {
	const { address, signTransaction } = useWallet()
	const { data: vault } = useVault()
	const { data: hedges = [] } = useHedges()
	const { data: mine } = useShares(address)
	const { data: usdc } = useUsdcBalance(address)
	const { run, pending } = useAction()
	const [amount, setAmount] = useState("")

	const open = hedges.filter((h) => h.status.tag === "Open")
	const buyers = open.filter((h) => h.side.tag === "BuyEur").reduce((s, h) => s + h.notional, 0n)
	const sellers = open.filter((h) => h.side.tag === "SellEur").reduce((s, h) => s + h.notional, 0n)
	const total = buyers + sellers
	const buyPct = total > 0n ? Number((buyers * 1000n) / total) / 10 : 50
	const net = buyers > sellers ? buyers - sellers : sellers - buyers
	const myValue = mine && vault ? (mine.shares * vault.sharePrice) / ONE : 0n

	let parsed: bigint | undefined
	try {
		parsed = parseAmount(amount)
	} catch {
		parsed = undefined
	}

	const act = (label: "Deposit" | "Withdraw") =>
		run(label, async () => {
			if (!address || !parsed) return
			const args = { assets: parsed, receiver: address, operator: address }
			await send(
				label === "Deposit"
					? lpVault.deposit({ ...args, from: address }, { publicKey: address })
					: lpVault.withdraw({ ...args, owner: address }, { publicKey: address }),
				signTransaction,
			)
		})

	return (
		<div className="space-y-10">
			{/* Title */}
			<div>
				<h1 className="text-2xl font-semibold text-slate-900">Liquidity Vault Dashboard</h1>
				<p className="text-sm text-slate-500 mt-1">Monitor pool exposure and manage LP capital.</p>
			</div>

			{/* KPIs */}
			<div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
				<Kpi label="Total Value Locked" value={vault ? fmtAmount(vault.total, 0) : "…"} />
				<Kpi label="Share Price (FXV)" value={vault ? (Number(vault.sharePrice) / 1e7).toFixed(4) : "…"} />
				<Kpi label="Deployed in Hedges" value={vault ? fmtAmount(vault.engaged, 0) : "…"} />
				<Kpi label="Available Liquidity" value={vault ? fmtAmount(vault.free, 0) : "…"} accent />
			</div>

			<div className="grid lg:grid-cols-3 gap-8">
				{/* Left: Net Exposure Gauge */}
				<div className="lg:col-span-2">
					<div className="bg-white p-8 rounded-xl border border-slate-200 shadow-sm h-full">
						<div className="mb-8">
							<h3 className="text-lg font-semibold text-slate-900">Net Exposure Allocation</h3>
							<p className="text-sm text-slate-500 mt-1">The vault only bears risk on the unhedged delta.</p>
						</div>

						<div className="space-y-3">
							<div className="flex justify-between text-sm mb-2">
								<span className="text-slate-700 font-medium">EUR Buyers (Foundries) - {buyPct.toFixed(0)}%</span>
								<span className="text-slate-700 font-medium">EUR Sellers (Manufacturers) - {(100 - buyPct).toFixed(0)}%</span>
							</div>

							{/* Split Progress Bar */}
							<div className="h-6 w-full bg-slate-100 rounded-full overflow-hidden flex border border-slate-200">
								<div className="h-full bg-slate-800 transition-all duration-1000" style={{ width: `${buyPct}%` }}></div>
								<div className="h-full bg-blue-500 transition-all duration-1000" style={{ width: `${100 - buyPct}%` }}></div>
							</div>

							<div className="flex justify-between text-xs text-slate-500 font-mono mt-4">
								<span>Notional: {millions(buyers)}</span>
								<span className="font-bold text-slate-900 bg-slate-100 px-2 py-1 rounded border border-slate-200">
									Net Risk: {millions(net)} (Delta)
								</span>
								<span>Notional: {millions(sellers)}</span>
							</div>
						</div>
					</div>
				</div>

				{/* Right: Manage Position */}
				<div className="lg:col-span-1">
					<div className="bg-white rounded-xl border border-slate-200 shadow-sm p-6">
						<h3 className="text-slate-900 font-semibold mb-6">Manage Capital</h3>

						<div className="bg-slate-50 border border-slate-100 rounded-xl p-5 mb-6">
							<div className="text-[11px] text-slate-500 mb-2 uppercase tracking-wider font-semibold">Your LP Balance</div>
							<div className="flex justify-between items-end mb-1">
								<div className="text-2xl font-semibold font-mono text-slate-900">{mine ? fmtAmount(mine.shares) : "0.00"}</div>
								<div className="text-sm font-medium text-slate-500">FXV</div>
							</div>
							<div className="text-xs text-slate-500 font-mono">${fmtAmount(myValue)} USDC Value</div>
						</div>

						<div className="space-y-5">
							<div>
								<label htmlFor="lp-amount" className="block text-[11px] font-semibold uppercase tracking-wider text-slate-500 mb-2">
									Amount (USDC)
								</label>
								<div className="relative">
									<input
										id="lp-amount"
										inputMode="decimal"
										placeholder="0.00"
										value={amount}
										onChange={(e) => setAmount(e.target.value)}
										className="w-full bg-white border border-slate-200 rounded-lg px-4 py-3 text-slate-900 font-mono focus:outline-none focus:ring-1 focus:ring-blue-600 transition-all"
									/>
									<button
										onClick={() => usdc !== undefined && setAmount(fmtAmount(usdc, 7).replace(/,/g, ""))}
										className="absolute right-2 top-1/2 -translate-y-1/2 text-xs bg-slate-100 hover:bg-slate-200 text-slate-600 px-2.5 py-1 rounded font-medium transition-colors"
									>
										MAX
									</button>
								</div>
							</div>

							<div className="grid grid-cols-2 gap-3">
								<button
									onClick={() => void act("Deposit")}
									disabled={!address || !parsed || Boolean(pending)}
									className="py-2.5 bg-slate-900 hover:bg-slate-800 disabled:opacity-50 text-white rounded-lg text-sm font-medium transition-colors"
								>
									Deposit
								</button>
								<button
									onClick={() => void act("Withdraw")}
									disabled={!address || !parsed || Boolean(pending)}
									className="py-2.5 bg-white hover:bg-slate-50 disabled:opacity-50 text-slate-700 border border-slate-200 rounded-lg text-sm font-medium transition-colors"
								>
									Withdraw
								</button>
							</div>
						</div>
					</div>
				</div>
			</div>
		</div>
	)
}

const Kpi = ({ label, value, accent = false }: { label: string; value: string; accent?: boolean }) => (
	<div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm">
		<div className="text-[11px] text-slate-500 uppercase tracking-wider font-semibold mb-2">{label}</div>
		<div className={`text-2xl font-semibold font-mono ${accent ? "text-emerald-600" : "text-slate-900"}`}>
			{value} <span className="text-sm text-slate-400 font-sans font-normal">USDC</span>
		</div>
	</div>
)
