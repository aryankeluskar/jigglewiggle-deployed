"use client";

import type { AIReport } from "./types";
import { GRADE_COLORS } from "./types";

type Props = {
  report: AIReport;
  active: boolean;
  onClose: () => void;
};

export default function SlideLevelUp({ report, active, onClose }: Props) {
  const gc = GRADE_COLORS[report.grade] ?? GRADE_COLORS.B;

  return (
    <div
      className={`absolute inset-0 flex flex-col items-center justify-center px-8 transition-opacity duration-500 ${
        active ? "opacity-100" : "opacity-0 pointer-events-none"
      }`}
    >
      {/* Title */}
      <div
        className="text-base tracking-[0.5em] uppercase mb-10 neon-text-cyan"
        style={{ fontFamily: "var(--font-audiowide)" }}
      >
        Level Up
      </div>

      {/* Tips */}
      <div className="w-full max-w-lg flex flex-col gap-5">
        {report.tips.map((tip, i) => (
          <div
            key={i}
            className={`flex gap-4 items-start ${active ? "report-stat-pop" : ""}`}
            style={{ animationDelay: `${0.2 + i * 0.15}s` }}
          >
            <div
              className="w-1.5 self-stretch rounded-full flex-shrink-0"
              style={{
                background: `linear-gradient(180deg, ${gc.color}, ${gc.glow})`,
                boxShadow: `0 0 8px ${gc.glow}`,
              }}
            />
            <p
              className="text-base leading-relaxed"
              style={{
                fontFamily: "var(--font-chakra-petch)",
                color: "rgba(224, 224, 255, 0.9)",
              }}
            >
              {tip}
            </p>
          </div>
        ))}
      </div>

      {/* Summary */}
      <p
        className={`mt-10 text-center max-w-md neon-text-cyan animate-glow-pulse ${active ? "report-subtitle-pop" : ""}`}
        style={{
          fontSize: "clamp(1.05rem, 2.8vw, 1.35rem)",
          fontFamily: "var(--font-chakra-petch)",
          animationDelay: "0.6s",
        }}
      >
        {report.summary}
      </p>

      {/* Dance Again button */}
      <button
        className="neon-btn mt-10 px-10 py-3.5 rounded text-base tracking-[0.2em] uppercase"
        style={{ fontFamily: "var(--font-audiowide)" }}
        onClick={(e) => {
          e.stopPropagation();
          onClose();
        }}
      >
        Dance Again
      </button>
    </div>
  );
}
