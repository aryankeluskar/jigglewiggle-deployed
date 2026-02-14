"use client";

import { useEffect, useState, useRef } from "react";

type ScoreType = "perfect" | "great" | "ok" | "almost" | "miss";

type Props = {
  score: ScoreType | null;
  onComplete?: () => void;
};

type Corner = "top-left" | "top-right" | "bottom-left" | "bottom-right";

const CORNER_POSITIONS: Record<Corner, string> = {
  "top-left": "top-4 left-4",
  "top-right": "top-4 right-4",
  "bottom-left": "bottom-4 left-4",
  "bottom-right": "bottom-4 right-4",
};

export default function ScorePopup({ score, onComplete }: Props) {
  const [isVisible, setIsVisible] = useState(false);
  const [rotation, setRotation] = useState(0);
  const [corner, setCorner] = useState<Corner>("top-right");
  const [displayScore, setDisplayScore] = useState<ScoreType | null>(null);

  // Track whether we're currently showing a popup to prevent retriggering
  const isShowingRef = useRef(false);
  // Track the last score we showed to prevent showing the same score twice
  const lastShownScoreRef = useRef<ScoreType | null>(null);
  // Store onComplete callback in a ref to avoid dependency issues
  const onCompleteRef = useRef(onComplete);

  // Update the ref whenever onComplete changes
  useEffect(() => {
    onCompleteRef.current = onComplete;
  }, [onComplete]);

  useEffect(() => {
    // Only trigger if:
    // 1. We have a new score
    // 2. We're not already showing a popup
    // 3. The score is different from the last one we showed
    if (score && !isShowingRef.current && score !== lastShownScoreRef.current) {
      console.log(`[ScorePopup] Showing ${score} popup`);

      isShowingRef.current = true;
      lastShownScoreRef.current = score;
      setDisplayScore(score);

      // Random rotation between -30 and 30 degrees
      setRotation(Math.random() * 60 - 30);

      // Random corner
      const corners: Corner[] = ["top-left", "top-right", "bottom-left", "bottom-right"];
      setCorner(corners[Math.floor(Math.random() * corners.length)]);

      setIsVisible(true);

      // Hide after animation completes
      const timer = setTimeout(() => {
        setIsVisible(false);
        setTimeout(() => {
          isShowingRef.current = false;
          onCompleteRef.current?.();
        }, 300); // Wait for fade out
      }, 1200);

      return () => {
        clearTimeout(timer);
      };
    }
  }, [score]); // Only depend on score, not onComplete

  // Reset when score goes back to null
  useEffect(() => {
    if (score === null) {
      isShowingRef.current = false;
      lastShownScoreRef.current = null;
      setDisplayScore(null);
      setIsVisible(false);
    }
  }, [score]);

  if (!displayScore) return null;

  return (
    <div
      className={`absolute ${CORNER_POSITIONS[corner]} pointer-events-none z-50 transition-opacity duration-300 ${
        isVisible ? "opacity-100" : "opacity-0"
      }`}
    >
      <div
        className={`score-popup ${isVisible ? "score-popup-enter" : ""}`}
        style={{
          transform: `rotate(${rotation}deg) scale(${isVisible ? 1 : 0.5})`,
        }}
      >
        <img
          src={`/score/${displayScore}.png`}
          alt={displayScore}
          className="w-48 h-auto drop-shadow-2xl"
          style={{
            filter: "drop-shadow(0 0 20px rgba(255, 255, 255, 0.5))",
          }}
        />
      </div>

      <style jsx>{`
        .score-popup {
          transition: transform 0.3s cubic-bezier(0.34, 1.56, 0.64, 1);
        }
        .score-popup-enter {
          animation: bang-in 0.5s cubic-bezier(0.34, 1.56, 0.64, 1);
        }
        @keyframes bang-in {
          0% {
            transform: rotate(${rotation}deg) scale(0);
            opacity: 0;
          }
          60% {
            transform: rotate(${rotation}deg) scale(1.3);
            opacity: 1;
          }
          80% {
            transform: rotate(${rotation}deg) scale(0.9);
          }
          100% {
            transform: rotate(${rotation}deg) scale(1);
            opacity: 1;
          }
        }
      `}</style>
    </div>
  );
}

/**
 * Helper to determine score type from numeric score (0-100)
 */
export function getScoreType(score: number): ScoreType {
  if (score >= 90) return "perfect";
  if (score >= 80) return "great";
  if (score >= 60) return "ok";
  if (score >= 40) return "almost";
  return "miss";
}
