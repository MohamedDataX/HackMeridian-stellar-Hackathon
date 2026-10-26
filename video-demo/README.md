# Zepho demo film (Remotion)

60 s, 1920x1080, 30 fps, no voiceover. Built with the video-shotcraft skill from real captures of
https://zepho.pages.dev and of the app during a testnet run (`public/textures/`).

```bash
npm install
# audio is not in git: copy it from the video-shotcraft skill
SK=~/.claude/skills/video-shotcraft/assets/audio
mkdir -p public/sfx public/bgm
cp $SK/sfx/transition/{transition-soft,whoosh-fast,whoosh-big,swoosh-quick,transition-snap}.mp3 \
   $SK/sfx/impact/{impact-zoom-quick,impact-deep-whoosh}.mp3 $SK/sfx/riser/riser-cine.mp3 \
   $SK/sfx/light/sparkle.mp3 public/sfx/
cp $SK/bgm/bgm-tech-house.mp3 public/bgm/
npm run render                                                                  # out/zepho-demo.mp4
npx remotion render src/index.ts ZephoDemo out/zepho-demo-nobgm.mp4 --props=props-nobgm.json
```

`src/Main.tsx` holds the shot timeline (`SHOTS`) and the sound pins (`SFX`).
