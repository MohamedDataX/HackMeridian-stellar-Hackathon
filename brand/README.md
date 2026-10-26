# Zepho — brand

Minimalist terminal mark for HackMeridian 2026. **Zepho** = invented name (no
existing meaning); the product locks an EUR/USD forward rate to maturity and
settles in USDC on Stellar. Check trademark/domain availability before public
use.

## Concept

An **hourglass** — time to the forward's maturity. Its two halves are the
**offsetting hedges** (long vs short) that net out; the shape also reads as the
**X of FX**. The pinch is a flat **emerald** line: the locked forward rate, set
at the fixing. One accent colour, geometric, no pictogram — trading-desk
language. Mono wordmark matches the enterprise-terminal UI.

## Files

| File | Use |
|---|---|
| `logo-mark.svg` | Icon only (self-contained slate tile). App icon, avatar, favicon. |
| `logo-full.svg` | Mark + wordmark, for **light** backgrounds (slate text). |
| `logo-full-dark.svg` | Mark + wordmark, for **dark / terminal** backgrounds (white text). |

Deployed copies: `app/public/logo.svg`, `app/public/favicon.svg`.

## Palette

| Token | Hex | Role |
|---|---|---|
| Slate 900 | `#0F172A` | Tile / wordmark on light |
| Emerald 500 | `#10B981` | Accent: locked rate, shackle, cursor |
| Slate 400/500 | `#94A3B8` / `#64748B` | Volatility line |
| Slate 200 | `#E2E8F0` | Lock body outline |
| Slate 50 | `#F8FAFC` | Wordmark on dark |

Type: **JetBrains Mono** (700), matches `--font-mono` in `app/src/index.css`.

## Favicon note

`app/public/favicon.svg` is vector. To emit a multi-size `.ico`:

```bash
# needs imagemagick + rsvg
rsvg-convert -w 256 -h 256 brand/logo-mark.svg -o /tmp/l.png
magick /tmp/l.png -define icon:auto-resize=16,32,48,256 app/public/favicon.ico
```
