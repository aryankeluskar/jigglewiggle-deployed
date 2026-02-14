/**
 * LLM-powered dance coach.
 * SHARED MODULE — used by both the YouTube app and the Zoom app.
 *
 * Collects PoseSummary snapshots and periodically calls /api/coach
 * to get an OpenAI-generated coaching line. Includes throttling,
 * conversation history, and graceful fallback.
 */

import type { PoseSummary } from "./scoring";
import { isSpeechPlaying } from "./speech";

type ChatMessage = { role: "user" | "assistant"; content: string };
const conversationHistory: ChatMessage[] = [];
const MAX_HISTORY = 6;

let lastRequestTs = 0;
let pendingRequest = false;
let lastMessage = "";

const MIN_INTERVAL_MS = 3000;

export type CoachResult = { message: string; audio?: string };

export async function getCoachMessage(
  summary: PoseSummary
): Promise<CoachResult | null> {
  const now = Date.now();

  if (now - lastRequestTs < MIN_INTERVAL_MS) return null;
  if (pendingRequest) return null;
  if (isSpeechPlaying()) return null;
  if (summary.score === 0 && lastMessage.includes("no pose")) return null;

  pendingRequest = true;
  lastRequestTs = now;

  try {
    const res = await fetch("/api/coach", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        summary,
        history: conversationHistory.slice(-MAX_HISTORY),
      }),
    });

    if (!res.ok) {
      pendingRequest = false;
      return null;
    }

    const data = await res.json();
    const message: string = data.message ?? "Keep going!";
    const audio: string | undefined = data.audio;

    if (message === lastMessage) {
      pendingRequest = false;
      return null;
    }

    conversationHistory.push({
      role: "user",
      content: JSON.stringify(summary),
    });
    conversationHistory.push({
      role: "assistant",
      content: message,
    });

    while (conversationHistory.length > MAX_HISTORY * 2) {
      conversationHistory.shift();
    }

    lastMessage = message;
    pendingRequest = false;
    return { message, audio };
  } catch (err) {
    console.error("Coach fetch error:", err);
    pendingRequest = false;
    return null;
  }
}

export function resetCoach(): void {
  conversationHistory.length = 0;
  lastRequestTs = 0;
  lastMessage = "";
  pendingRequest = false;
}

// ──────────────────────────────────────────────
// Stub hooks for sponsor integrations (future)
// ──────────────────────────────────────────────

/** TODO: Suno — overlay dynamically generated music */
export function sunoMusicOverlay(_videoId: string): void {}

/** TODO: HeyGen — selectable coach avatar overlay */
export function heyGenCoachAvatar(_style: string): void {}

/** TODO: Modal — host segmentation / pose model on Modal */
export function modalSegmentationModel(_frame: ImageData): void {}
