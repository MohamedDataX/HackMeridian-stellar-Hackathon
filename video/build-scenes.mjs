// Writes one scene per step of the demo from the real app screenshots in
// assets/shots (1440x900 pages at 2x, shown 1920x1200 on the canvas).
// Camera targets are canvas pixels on that 1920x1200 image.
import { writeFileSync, mkdirSync } from "node:fs"

const SCENES = [
	{
		id: "intro", start: 0, duration: 9, step: "THE PROBLEM",
		shots: [{ img: "17-landing", at: 0, cam: [[0, 1.3, 960, 557], [1.4, 1, 960, 540]],
			caption: [0.6, "A 5 % euro move on a 1,000,000 € order: about 55,000 $ of lost margin."] }],
	},
	{
		id: "connect", start: 9, duration: 6, step: "CONNECT",
		shots: [{ img: "18-connect", at: 0, cam: [[0, 1, 960, 540]], w: 540,
			caption: [0.6, "Four personas, each a funded Stellar testnet account."] }],
	},
	{
		id: "lock", start: 15, duration: 18, step: "1 · LOCK A FORWARD",
		shots: [
			{ img: "03-manufacturer-quote", at: 0, cam: [[0, 1, 960, 540], [1.6, 1.55, 1421, 572]],
				caption: [0.5, "The manufacturer receives EUR. K = Reflector spot + rate differential."] },
			{ img: "04-manufacturer-locked", at: 8, cam: [[0, 1.3, 960, 330], [4.5, 1.6, 960, 1118]], pos: "tl",
				caption: [0.3, "One signature: 5 % margin deposited, no credit line."] },
		],
	},
	{
		id: "offset", start: 33, duration: 12, step: "2 · OPPOSITE SIDES OFFSET",
		shots: [
			{ img: "06-foundry-locked", at: 0, cam: [[0, 1, 960, 540], [1.2, 1.4, 700, 450]],
				caption: [0.4, "The foundry pays EUR: it takes the opposite side."] },
			{ img: "07-lp-balanced", at: 5, cam: [[0, 1, 960, 540], [0.8, 1.6, 695, 703]],
				caption: [0.4, "Net risk 0: the vault backs only the delta."] },
		],
	},
	{
		id: "margin", start: 45, duration: 19, step: "3 · MARGIN CALLS",
		shots: [
			{ img: "08-operator-dip", at: 0, cam: [[0, 1.2, 960, 540], [0.8, 1.9, 438, 413]],
				caption: [0.4, "The euro dips to 1.0800."] },
			{ img: "09-foundry-under-margin", at: 4, cam: [[0, 1.4, 960, 1118], [1, 1.8, 1461, 1134]], pos: "tl",
				caption: [0.3, "The foundry's hedge falls below its maintenance margin."] },
			{ img: "10-foundry-call-active", at: 9, cam: [[0, 1.8, 1461, 1134]], pos: "tl",
				caption: [0.3, "Margin call: two minutes to top up, or it is closed out."] },
			{ img: "11-foundry-topped-up", at: 14, cam: [[0, 1.8, 1461, 1134]], pos: "tl",
				caption: [0.3, "Collateral topped up: healthy again."] },
		],
	},
	{
		id: "settle", start: 64, duration: 16, step: "4 · FIXING AND SETTLEMENT",
		shots: [
			{ img: "13-operator-fixed", at: 0, cam: [[0, 1.2, 960, 540], [0.8, 1.9, 1478, 430]],
				caption: [0.4, "At maturity, one fixing from the oracle for every hedge."] },
			{ img: "14-manufacturer-settled", at: 5, cam: [[0, 1.5, 1150, 1118]], pos: "tl",
				caption: [0.3, "Settled in USDC on Stellar, at the rate locked."] },
			{ img: "16-lp-settled", at: 10.5, cam: [[0, 1, 960, 540], [0.8, 1.5, 960, 333]],
				caption: [0.4, "The fees stay in the vault: the share price goes up."] },
		],
	},
]

const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v))
const camState = ([, z, cx, cy]) => ({
	scale: z,
	x: Math.round(clamp(960 - cx * z, 1920 - 1920 * z, 0)),
	y: Math.round(clamp(540 - cy * z, 1080 - 1200 * z, 0)),
})

mkdirSync("compositions", { recursive: true })
for (const s of SCENES) {
	const html = []
	const js = []
	s.shots.forEach((shot, i) => {
		const end = i + 1 < s.shots.length ? s.shots[i + 1].at : s.duration
		const id = `${s.id}-s${i}`
		html.push(`    <div id="${id}" class="clip shot" data-hold data-layout-allow-overflow data-start="${shot.at}" data-duration="${end - shot.at}">
      <div id="${id}-cam" class="cam"><img src="assets/shots/${shot.img}.png" alt="" /></div>
      <div id="${id}-cap" class="cap${shot.pos === "tl" ? " top" : ""}"${shot.w ? ` style="max-width: ${shot.w}px"` : ""}><span>${s.step}</span>${shot.caption[1]}</div>
    </div>`)
		const [first, ...moves] = shot.cam
		const st = camState(first)
		js.push(`    tl.set("#${id}-cam", ${JSON.stringify({ ...st, transformOrigin: "0 0" })}, ${shot.at});`)
		let prev = 0
		for (const m of moves) {
			const t = shot.at + m[0]
			js.push(`    tl.to("#${id}-cam", ${JSON.stringify({ ...camState(m), duration: 0.9, ease: "power2.inOut" })}, ${t});`)
			prev = m[0]
		}
		void prev
		const capAt = shot.at + shot.caption[0]
		js.push(`    tl.fromTo("#${id}-cap", { opacity: 0, x: -30 }, { opacity: 1, x: 0, duration: 0.5, ease: "expo.out" }, ${capAt});`)
	})
	const file = `<template>
  <style>
    #root { position: absolute; inset: 0; overflow: hidden; background: #f8fafc; font-family: Inter, sans-serif; }
    .shot { position: absolute; inset: 0; overflow: hidden; }
    .cam { position: absolute; left: 0; top: 0; width: 1920px; height: 1200px; }
    .cam img { display: block; width: 1920px; height: 1200px; }
    .cap {
      position: absolute; left: 96px; bottom: 80px; max-width: 1180px;
      padding: 26px 34px; border-radius: 18px; background: #0f172a; color: #ffffff;
      font-size: 40px; font-weight: 600; line-height: 1.3; letter-spacing: -0.01em;
      box-shadow: 0 20px 60px rgba(15, 23, 42, 0.35);
    }
    .cap.top { top: 72px; bottom: auto; }
    .cap span { display: block; margin-bottom: 8px; font-size: 28px; font-weight: 700; letter-spacing: 0.08em; color: #60a5fa; }
  </style>
  <div id="root" data-composition-id="${s.id}" data-width="1920" data-height="1080">
${html.join("\n")}
  </div>
  <script>
    const tl = gsap.timeline({ paused: true });
${js.join("\n")}
    window.__timelines["${s.id}"] = tl;
  </script>
</template>
`
	writeFileSync(`compositions/${s.id}.html`, file)
}

console.log(SCENES.map((s) => `${s.id} ${s.start}-${s.start + s.duration}`).join("\n"))
