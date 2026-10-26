import { Link, NavLink, useNavigate } from "react-router-dom"
import Brand from "./Brand"

/** Header of the public pages: brand, pricing link and app launcher. */
export default function SiteHeader() {
	const navigate = useNavigate()
	return (
		<header className="border-b border-slate-100 bg-white sticky top-0 z-50">
			<div className="max-w-7xl mx-auto px-6 h-20 flex items-center justify-between">
				<div className="flex items-center gap-10">
					<Link to="/">
						<Brand />
					</Link>
					<NavLink
						to="/pricing"
						className={({ isActive }) =>
							`text-sm font-medium ${isActive ? "text-sky-600" : "text-slate-700 hover:text-slate-900"}`
						}
					>
						Pricing
					</NavLink>
				</div>
				<button
					onClick={() => void navigate("/connect")}
					className="border border-slate-900 hover:bg-slate-900 hover:text-white text-slate-900 px-6 py-2.5 rounded-lg text-sm font-semibold transition-colors"
				>
					Launch App
				</button>
			</div>
		</header>
	)
}
