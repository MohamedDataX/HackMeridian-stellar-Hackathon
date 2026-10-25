import {
	demoOracle,
	fxVault,
	lpVault,
	reflectorFx,
	tusdc,
} from "@stellar-scaffold/app-lib/clients"
import { useQuery, useQueryClient } from "@tanstack/react-query"
import { useCallback, useEffect, useState } from "react"
import { EUR, explain, nowSecs, read } from "../lib/fx"
import { useNotification } from "./useNotification"
import { useWallet } from "./useWallet"

const POLL = { refetchInterval: 4_000 }

/** Current time in seconds, ticking every second. */
export const useNow = () => {
	const [now, setNow] = useState(nowSecs)
	useEffect(() => {
		const id = setInterval(() => setNow(nowSecs()), 1_000)
		return () => clearInterval(id)
	}, [])
	return now
}

export const useParams = () =>
	useQuery({
		queryKey: ["params"],
		queryFn: () => read(fxVault.params()),
		staleTime: 60_000,
	})

export const useMaturities = () =>
	useQuery({
		queryKey: ["maturities"],
		queryFn: async () => {
			const list = await read(fxVault.maturities())
			const all = await Promise.all(
				list.map((timestamp) => read(fxVault.maturity({ timestamp }))),
			)
			return all.sort((a, b) => Number(a.timestamp - b.timestamp))
		},
		...POLL,
	})

export const useHedges = () =>
	useQuery({
		queryKey: ["hedges"],
		queryFn: async () => {
			const count = await read(fxVault.hedge_count())
			const ids = Array.from({ length: count }, (_, i) => i)
			const hedges = await Promise.all(
				ids.map((id) => read(fxVault.get_hedge({ id }))),
			)
			return hedges.reverse()
		},
		...POLL,
	})

/** Margin position of an open hedge, or the error that prevents it. */
export const useMarginStatus = (id: number, enabled: boolean) =>
	useQuery({
		queryKey: ["margin", id],
		queryFn: () => read(fxVault.margin_status({ id })),
		enabled,
		...POLL,
	})

export const useVault = () =>
	useQuery({
		queryKey: ["vault"],
		queryFn: async () => {
			const [total, engaged, free, sharePrice, supply] = await Promise.all([
				read(lpVault.total_assets()),
				read(lpVault.engaged()),
				read(lpVault.free_liquidity()),
				read(lpVault.share_price()),
				read(lpVault.total_supply()),
			])
			return { total, engaged, free, sharePrice, supply }
		},
		...POLL,
	})

export const useShares = (address?: string) =>
	useQuery({
		queryKey: ["shares", address],
		queryFn: async () => {
			const account = address as string
			const [shares, maxWithdraw] = await Promise.all([
				read(lpVault.balance({ account })),
				read(lpVault.max_withdraw({ owner: account })),
			])
			return { shares, maxWithdraw }
		},
		enabled: Boolean(address),
		...POLL,
	})

export const useUsdcBalance = (address?: string) =>
	useQuery({
		queryKey: ["usdc", address],
		queryFn: () => read(tusdc.balance({ id: address as string })),
		enabled: Boolean(address),
		...POLL,
	})

export const useOracle = () =>
	useQuery({
		queryKey: ["oracle"],
		queryFn: async () => {
			const [demo, manual, reflector] = await Promise.all([
				read(demoOracle.lastprice({ asset: EUR })),
				read(demoOracle.manual_price()),
				read(reflectorFx.lastprice({ asset: EUR })),
			])
			return { demo, manual, reflector }
		},
		...POLL,
	})

/**
 * Run a wallet action: notify on success or failure, then refresh every
 * query and the wallet balance.
 */
export const useAction = () => {
	const { addNotification } = useNotification()
	const { updateBalances } = useWallet()
	const client = useQueryClient()
	const [pending, setPending] = useState<string>()

	const run = useCallback(
		async (label: string, action: () => Promise<unknown>) => {
			setPending(label)
			try {
				await action()
				addNotification(`${label}: done`, "success")
				return true
			} catch (e) {
				console.error(e)
				addNotification(`${label}: ${explain(e)}`, "error")
				return false
			} finally {
				setPending(undefined)
				await client.invalidateQueries()
				await updateBalances()
			}
		},
		[addNotification, client, updateBalances],
	)

	return { run, pending }
}
