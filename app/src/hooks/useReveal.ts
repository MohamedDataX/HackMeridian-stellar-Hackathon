import { useEffect } from "react"

/** Adds `is-in` to every `.reveal` element once it scrolls into view. */
export const useReveal = () => {
	useEffect(() => {
		const io = new IntersectionObserver(
			(entries) =>
				entries.forEach((e) => {
					if (e.isIntersecting) {
						e.target.classList.add("is-in")
						io.unobserve(e.target)
					}
				}),
			{ threshold: 0.15 },
		)
		document.querySelectorAll(".reveal").forEach((el) => io.observe(el))
		return () => io.disconnect()
	}, [])
}

/** Scroll progress of an element through the viewport, 0 to 1. */
export const scrollProgress = (el: HTMLElement) => {
	const total = el.offsetHeight - window.innerHeight
	if (total <= 0) return 0
	return Math.min(1, Math.max(0, -el.getBoundingClientRect().top / total))
}
