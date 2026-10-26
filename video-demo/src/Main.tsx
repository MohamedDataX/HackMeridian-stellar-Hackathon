// Zepho demo film, 60 s @30fps, no voice.
// SHOTS is the single source of truth: every Sequence, caption and SFX pin derives from it.
import React from 'react';
import { AbsoluteFill, Audio, Easing, Sequence, interpolate, staticFile, useCurrentFrame } from 'remotion';
import { PageCam, type CamKey } from './PageCam';
import { BrandInkOpen } from './shots/BrandInkOpen';
import { PaperTitleCard, type Word } from './shots/PaperTitleCard';
import { SpotlightHeroCard } from './shots/SpotlightHeroCard';
import { LogoShrinkWordmarkLockup } from './shots/LogoShrinkWordmarkLockup';
import { JAKARTA, Z } from './tokens';

type Cam = { src: string; pageH: number; keys: CamKey[]; caption: string; top?: boolean };

// Terminal captures: 1440x900 CSS at 2x, shown on a 1920-wide page → pageH 1200.
// Landing captures: 1920x1080 CSS at 2x → pageH 1080.
const T = (name: string) => `textures/${name}.png`;
const FULL_T = { cx: 960, cy: 600, zoom: 1 };
const FULL_L = { cx: 960, cy: 540, zoom: 1 };
const MARGIN = { cx: 1437, cy: 930, zoom: 2 };
const MARGIN_END = { ...MARGIN, zoom: 2.04 }; // slow 2% push while the state reads
const ROW = { cx: 960, cy: 768, zoom: 1.25 }; // the position row, full width, page bottom // the position card's margin block, page bottom

export const SHOTS = {
  open: { from: 0, dur: 104 },
  hero: { from: 104, dur: 120 },
  card1: { from: 224, dur: 55 },
  spot: { from: 279, dur: 172 },
  locked: { from: 451, dur: 120 },
  card2: { from: 571, dur: 55 },
  lp: { from: 626, dur: 120 },
  stack: { from: 746, dur: 90 },
  card3: { from: 836, dur: 55 },
  crash: { from: 891, dur: 150 },
  call: { from: 1041, dur: 90 },
  topped: { from: 1131, dur: 90 },
  card4: { from: 1221, dur: 55 },
  fixed: { from: 1276, dur: 105 },
  settled: { from: 1381, dur: 105 },
  bars: { from: 1486, dur: 150 },
  outro: { from: 1636, dur: 164 },
} as const;
export const TOTAL = SHOTS.outro.from + SHOTS.outro.dur; // 1800 = 60 s
const OUTRO_SKIP = 40;

const CARDS: Record<'card1' | 'card2' | 'card3' | 'card4', { words: Word[]; sub: string }> = {
  card1: { words: [{ text: 'One' }, { text: 'forward' }, { text: 'rate,', br: true }, { text: 'priced' }, { text: 'live.', accent: true }], sub: 'Reflector EUR/USD + rate differential' },
  card2: { words: [{ text: 'Opposite' }, { text: 'risks', br: true }, { text: 'cancel', accent: true }, { text: 'out.' }], sub: 'The vault backs only the net' },
  card3: { words: [{ text: 'Margin' }, { text: 'calls,', br: true }, { text: 'on-chain.', accent: true }], sub: '5% initial · 3% maintenance' },
  card4: { words: [{ text: 'One' }, { text: 'fixing.', br: true }, { text: 'Settled' }, { text: 'in' }, { text: 'seconds.', accent: true }], sub: 'USDC on Stellar' },
};

// Crash zoom (crash-zoom-punch, bounce variant): 30f wide hold with ~2% creep,
// 7f pre-pull, 6f ease-in punch, 5f overshoot recovery, then hold to read.
const CRASH_KEYS: CamKey[] = [
  { frame: 0, ...FULL_T },
  { frame: 30, cx: 960, cy: 600, zoom: 1.02 },
  { frame: 37, cx: 960, cy: 600, zoom: 0.985 },
  { frame: 43, ...MARGIN, zoom: 2.08 },
  { frame: 48, ...MARGIN },
  { frame: 150, ...MARGIN },
];

const CAMS: Partial<Record<keyof typeof SHOTS, Cam>> = {
  hero: { top: true, src: T('land-hero'), pageH: 1080, caption: 'zepho.pages.dev', keys: [{ frame: 0, cx: 960, cy: 470, zoom: 1.3 }, { frame: 50, ...FULL_L }, { frame: 120, ...FULL_L }] },
  locked: { top: true, src: T('corp-locked'), pageH: 1200, caption: 'Manufacturer locks K · 5% margin, no credit line', keys: [{ frame: 0, ...FULL_T }, { frame: 34, ...FULL_T }, { frame: 64, ...ROW }, { frame: 120, ...ROW, zoom: 1.27 }] },
  stack: { src: T('land-stack-full'), pageH: 1080, caption: 'Built on Stellar · USDC · Reflector · OpenZeppelin · Soroban', keys: [{ frame: 0, ...FULL_L }, { frame: 10, ...FULL_L }, { frame: 55, cx: 820, cy: 520, zoom: 1.3 }, { frame: 90, cx: 820, cy: 520, zoom: 1.33 }] },
  lp: { src: T('lp-balanced'), pageH: 1200, caption: 'Foundry takes the other side · net risk 0', keys: [{ frame: 0, ...FULL_T }, { frame: 16, ...FULL_T }, { frame: 46, cx: 697, cy: 703, zoom: 1.65 }, { frame: 120, cx: 697, cy: 703, zoom: 1.65 }] },
  crash: { top: true, src: T('foundry-under-margin'), pageH: 1200, caption: 'Euro dips to 1.0800 · foundry under margin', keys: CRASH_KEYS },
  call: { top: true, src: T('foundry-call-active'), pageH: 1200, caption: 'Margin call · 2 minutes to top up', keys: [{ frame: 0, ...MARGIN }, { frame: 90, ...MARGIN_END }] },
  topped: { top: true, src: T('foundry-topped-up'), pageH: 1200, caption: 'Collateral topped up · healthy again', keys: [{ frame: 0, ...MARGIN }, { frame: 90, ...MARGIN_END }] },
  fixed: { src: T('operator-fixed'), pageH: 1200, caption: 'Oracle fixing 1.0793 recorded · settle both hedges', keys: [{ frame: 0, ...FULL_T }, { frame: 12, ...FULL_T }, { frame: 42, cx: 960, cy: 450, zoom: 1.2 }, { frame: 105, cx: 960, cy: 450, zoom: 1.23 }] },
  settled: { top: true, src: T('corp-settled'), pageH: 1200, caption: 'Settled in USDC at the fixing · 1.0793', keys: [{ frame: 0, ...ROW }, { frame: 105, ...ROW, zoom: 1.27 }] },
  bars: { src: T('land-bars'), pageH: 1080, caption: 'Fees from the contract vs. a 5% euro move', keys: [{ frame: 0, ...FULL_L }, { frame: 24, ...FULL_L }, { frame: 80, cx: 960, cy: 470, zoom: 1.5 }, { frame: 150, cx: 960, cy: 470, zoom: 1.53 }] },
};

// SFX pin table. `at` is the visual frame; each sample's measured peak (frames from its start)
// is subtracted so the peak lands one frame after the picture (sound-design S5).
const PEAK: Record<string, number> = {
  'transition-soft': 13, 'whoosh-fast': 21, 'whoosh-big': 21, 'swoosh-quick': 8, 'transition-snap': 3,
  'impact-zoom-quick': 12, 'impact-deep-whoosh': 16, 'riser-cine': 20, sparkle: 44,
};
type Pin = { from: number; src: string; volume: number; dur?: number; note: string };
const pin = (at: number, src: string, volume: number, note: string, dur?: number): Pin => ({ from: Math.max(0, at + 1 - PEAK[src]), src, volume, note, dur });
const S = SHOTS;
export const SFX: Pin[] = [
  pin(S.open.from + 40, 'transition-soft', 0.6, 'wordmark letters land'),
  pin(S.open.from + 100, 'whoosh-fast', 0.8, 'brand lifts away to the site'),
  ...(['card1', 'card2', 'card3', 'card4'] as const).map((c) => pin(S[c].from + 8, 'swoosh-quick', 0.6, `title card ${c} words press in`)),
  pin(S.spot.from + 3, 'transition-soft', 0.5, 'lights on'),
  pin(S.spot.from + 60, 'whoosh-big', 0.7, 'quote card rises'),
  pin(S.spot.from + 75, 'sparkle', 0.4, 'outline beam lap 1', 60),
  pin(S.spot.from + 142, 'transition-snap', 0.6, 'card reseats'),
  pin(S.locked.from + 50, 'whoosh-fast', 0.8, 'push to the position'),
  pin(S.lp.from + 32, 'whoosh-fast', 0.8, 'push to net exposure'),
  pin(S.stack.from + 32, 'transition-soft', 0.5, 'push into the stack'),
  pin(S.crash.from + 40, 'whoosh-fast', 0.8, 'crash zoom'),
  pin(S.crash.from + 43, 'impact-zoom-quick', 0.8, 'zoom lands on the deficit'),
  pin(S.call.from, 'transition-snap', 0.6, 'call starts'),
  pin(S.topped.from, 'transition-snap', 0.6, 'topped up'),
  pin(S.fixed.from + 27, 'whoosh-fast', 0.8, 'push to settlement'),
  pin(S.bars.from + 52, 'transition-soft', 0.5, 'push to the bars'),
  pin(S.bars.from + 110, 'riser-cine', 0.5, 'riser into the logo', 70),
  pin(S.outro.from + 17, 'impact-deep-whoosh', 0.85, 'hourglass lands (t≈0.28), loudest hit'),
  pin(S.outro.from + 110, 'sparkle', 0.4, 'wordmark afterglow', 70),
];

const Caption: React.FC<{ text: string; top?: boolean }> = ({ text, top }) => {
  const f = useCurrentFrame();
  const t = interpolate(f, [6, 20], [0, 1], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp', easing: Easing.bezier(0, 0, 0.2, 1) });
  return (
    <div style={{
      position: 'absolute', left: 72, ...(top ? { top: 64 } : { bottom: 64 }), display: 'flex', alignItems: 'center', gap: 14,
      padding: '16px 26px', borderRadius: 999, background: 'rgba(255,255,255,0.92)', backdropFilter: 'blur(8px)',
      boxShadow: '0 10px 40px rgba(15,23,42,0.18)', border: '1px solid rgba(226,232,240,0.9)',
      fontFamily: JAKARTA, fontSize: 30, fontWeight: 600, color: Z.ink,
      opacity: t, transform: `translateY(${(1 - t) * 18}px)`, filter: `blur(${(1 - t) * 6}px)`,
    }}>
      <span style={{ width: 12, height: 12, borderRadius: 6, background: Z.sky }} />
      {text}
    </div>
  );
};

// Six frames to black and back across the white → black cut.
const Dip: React.FC = () => {
  const f = useCurrentFrame();
  return <AbsoluteFill style={{ background: '#000', opacity: interpolate(f, [0, 6, 12], [0, 1, 0], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' }) }} />;
};

export const Main: React.FC<{ bgm: boolean }> = ({ bgm }) => (
  <AbsoluteFill style={{ backgroundColor: Z.paper }}>
    <Sequence from={S.open.from} durationInFrames={S.open.dur}><BrandInkOpen /></Sequence>
    {(Object.keys(CAMS) as (keyof typeof SHOTS)[]).map((k) => {
      const c = CAMS[k]!;
      return (
        <Sequence key={k} from={S[k].from} durationInFrames={S[k].dur}>
          <PageCam src={c.src} pageH={c.pageH} keys={c.keys} ease={Easing.bezier(0.65, 0, 0.35, 1)} />
          <Caption text={c.caption} top={c.top} />
        </Sequence>
      );
    })}
    {(['card1', 'card2', 'card3', 'card4'] as const).map((k) => (
      <Sequence key={k} from={S[k].from} durationInFrames={S[k].dur}><PaperTitleCard {...CARDS[k]} /></Sequence>
    ))}
    <Sequence from={S.spot.from} durationInFrames={S.spot.dur}><SpotlightHeroCard /></Sequence>
    {/* skip the lockup's first 40f (the wide pale ring read as a spinner): t starts near 0.2 */}
    <Sequence from={S.outro.from} durationInFrames={S.outro.dur}>
      <Sequence from={-OUTRO_SKIP} durationInFrames={S.outro.dur + OUTRO_SKIP}><LogoShrinkWordmarkLockup /></Sequence>
    </Sequence>

    <Sequence from={S.hero.from - 6} durationInFrames={12}><Dip /></Sequence>

    {SFX.map((p, i) => (
      <Sequence key={i} from={p.from} durationInFrames={p.dur}>
        <Audio src={staticFile(`sfx/${p.src}.mp3`)} volume={p.volume} />
      </Sequence>
    ))}
    {bgm ? (
      <Audio
        src={staticFile('bgm/bgm-tech-house.mp3')}
        loop
        volume={(f) => 0.32 * interpolate(f, [0, 20, TOTAL - 45, TOTAL - 1], [0, 1, 1, 0], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' })}
      />
    ) : null}
  </AbsoluteFill>
);
