// Zepho visual tokens, taken from the product (app/src/index.css + Tailwind sky/slate).
import { loadFont as loadJakarta } from '@remotion/google-fonts/PlusJakartaSans';
import { loadFont as loadTight } from '@remotion/google-fonts/InterTight';
import { loadFont as loadMono } from '@remotion/google-fonts/JetBrainsMono';

export const JAKARTA = loadJakarta('normal', { weights: ['400', '600', '800'] }).fontFamily;
export const DISPLAY = loadTight('normal', { weights: ['300', '400'] }).fontFamily;
export const MONO = loadMono('normal', { weights: ['500'] }).fontFamily;

export const Z = {
  sky: '#0ea5e9', // sky-500, the product accent
  skyLight: '#38bdf8', // sky-400
  ink: '#0f172a', // slate-900
  ink2: '#64748b', // slate-500
  paper: '#ffffff',
  black: '#000000',
};

// lucide "hourglass", the Zepho mark (24x24 viewBox)
export const HOURGLASS = [
  'M5 22h14',
  'M5 2h14',
  'M17 22v-4.172a2 2 0 0 0-.586-1.414L12 12l-4.414 4.414A2 2 0 0 0 7 17.828V22',
  'M7 2v4.172a2 2 0 0 0 .586 1.414L12 12l4.414-4.414A2 2 0 0 0 17 6.172V2',
];
