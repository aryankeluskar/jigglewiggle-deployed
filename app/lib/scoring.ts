/**
 * Lightweight scoring module for dance pose evaluation.
 */

import type { NormalizedLandmark } from "./pose";

export type ScoreFrame = {
  ts: number;
  score: number; // 0-100
  issues: string[];
};

// Ring buffer of recent keypoint positions for motion energy
const HISTORY_SIZE = 15;
let history: NormalizedLandmark[][] = [];

/**
 * Compute a score frame from the current pose landmarks.
 * landmarks: array of 33 MediaPipe Pose landmarks (normalised 0-1).
 */
export function computeScore(
  landmarks: NormalizedLandmark[] | null
): ScoreFrame {
  const now = Date.now();

  if (!landmarks || landmarks.length === 0) {
    history = [];
    return { ts: now, score: 0, issues: ["No pose detected"] };
  }

  const issues: string[] = [];
  let score = 70; // baseline

  // --- Confidence ---
  const avgVisibility =
    landmarks.reduce((s, l) => s + (l.visibility ?? 0), 0) / landmarks.length;
  if (avgVisibility < 0.5) {
    score -= 15;
    issues.push("Low pose confidence");
  }

  // --- Arm height ---
  // Wrists: 15 (left), 16 (right); Shoulders: 11 (left), 12 (right)
  const leftWrist = landmarks[15];
  const rightWrist = landmarks[16];
  const leftShoulder = landmarks[11];
  const rightShoulder = landmarks[12];

  if (leftWrist && rightWrist && leftShoulder && rightShoulder) {
    const avgWristY = (leftWrist.y + rightWrist.y) / 2;
    const avgShoulderY = (leftShoulder.y + rightShoulder.y) / 2;

    // In normalised coords, lower y = higher on screen
    if (avgWristY > avgShoulderY + 0.15) {
      score -= 10;
      issues.push("Arms too low");
    }

    // --- Symmetry ---
    const armDiff = Math.abs(leftWrist.y - rightWrist.y);
    if (armDiff > 0.18) {
      score -= 8;
      issues.push("Arms uneven");
    }
  }

  // --- Motion energy ---
  history.push(landmarks);
  if (history.length > HISTORY_SIZE) history.shift();

  if (history.length >= 3) {
    const prev = history[history.length - 3];
    const curr = history[history.length - 1];
    let totalDisp = 0;
    const count = Math.min(prev.length, curr.length);
    for (let i = 0; i < count; i++) {
      const dx = curr[i].x - prev[i].x;
      const dy = curr[i].y - prev[i].y;
      totalDisp += Math.sqrt(dx * dx + dy * dy);
    }
    const avgDisp = totalDisp / count;

    if (avgDisp < 0.008) {
      score -= 12;
      issues.push("Not moving enough");
    } else if (avgDisp > 0.12) {
      score -= 8;
      issues.push("Moving too chaotically");
    } else {
      // Good movement range — bonus
      score += 10;
    }
  }

  // Clamp
  score = Math.max(0, Math.min(100, score));

  return { ts: now, score: Math.round(score), issues };
}
