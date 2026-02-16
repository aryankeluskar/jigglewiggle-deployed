# Jiggle Wiggle 💃
devpost: https://devpost.com/software/jiggle-wiggle

**Learn dance moves from YouTube with real-time AI pose coaching.**

<img width="1568" height="890" alt="image" src="https://github.com/user-attachments/assets/ee59ebe5-8bf5-477a-b759-f3ea83ae9024" />


Built at TreeHacks 2026.

## What it does

1. Paste any YouTube dance video URL
2. Your webcam shows a live skeleton overlay tracking your body
3. An AI coach scores your movement and gives real-time audio feedback

## Quick Start

### Run the Web App

```bash
pnpm install
pnpm dev
```

Open [http://localhost:3000](http://localhost:3000).


## Quick start

1. Open the app at `localhost:3000`
2. Paste a YouTube dance video URL (e.g. a short choreography clip)
3. Allow camera access when prompted
4. Start dancing — watch the skeleton overlay track your pose
5. Listen to the audio coach give real-time feedback
6. Show the score updating live at the bottom

## Tech Stack

- **Frontend:** Next.js (App Router) + TypeScript
- **UI:** Tailwind CSS
- **Pose Tracking:** MediaPipe Pose (in-browser, no backend)
- **Audio Coach:** Web Speech API (`speechSynthesis`)
- **Chrome Extension:** Manifest v3


## How Scoring Works

The scoring module evaluates four signals at ~15-30fps:

- **Pose confidence** — MediaPipe detection confidence
- **Arm height** — Wrist position relative to shoulders
- **Symmetry** — Left vs right arm alignment
- **Motion energy** — Average keypoint displacement over time

Score is 0–100 and updates ~5x per second.

## Coach Rules

- If arms low → "Hands up — hit the shape!"
- If arms uneven → "Match both arms!"
- If not moving enough → "Bigger moves!"
- If too chaotic → "Control it — cleaner shapes."
- If score is high → Hype feedback every 8-12 seconds
- Messages throttled: max once per 2 seconds, no repeats within 6 seconds

## License

MIT
