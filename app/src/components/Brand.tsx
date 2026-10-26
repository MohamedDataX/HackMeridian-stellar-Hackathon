import { Hourglass } from "lucide-react"

/** The hourglass mark and lowercase wordmark used in every header.
 * The mark spans the whole word, from the top of the "h" (0.757em) to the
 * bottom of the "p" (0.2em below the baseline) in Plus Jakarta Sans 800;
 * the icon's ink fills 22.5 of its 24 units. */
export default function Brand({ size = "text-2xl" }: { size?: string }) {
	return (
		<span className={size}>
			<span className="text-[1.25em] inline-flex items-baseline gap-[0.04em] font-extrabold tracking-tight text-sky-500 lowercase leading-none">
				<Hourglass
					className="w-[1.021em] h-[1.021em] translate-y-[0.232em]"
					strokeWidth={3}
					aria-hidden
				/>
				zepho
			</span>
		</span>
	)
}
