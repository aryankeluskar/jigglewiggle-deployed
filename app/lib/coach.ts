/**
 * LLM-powered dance coach.
 *
 * Collects PoseSummary snapshots and periodically calls /api/coach
 * to get an OpenAI-generated coaching line. Includes throttling,
 * conversation history, and graceful fallback.
 */

import type { PoseSummary } from "./scoring";

// --- Conversation history for multi-turn context ---
type ChatMessage = { role: "user" | "assistant"; content: string };
const conversationHistory: ChatMessage[] = [];
const MAX_HISTORY = 6;

// --- Throttle state ---
let lastRequestTs = 0;
let pendingRequest = false;
let lastMessage = "";

/** Minimum ms between LLM requests (don't spam the API) */
const MIN_INTERVAL_MS = 3000;

/**
 * Request a coaching message from the LLM.
 *
 * Call this on every score frame — it handles throttling internally.
 * Returns the coaching string if a new one is available, or null
 * if throttled / still waiting.
 */
export async function getCoachMessage(
  summary: PoseSummary
): Promise<string | null> {
  const now = Date.now();

  // Throttle: don't fire more often than MIN_INTERVAL_MS
  if (now - lastRequestTs < MIN_INTERVAL_MS) return null;

  // Don't stack requests
  if (pendingRequest) return null;

  // Skip if no pose detected and we already said so
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

    // Don't repeat exact same message
    if (message === lastMessage) {
      pendingRequest = false;
      return null;
    }

    // Update conversation history
    conversationHistory.push({
      role: "user",
      content: JSON.stringify(summary),
    });
    conversationHistory.push({
      role: "assistant",
      content: message,
    });

    // Trim history
    while (conversationHistory.length > MAX_HISTORY * 2) {
      conversationHistory.shift();
    }

    lastMessage = message;
    pendingRequest = false;
    return message;
  } catch (err) {
    console.error("Coach fetch error:", err);
    pendingRequest = false;
    return null;
  }
}

/**
 * Reset coach state (call when session restarts).
 */
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
