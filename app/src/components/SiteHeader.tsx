import { ArrowRight } from "lucide-react"
import { useEffect, useState } from "react"
import { useNavigate } from "react-router-dom"
import Brand from "./Brand"

const LINKS = [
	["#stack", "Stack"],
	["#pricing", "Pricing"],
	["#about", "About"],
] as const

/** Floating pill navigation and the page scroll progress line. */
export default function SiteHeader() {
	const navigate = useNavigate()
	const [progress, setProgress] = useState(0)

	useEffect(() => {
		const on = () => {
			const max = document.documentElement.scrollHeight - window.innerHeight
			setProgress(max > 0 ? window.scrollY / max : 0)
		}
		on()
		window.addEventListener("scroll", on, { passive: true })
		return () => window.removeEventListener("scroll", on)
	}, [])

	return (
		<>
			<div className="fixed top-0 inset-x-0 h-[3px] z-[60] bg-slate-200/40">
				<div
					className="h-full bg-sky-500 transition-[width] duration-150"
					style={{ width: `${progress * 100}%` }}
				/>
			</div>
			<header className="fixed top-4 inset-x-0 z-50 flex justify-center px-4">
				<nav className="flex items-center gap-6 rounded-full bg-white/75 backdrop-blur-md border border-white/60 shadow-lg shadow-black/10 pl-5 pr-1.5 py-1.5">
					<a href="#top" aria-label="Zepho home">
						<Brand size="text-lg" />
					</a>
					<div className="hidden sm:flex items-center gap-5">
						{LINKS.map(([href, label]) => (
							<a
								key={href}
								href={href}
								className="text-xs font-medium text-slate-700 hover:text-slate-900"
							>
								{label}
							</a>
						))}
					</div>
					<button
						onClick={() => void navigate("/connect")}
						className="flex items-center gap-2 bg-sky-500 hover:bg-sky-600 text-white pl-4 pr-1 py-1 rounded-full text-xs font-semibold transition-colors"
					>
						Launch App
						<span className="w-6 h-6 rounded-full bg-white text-sky-500 flex items-center justify-center">
							<ArrowRight className="w-3.5 h-3.5" />
						</span>
					</button>
				</nav>
			</header>
		</>
	)
}
