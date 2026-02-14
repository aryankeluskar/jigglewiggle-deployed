import type { NormalizedLandmark } from "./pose";

export type GestureAction = "play_pause" | "skip_forward" | "skip_backward" | "restart";

export type GestureResult = {
  /** Action that just fired, or null if nothing triggered this frame */
  lastAction: GestureAction | null;
  /** Current dwell gesture being held (for progress bar), or null */
  pending: GestureAction | null;
  /** 0-1 progress toward dwell threshold */
  progress: number;
};

// --- Landmark indices (MediaPipe Pose) ---
const LEFT_SHOULDER = 11;
const RIGHT_SHOULDER = 12;
const LEFT_WRIST = 15;
const RIGHT_WRIST = 16;

// --- Thresholds ---
const STILLNESS_THRESHOLD = 0.03; // normalized coord delta per frame
const PLAY_PAUSE_DWELL_MS = 1500;
const RESTART_DWELL_MS = 2000;
const COOLDOWN_MS = 2000;
const SWIPE_MIN_DELTA = 0.15; // normalized horizontal distance
const SWIPE_MAX_MS = 400; // max time for swipe motion

// --- Module-level state (not React state — avoids re-renders) ---
let prevRightWrist: { x: number; y: number } | null = null;
let prevLeftWrist: { x: number; y: number } | null = null;

// Dwell timers
let rightHandDwellStart: number | null = null;
let bothHandsDwellStart: number | null = null;

// Swipe tracking
let swipeStartX: number | null = null;
let swipeStartTime: number | null = null;

// Cooldown
let lastTriggerTime = 0;

function dist(a: { x: number; y: number }, b: { x: number; y: number }): number {
  return Math.sqrt((a.x - b.x) ** 2 + (a.y - b.y) ** 2);
}

export function processGestureLandmarks(landmarks: NormalizedLandmark[] | null): GestureResult {
  const none: GestureResult = { lastAction: null, pending: null, progress: 0 };
  if (!landmarks || landmarks.length < 33) return none;

  const now = Date.now();

  // Cooldown check
  if (now - lastTriggerTime < COOLDOWN_MS) {
    // Reset all dwell state during cooldown
    rightHandDwellStart = null;
    bothHandsDwellStart = null;
    swipeStartX = null;
    swipeStartTime = null;
    prevRightWrist = { x: landmarks[RIGHT_WRIST].x, y: landmarks[RIGHT_WRIST].y };
    prevLeftWrist = { x: landmarks[LEFT_WRIST].x, y: landmarks[LEFT_WRIST].y };
    return none;
  }

  const lShoulder = landmarks[LEFT_SHOULDER];
  const rShoulder = landmarks[RIGHT_SHOULDER];
  const lWrist = landmarks[LEFT_WRIST];
  const rWrist = landmarks[RIGHT_WRIST];

  const rightAboveHead = rWrist.y < Math.min(lShoulder.y, rShoulder.y) - 0.1;
  const leftAboveHead = lWrist.y < Math.min(lShoulder.y, rShoulder.y) - 0.1;
  const leftAboveShoulder = lWrist.y < lShoulder.y;
  const leftBelowShoulder = lWrist.y >= lShoulder.y;

  // Check stillness (compare to previous frame)
  const rightStill = prevRightWrist ? dist(rWrist, prevRightWrist) < STILLNESS_THRESHOLD : false;
  const leftStill = prevLeftWrist ? dist(lWrist, prevLeftWrist) < STILLNESS_THRESHOLD : false;

  // Update previous positions
  prevRightWrist = { x: rWrist.x, y: rWrist.y };
  prevLeftWrist = { x: lWrist.x, y: lWrist.y };

  // --- Priority 1: Both hands above head (restart) ---
  if (rightAboveHead && leftAboveHead && rightStill && leftStill) {
    if (!bothHandsDwellStart) {
      bothHandsDwellStart = now;
    }
    const elapsed = now - bothHandsDwellStart;
    if (elapsed >= RESTART_DWELL_MS) {
      // Trigger restart
      bothHandsDwellStart = null;
      rightHandDwellStart = null;
      lastTriggerTime = now;
      return { lastAction: "restart", pending: null, progress: 1 };
    }
    return { lastAction: null, pending: "restart", progress: elapsed / RESTART_DWELL_MS };
  } else {
    bothHandsDwellStart = null;
  }

  // --- Priority 2: Right hand above head, left below shoulder (play/pause) ---
  if (rightAboveHead && leftBelowShoulder && rightStill) {
    if (!rightHandDwellStart) {
      rightHandDwellStart = now;
    }
    const elapsed = now - rightHandDwellStart;
    if (elapsed >= PLAY_PAUSE_DWELL_MS) {
      // Trigger play/pause
      rightHandDwellStart = null;
      lastTriggerTime = now;
      return { lastAction: "play_pause", pending: null, progress: 1 };
    }
    return { lastAction: null, pending: "play_pause", progress: elapsed / PLAY_PAUSE_DWELL_MS };
  } else {
    rightHandDwellStart = null;
  }

  // --- Priority 3: Left hand swipe (skip) ---
  if (leftAboveShoulder) {
    if (swipeStartX === null) {
      // Start tracking swipe
      swipeStartX = lWrist.x;
      swipeStartTime = now;
    } else if (swipeStartTime !== null) {
      const dx = lWrist.x - swipeStartX;
      const dt = now - swipeStartTime;

      if (dt <= SWIPE_MAX_MS && Math.abs(dx) >= SWIPE_MIN_DELTA) {
        // Swipe detected — direction: positive dx = swipe right on screen
        // Since webcam is mirrored, swipe right visually = negative dx in normalized coords
        // But we use the raw normalized direction: dx > 0 means wrist moved right in frame
        const action: GestureAction = dx > 0 ? "skip_backward" : "skip_forward";
        swipeStartX = null;
        swipeStartTime = null;
        lastTriggerTime = now;
        return { lastAction: action, pending: null, progress: 0 };
      } else if (dt > SWIPE_MAX_MS) {
        // Timed out — reset swipe tracking
        swipeStartX = lWrist.x;
        swipeStartTime = now;
      }
    }
  } else {
    swipeStartX = null;
    swipeStartTime = null;
  }

  return none;
}

export function resetGestureState(): void {
  prevRightWrist = null;
  prevLeftWrist = null;
  rightHandDwellStart = null;
  bothHandsDwellStart = null;
  swipeStartX = null;
  swipeStartTime = null;
  lastTriggerTime = 0;
}
