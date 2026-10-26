# Zepho — 90 s demo film

GOAL:    show the real app (the enterprise-terminal design) running one full hedge cycle on testnet.
OUTPUT:  HyperFrames, 1920 x 1080, 30 fps, no sound (the presenter talks over it).
SOURCE:  assets/shots: real screenshots (1440x900 at 2x) taken by e2e/tests/fx-demo.spec.ts
         with FX_SHOTS_DIR during a testnet run on 26 Oct 2026. Nothing on screen is redrawn.
SCENES:  build-scenes.mjs writes compositions/*.html (camera targets, captions); end.html is the end card.
  intro   0-9   landing, the problem in one line
  connect 9-15  persona picker
  lock    15-33 manufacturer quote, then locked position
  offset  33-45 foundry locks the other side; LP net exposure 0
  margin  45-64 rate 1.0800, Under Margin, Call Active, Healthy
  settle  64-80 Settle buttons after fixing, settled position, LP share price
  end     80-90 logo, "Protect tomorrow's margins.", repo link
