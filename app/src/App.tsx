import { labPrefix } from "@stellar-scaffold/app-lib"
import { NavLink, Outlet, Route, Routes } from "react-router-dom"
import styles from "./App.module.css"
import ConnectAccount from "./components/ConnectAccount"
import Debug from "./pages/Debug"
import Demo from "./pages/Demo"
import Hedge from "./pages/Hedge"
import Hedges from "./pages/Hedges"
import Vault from "./pages/Vault"

function App() {
	return (
		<Routes>
			<Route element={<AppLayout />}>
				<Route path="/" element={<Hedge />} />
				<Route path="/hedges" element={<Hedges />} />
				<Route path="/vault" element={<Vault />} />
				<Route path="/demo" element={<Demo />} />
				<Route path="/debug" element={<Debug />} />
				<Route path="/debug/:contractName" element={<Debug />} />
			</Route>
		</Routes>
	)
}

const NAV = [
	["/", "Hedge"],
	["/hedges", "Hedges"],
	["/vault", "Vault"],
	["/demo", "Demo"],
	["/debug", "Contracts"],
] as const

const AppLayout = () => (
	<div className={styles.AppLayout}>
		<header className={styles.header}>
			<span className={styles.logo}>FX Hedge Vault</span>
			<nav className={styles.headerNav}>
				{NAV.map(([to, label]) => (
					<NavLink
						key={to}
						to={to}
						end
						className={({ isActive }) => (isActive ? styles.active : "")}
					>
						{label}
					</NavLink>
				))}
				<a href={labPrefix()} target="_blank" rel="noreferrer">
					Explorer
				</a>
			</nav>
			<ConnectAccount />
		</header>

		<main className={styles.main}>
			<Outlet />
		</main>

		<footer className={styles.footer}>
			<nav className={styles.footerNav}>
				<span>
					Testnet prototype · EUR/USD by Reflector · built with Scaffold
					Stellar and OpenZeppelin
				</span>
			</nav>
		</footer>
	</div>
)

export default App
