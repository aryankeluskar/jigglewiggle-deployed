/**
 * Deterministic rule-based coaching logic.
 * Returns a coaching line based on the current score and issues.
 */

import type { ScoreFrame } from "./scoring";

const LOW_SCORE_LINES: Record<string, string[]> = {
  "Arms too low": [
    "Hands up — hit the shape!",
    "Lift those arms higher!",
    "Arms up! You got this!",
  ],
  "Arms uneven": [
    "Match both arms!",
    "Even it out — both sides!",
    "Mirror your arms!",
  ],
  "Not moving enough": [
    "Bigger moves!",
    "Let loose — move more!",
    "Don't hold back! Dance bigger!",
  ],
  "Moving too chaotically": [
    "Control it — cleaner shapes.",
    "Smooth it out!",
    "Easy — find the groove.",
  ],
  "Low pose confidence": [
    "Step into the light!",
    "Make sure I can see you!",
  ],
};

const HYPE_LINES = [
  "Clean! Keep it going.",
  "Nice! That's the vibe.",
  "You're killing it!",
  "Fire! Stay in the pocket.",
  "Smooth moves — keep flowing!",
  "Yes! That energy!",
  "On point! Don't stop.",
  "Look at you go!",
];

let lastMessage = "";
let lastMessageTs = 0;
let lastHypeTs = 0;

const MIN_INTERVAL_MS = 2000;
const NO_REPEAT_WINDOW_MS = 6000;
const HYPE_INTERVAL_MS = 8000;

/**
 * Get a coaching message based on the current score frame.
 * Returns null if nothing should be spoken (throttled).
 */
export function getCoachMessage(frame: ScoreFrame): string | null {
  const now = Date.now();

  // Throttle: at most one message every 2s
  if (now - lastMessageTs < MIN_INTERVAL_MS) return null;

  let message: string | null = null;

  if (frame.score >= 75) {
    // Hype feedback — every 8-12s
    if (now - lastHypeTs >= HYPE_INTERVAL_MS) {
      message = pick(HYPE_LINES);
      lastHypeTs = now;
    }
  } else if (frame.issues.length > 0) {
    // Actionable feedback for the first issue
    for (const issue of frame.issues) {
      const lines = LOW_SCORE_LINES[issue];
      if (lines) {
        message = pick(lines);
        break;
      }
    }
  }

  if (!message) return null;

  // Don't repeat within 6s
  if (message === lastMessage && now - lastMessageTs < NO_REPEAT_WINDOW_MS) {
    return null;
  }

  lastMessage = message;
  lastMessageTs = now;
  return message;
}

function pick(arr: string[]): string {
  return arr[Math.floor(Math.random() * arr.length)];
}

// ──────────────────────────────────────────────
// Stub hooks for sponsor integrations (future)
// ──────────────────────────────────────────────

/** TODO: Suno — overlay dynamically generated music */
export function sunoMusicOverlay(_videoId: string): void {
  // Stub: integrate Suno API for dynamic music generation
}

/** TODO: HeyGen — selectable coach avatar overlay */
export function heyGenCoachAvatar(_style: string): void {
  // Stub: integrate HeyGen for animated coach avatar
}

/** TODO: Modal — host segmentation / pose model on Modal */
export function modalSegmentationModel(_frame: ImageData): void {
  // Stub: call Modal-hosted model for advanced segmentation
}

/** TODO: OpenAI — multi-turn adaptive coach */
export function openAIAdaptiveCoach(_history: string[]): Promise<string> {
  // Stub: call OpenAI for multi-turn conversational coaching
  return Promise.resolve("Keep it up!");
}
