/** The lowercase wordmark used in every header. */
export default function Brand({ size = "text-2xl" }: { size?: string }) {
	return (
		<span className={`${size} font-extrabold tracking-tight text-sky-500 lowercase`}>
			zepho
		</span>
	)
}
