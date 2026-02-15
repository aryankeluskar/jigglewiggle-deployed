# Jiggle Wiggle 💃

**Learn dance moves from YouTube with real-time AI pose coaching.**

<img width="1568" height="890" alt="image" src="https://github.com/user-attachments/assets/ee59ebe5-8bf5-477a-b759-f3ea83ae9024" />


Built at TreeHacks 2026.

## What it does

1. Paste any YouTube dance video URL
2. Your webcam shows a live skeleton overlay tracking your body
3. An AI coach scores your movement and gives real-time audio feedback
4. A Chrome extension lets you open any YouTube video in the app with one click

## Quick Start

### Run the Web App

```bash
pnpm install
pnpm dev
```

Open [http://localhost:3000](http://localhost:3000).

### Load the Chrome Extension

1. Open `chrome://extensions/`
2. Enable **Developer mode** (top right)
3. Click **Load unpacked**
4. Select the `extension/` folder from this project
5. Navigate to any YouTube video and click the **Jiggle Wiggle** toolbar button

## 60-Second Demo Script

1. Open the app at `localhost:3000`
2. Paste a YouTube dance video URL (e.g. a short choreography clip)
3. Allow camera access when prompted
4. Start dancing — watch the skeleton overlay track your pose
5. Listen to the audio coach give real-time feedback
6. Show the score updating live at the bottom
7. (Optional) Click the Chrome extension button on a YouTube page to auto-open

## Tech Stack

- **Frontend:** Next.js (App Router) + TypeScript
- **UI:** Tailwind CSS
- **Pose Tracking:** MediaPipe Pose (in-browser, no backend)
- **Audio Coach:** Web Speech API (`speechSynthesis`)
- **Chrome Extension:** Manifest v3

## Project Structure

```
/app
  page.tsx                  # Main split-screen page
  layout.tsx                # Root layout
  globals.css               # Global styles
  /components
    UrlInput.tsx             # YouTube URL input
    YoutubePanel.tsx         # Embedded YouTube player
    CameraPanel.tsx          # Webcam + skeleton overlay
    CoachPanel.tsx           # Score display + coaching subtitles
  /lib
    youtube.ts               # URL parsing utilities
    pose.ts                  # MediaPipe Pose setup & skeleton drawing
    scoring.ts               # Movement scoring heuristics
    coach.ts                 # Rule-based coaching logic
    speech.ts                # Web Speech API wrapper
/extension
    manifest.json            # Chrome extension manifest (v3)
    background.ts            # Service worker source
    background.js            # Compiled service worker
    icon.png                 # Toolbar icon
```

## Sponsor Mapping

| Sponsor   | Integration Angle |
|-----------|-------------------|
| **Modal** | Host segmentation / advanced pose model on Modal for server-side processing |
| **OpenAI** | Multi-turn adaptive coaching — conversational AI that learns your style |
| **Suno** | Dynamic music overlay — generate practice tracks that match the video BPM |
| **Greylock** | Agent that adapts coaching strategy based on cumulative feedback |
| **Decagon** | Conversational assistant coach with natural dialogue |
| **HeyGen** | Selectable animated coach avatar styles overlaid on screen |
| **Neo** | Business/product angle — dance education platform for creators |

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
