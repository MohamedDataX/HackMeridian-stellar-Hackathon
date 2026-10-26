import { Building2, Cpu, Factory, Settings, type LucideIcon } from "lucide-react"
import { ACCOUNTS } from "./fx"

export type ProfileType = "corporate" | "lp" | "admin"

export interface Profile {
	id: string
	name: string
	role: string
	type: ProfileType
	icon: LucideIcon
	address?: string
}

const addressOf = (label: string) =>
	Object.keys(ACCOUNTS).find((a) => ACCOUNTS[a] === label)

/** The four personas, each bound to a funded testnet account. */
export const PROFILES: Record<string, Profile> = {
	manufacturer: {
		id: "manufacturer",
		name: "Manufacturer",
		role: "Manufacturer (Receive EUR)",
		type: "corporate",
		icon: Factory,
		address: addressOf("Manufacturer"),
	},
	foundry: {
		id: "foundry",
		name: "Foundry",
		role: "Foundry (Pay EUR)",
		type: "corporate",
		icon: Cpu,
		address: addressOf("Foundry"),
	},
	lp: {
		id: "lp",
		name: "Liquidity Provider",
		role: "Liquidity Provider",
		type: "lp",
		icon: Building2,
		address: addressOf("Liquidity provider"),
	},
	operator: {
		id: "operator",
		name: "Operator",
		role: "Protocol Admin",
		type: "admin",
		icon: Settings,
		address: addressOf("Operator"),
	},
}
