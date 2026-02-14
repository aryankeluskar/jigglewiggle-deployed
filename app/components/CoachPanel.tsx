"use client";

import { useState, useRef, useEffect, useMemo } from "react";
import { isMuted, setMuted } from "../shared/speech";

type Props = {
  score: number;
  message: string;
  showScore?: boolean;
};

// Compute a single RGB color that smoothly maps to score tier
function scoreToColor(score: number): { r: number; g: number; b: number } {
  if (score >= 80) return { r: 57, g: 255, b: 20 };
  if (score >= 50) return { r: 255, g: 225, b: 0 };
  return { r: 255, g: 0, b: 60 };
}

function scoreToLabel(score: number): string {
  if (score >= 90) return "PERFECT";
  if (score >= 80) return "FIRE";
  if (score >= 60) return "GOOD";
  if (score >= 40) return "MOVE";
  return "";
}

export default function CoachPanel({ score, message, showScore }: Props) {
  const [muted, _setMuted] = useState(isMuted());
  const toggleMute = () => {
    const next = !muted;
    setMuted(next);
    _setMuted(next);
  };

  // Track label changes for bounce animation
  const label = scoreToLabel(score);
  const prevLabelRef = useRef(label);
  const [labelBounce, setLabelBounce] = useState(false);

  useEffect(() => {
    if (label && label !== prevLabelRef.current) {
      setLabelBounce(true);
      const t = setTimeout(() => setLabelBounce(false), 400);
      prevLabelRef.current = label;
      return () => clearTimeout(t);
    }
    prevLabelRef.current = label;
  }, [label]);

  // All reactive colors as inline styles for smooth CSS transitions
  const c = useMemo(() => scoreToColor(score), [score]);
  const rgba = (a: number) => `rgba(${c.r}, ${c.g}, ${c.b}, ${a})`;

  const glowIntensity = score >= 80 ? 1 : score >= 50 ? 0.7 : 0.4;

  return (
    <div
      className="flex items-center gap-5 w-full px-5 py-3 bg-black/50 rounded relative overflow-hidden"
      style={{
        borderWidth: 1,
        borderStyle: "solid",
        borderColor: rgba(score > 0 ? 0.25 : 0.08),
        transition: "border-color 0.6s ease, box-shadow 0.6s ease",
        boxShadow: score > 0
          ? `0 0 ${8 * glowIntensity}px ${rgba(0.15)}, inset 0 0 ${12 * glowIntensity}px ${rgba(0.03)}`
          : "none",
      }}
    >
      {/* HUD corners */}
      <div className="absolute top-0 left-0 w-4 h-4 border-t-2 border-l-2 border-neon-cyan/30 z-10" />
      <div className="absolute top-0 right-0 w-4 h-4 border-t-2 border-r-2 border-neon-cyan/30 z-10" />
      <div className="absolute bottom-0 left-0 w-4 h-4 border-b-2 border-l-2 border-neon-cyan/30 z-10" />
      <div className="absolute bottom-0 right-0 w-4 h-4 border-b-2 border-r-2 border-neon-cyan/30 z-10" />

      {/* Score display — visible once reference scoring is active */}
      {showScore && (
        <>
          <div className="flex-shrink-0 flex flex-col items-center gap-1">
            <span
              className="text-[8px] tracking-[0.3em] uppercase text-neon-cyan/30"
              style={{ fontFamily: "var(--font-audiowide)" }}
            >
              Score
            </span>
            <div
              className="w-20 h-20 rounded flex items-center justify-center bg-black/70 animate-score-pulse"
              style={{
                borderWidth: 1,
                borderStyle: "solid",
                borderColor: rgba(0.15),
                boxShadow: `0 0 ${10 * glowIntensity}px ${rgba(0.5 * glowIntensity)}, 0 0 ${30 * glowIntensity}px ${rgba(0.25 * glowIntensity)}, 0 0 ${60 * glowIntensity}px ${rgba(0.1 * glowIntensity)}`,
                transition: "box-shadow 0.6s ease, border-color 0.6s ease",
              }}
            >
              <span
                className="text-4xl font-bold"
                style={{
                  fontFamily: "var(--font-audiowide)",
                  color: `rgb(${c.r}, ${c.g}, ${c.b})`,
                  textShadow: `0 0 10px ${rgba(0.9)}, 0 0 25px ${rgba(0.5)}, 0 0 50px ${rgba(0.25)}`,
                  transition: "color 0.6s ease, text-shadow 0.6s ease",
                }}
              >
                {score}
              </span>
            </div>
            {/* Label — fixed height so it doesn't shift layout */}
            <div className="h-4 flex items-center">
              {label && (
                <span
                  className={labelBounce ? "score-label" : ""}
                  style={{
                    fontFamily: "var(--font-audiowide)",
                    fontSize: 10,
                    letterSpacing: "0.2em",
                    textTransform: "uppercase" as const,
                    fontWeight: 700,
                    color: `rgb(${c.r}, ${c.g}, ${c.b})`,
                    textShadow: `0 0 7px ${rgba(0.6)}, 0 0 15px ${rgba(0.3)}`,
                    transition: "color 0.6s ease, text-shadow 0.6s ease",
                  }}
                >
                  {label}
                </span>
              )}
            </div>
          </div>

          {/* Vertical score bar */}
          <div className="flex-shrink-0 w-2 h-16 bg-white/5 rounded-full overflow-hidden self-center">
            <div
              className="w-full rounded-full"
              style={{
                height: `${score}%`,
                marginTop: `${100 - score}%`,
                background: `linear-gradient(0deg, rgb(${c.r}, ${c.g}, ${c.b}), ${rgba(0.7)})`,
                boxShadow: `0 0 8px ${rgba(0.5)}`,
                transition: "height 0.5s ease-out, margin-top 0.5s ease-out, background 0.6s ease, box-shadow 0.6s ease",
              }}
            />
          </div>
        </>
      )}

      {/* Coach message */}
      <div className="flex-1 min-w-0 pl-2">
        <p
          className="text-[8px] tracking-[0.25em] uppercase text-neon-violet/40 mb-1"
          style={{ fontFamily: "var(--font-audiowide)" }}
        >
          AI Coach
        </p>
        <p
          className="text-white/85 text-sm font-medium truncate"
          style={{ fontFamily: "var(--font-chakra-petch)" }}
        >
          {message || "Step into the arena. Show me what you\u2019ve got."}
        </p>
      </div>

      {/* Mute toggle */}
      <button
        onClick={toggleMute}
        className="flex-shrink-0 w-9 h-9 flex items-center justify-center rounded border border-neon-cyan/15 bg-black/40 text-white/50 hover:text-white/80 hover:border-neon-cyan/30 transition-colors"
        title={muted ? "Unmute coach" : "Mute coach"}
      >
        {muted ? (
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" className="w-4 h-4">
            <path d="M11 5L6 9H2v6h4l5 4V5z" />
            <line x1="23" y1="9" x2="17" y2="15" />
            <line x1="17" y1="9" x2="23" y2="15" />
          </svg>
        ) : (
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" className="w-4 h-4">
            <path d="M11 5L6 9H2v6h4l5 4V5z" />
            <path d="M19.07 4.93a10 10 0 010 14.14" />
            <path d="M15.54 8.46a5 5 0 010 7.07" />
          </svg>
        )}
      </button>
    </div>
  );
}
