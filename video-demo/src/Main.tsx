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
const MARGIN = { cx: 1437, cy: 930, zoom: 2 }; // the position card's margin block, page bottom

export const SHOTS = {
  open: { from: 0, dur: 104 },
  hero: { from: 104, dur: 120 },
  card1: { from: 224, dur: 55 },
  spot: { from: 279, dur: 172 },
  locked: { from: 451, dur: 120 },
  card2: { from: 571, dur: 55 },
  stack: { from: 626, dur: 150 },
  lp: { from: 776, dur: 120 },
  card3: { from: 896, dur: 55 },
  crash: { from: 951, dur: 150 },
  call: { from: 1101, dur: 90 },
  topped: { from: 1191, dur: 90 },
  card4: { from: 1281, dur: 55 },
  fixed: { from: 1336, dur: 90 },
  settled: { from: 1426, dur: 90 },
  bars: { from: 1516, dur: 120 },
  outro: { from: 1636, dur: 164 },
} as const;
export const TOTAL = SHOTS.outro.from + SHOTS.outro.dur; // 1800 = 60 s

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
  locked: { top: true, src: T('corp-locked'), pageH: 1200, caption: 'Manufacturer locks K · 5% margin, no credit line', keys: [{ frame: 0, ...FULL_T }, { frame: 34, ...FULL_T }, { frame: 64, cx: 960, cy: 980, zoom: 1.5 }, { frame: 120, cx: 960, cy: 980, zoom: 1.5 }] },
  stack: { src: T('land-stack-full'), pageH: 1080, caption: 'Built on Stellar · USDC · Reflector · OpenZeppelin · Soroban', keys: [{ frame: 0, ...FULL_L }, { frame: 20, ...FULL_L }, { frame: 70, cx: 820, cy: 520, zoom: 1.3 }, { frame: 150, cx: 820, cy: 520, zoom: 1.3 }] },
  lp: { src: T('lp-balanced'), pageH: 1200, caption: 'Foundry takes the other side · net risk 0', keys: [{ frame: 0, ...FULL_T }, { frame: 16, ...FULL_T }, { frame: 46, cx: 697, cy: 703, zoom: 1.65 }, { frame: 120, cx: 697, cy: 703, zoom: 1.65 }] },
  crash: { top: true, src: T('foundry-under-margin'), pageH: 1200, caption: 'Euro dips to 1.0800 · foundry under margin', keys: CRASH_KEYS },
  call: { top: true, src: T('foundry-call-active'), pageH: 1200, caption: 'Margin call · 2 minutes to top up', keys: [{ frame: 0, ...MARGIN }, { frame: 90, ...MARGIN }] },
  topped: { top: true, src: T('foundry-topped-up'), pageH: 1200, caption: 'Collateral topped up · healthy again', keys: [{ frame: 0, ...MARGIN }, { frame: 90, ...MARGIN }] },
  fixed: { src: T('operator-fixed'), pageH: 1200, caption: 'Fixing recorded from the oracle · settle', keys: [{ frame: 0, ...FULL_T }, { frame: 12, ...FULL_T }, { frame: 40, cx: 1483, cy: 403, zoom: 1.8 }, { frame: 90, cx: 1483, cy: 403, zoom: 1.8 }] },
  settled: { top: true, src: T('corp-settled'), pageH: 1200, caption: 'Settled in USDC at the locked rate', keys: [{ frame: 0, cx: 1150, cy: 862, zoom: 1.6 }, { frame: 90, cx: 1150, cy: 862, zoom: 1.6 }] },
  bars: { src: T('land-bars'), pageH: 1080, caption: 'Hedging costs a fraction of the risk', keys: [{ frame: 0, ...FULL_L }, { frame: 24, ...FULL_L }, { frame: 80, cx: 960, cy: 470, zoom: 1.5 }, { frame: 120, cx: 960, cy: 470, zoom: 1.5 }] },
};

// SFX pin table: every `from` is relative to a shot, so retiming a shot moves its sounds.
type Pin = { from: number; src: string; volume: number; dur?: number; note: string };
const S = SHOTS;
export const SFX: Pin[] = [
  { from: S.open.from + 12, src: 'transition-soft', volume: 0.5, note: 'wordmark lands' },
  { from: S.open.from + 96, src: 'whoosh-fast', volume: 0.45, note: 'brand lifts away to the site' },
  ...(['card1', 'card2', 'card3', 'card4'] as const).map((c) => ({ from: S[c].from, src: 'swoosh-quick', volume: 0.45, note: `title card ${c}` })),
  { from: S.spot.from + 2, src: 'transition-soft', volume: 0.4, note: 'lights on' },
  { from: S.spot.from + 56, src: 'whoosh-big', volume: 0.5, note: 'quote card rises' },
  { from: S.spot.from + 68, src: 'sparkle', volume: 0.35, dur: 50, note: 'outline beam' },
  { from: S.spot.from + 142, src: 'transition-snap', volume: 0.55, note: 'card reseats' },
  { from: S.locked.from + 34, src: 'whoosh-fast', volume: 0.35, note: 'push to the position' },
  { from: S.stack.from + 20, src: 'transition-soft', volume: 0.4, note: 'push into the stack' },
  { from: S.lp.from + 16, src: 'whoosh-fast', volume: 0.35, note: 'push to net exposure' },
  { from: S.crash.from + 37, src: 'whoosh-fast', volume: 0.45, note: 'crash zoom' },
  { from: S.crash.from + 43, src: 'impact-zoom-quick', volume: 0.7, note: 'zoom lands on the deficit' },
  { from: S.call.from, src: 'transition-snap', volume: 0.5, note: 'call starts' },
  { from: S.topped.from, src: 'transition-snap', volume: 0.5, note: 'topped up' },
  { from: S.fixed.from + 12, src: 'whoosh-fast', volume: 0.35, note: 'push to settlement' },
  { from: S.bars.from + 24, src: 'transition-soft', volume: 0.4, note: 'push to the bars' },
  { from: S.bars.from + 50, src: 'riser-cine', volume: 0.45, dur: 70, note: 'riser into the logo' },
  { from: S.outro.from + 40, src: 'impact-deep-whoosh', volume: 0.75, note: 'logo stamp, loudest hit' },
  { from: S.outro.from + 64, src: 'sparkle', volume: 0.35, dur: 70, note: 'afterglow' },
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
    <Sequence from={S.outro.from} durationInFrames={S.outro.dur}><LogoShrinkWordmarkLockup /></Sequence>

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
