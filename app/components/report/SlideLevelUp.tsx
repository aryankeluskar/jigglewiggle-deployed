"use client";

import type { AIReport } from "./types";
import type { AppMode } from "../../shared/mode";
import { getGradeColors } from "./types";

type Props = {
  report: AIReport;
  active: boolean;
  onClose: () => void;
  mode: AppMode;
};

export default function SlideLevelUp({ report, active, onClose, mode }: Props) {
  const isGym = mode === "gym";
  const gc = getGradeColors(report.grade, mode);

  return (
    <div
      className={`absolute inset-0 flex flex-col items-center justify-center px-8 transition-opacity duration-500 ${
        active ? "opacity-100" : "opacity-0 pointer-events-none"
      }`}
    >
      {/* Title */}
      <div
        className={`text-base tracking-[0.5em] uppercase mb-10 ${isGym ? "" : "neon-text-cyan"}`}
        style={{
          fontFamily: "var(--font-audiowide)",
          ...(isGym ? {
            color: gc.color,
            textShadow: `0 0 7px ${gc.glow}, 0 0 20px ${gc.glow}`,
          } : {}),
        }}
      >
        {isGym ? "Next Session" : "Level Up"}
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
        className={`mt-10 text-center max-w-md animate-glow-pulse ${active ? "report-subtitle-pop" : ""} ${isGym ? "" : "neon-text-cyan"}`}
        style={{
          fontSize: "clamp(1.05rem, 2.8vw, 1.35rem)",
          fontFamily: "var(--font-chakra-petch)",
          animationDelay: "0.6s",
          ...(isGym ? {
            color: gc.color,
            textShadow: `0 0 7px ${gc.glow}, 0 0 20px ${gc.glow}`,
          } : {}),
        }}
      >
        {report.summary}
      </p>

      {/* CTA button */}
      <button
        className={`mt-10 px-10 py-3.5 rounded text-base tracking-[0.2em] uppercase ${isGym ? "report-btn-gym" : "neon-btn"}`}
        style={{ fontFamily: "var(--font-audiowide)" }}
        onClick={(e) => {
          e.stopPropagation();
          onClose();
        }}
      >
        {isGym ? "Train Again" : "Dance Again"}
      </button>
    </div>
  );
}
