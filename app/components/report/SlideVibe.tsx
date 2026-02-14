"use client";

import type { AIReport } from "./types";
import type { SessionStats } from "../../lib/sessionStats";
import { GRADE_COLORS } from "./types";

type Props = {
  stats: SessionStats;
  report: AIReport;
  active: boolean;
};

const HIT_COLORS: Record<string, string> = {
  perfect: "#00ffff",
  great: "#39ff14",
  ok: "#ffe100",
  almost: "#ff6b2b",
  miss: "#ff003c",
};

function formatDuration(ms: number): string {
  const totalSec = Math.round(ms / 1000);
  const m = Math.floor(totalSec / 60);
  const s = totalSec % 60;
  return `${m}:${s.toString().padStart(2, "0")}`;
}

export default function SlideVibe({ stats, report, active }: Props) {
  const gc = GRADE_COLORS[report.grade] ?? GRADE_COLORS.B;
  const totalHits = Object.values(stats.frameHits).reduce((a, b) => a + b, 0);

  const statCards: { label: string; value: string }[] = [
    { label: "Peak Score", value: String(stats.peakScore) },
    { label: "Frames Hit", value: `${totalHits} / ${stats.totalFrames}` },
    { label: "Session", value: formatDuration(stats.sessionDurationMs) },
    {
      label: "Hit Rate",
      value: stats.totalFrames > 0 ? `${Math.round((totalHits / stats.totalFrames) * 100)}%` : "—",
    },
  ];

  return (
    <div
      className={`absolute inset-0 flex flex-col items-center justify-center px-8 transition-opacity duration-500 ${
        active ? "opacity-100" : "opacity-0 pointer-events-none"
      }`}
    >
      {/* Persona name */}
      <div
        className={active ? "report-grade-slam" : ""}
        style={{
          fontSize: "clamp(2.5rem, 7vw, 5rem)",
          fontWeight: 900,
          lineHeight: 1.1,
          textAlign: "center",
          color: gc.color,
          textShadow: gc.shadow,
          fontFamily: "var(--font-audiowide)",
        }}
      >
        {report.persona}
      </div>

      {/* Persona description */}
      <p
        className={`mt-3 text-center max-w-sm ${active ? "report-subtitle-pop" : ""}`}
        style={{
          fontFamily: "var(--font-chakra-petch)",
          fontStyle: "italic",
          fontSize: "clamp(1rem, 2.5vw, 1.3rem)",
          color: "rgba(224, 224, 255, 0.8)",
        }}
      >
        {report.personaDesc}
      </p>

      {/* Stats grid */}
      <div className="grid grid-cols-2 gap-4 mt-8 w-full max-w-md">
        {statCards.map((card, i) => (
          <div
            key={card.label}
            className={`report-stat-card ${active ? "report-stat-pop" : ""}`}
            style={{ animationDelay: `${0.3 + i * 0.1}s` }}
          >
            <div
              className="text-[11px] tracking-[0.2em] uppercase mb-1.5"
              style={{ fontFamily: "var(--font-audiowide)", color: `${gc.color}99` }}
            >
              {card.label}
            </div>
            <div
              className="text-2xl font-bold"
              style={{ fontFamily: "var(--font-audiowide)", color: gc.color, textShadow: `0 0 10px ${gc.glow}` }}
            >
              {card.value}
            </div>
          </div>
        ))}
      </div>

      {/* Frame hit distribution pills */}
      <div className="flex gap-2.5 mt-7 flex-wrap justify-center">
        {(["perfect", "great", "ok", "almost", "miss"] as const).map((type) => {
          const count = stats.frameHits[type] ?? 0;
          if (count === 0) return null;
          return (
            <div
              key={type}
              className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-white/5 border border-white/10"
            >
              <span
                className="w-2.5 h-2.5 rounded-full"
                style={{ background: HIT_COLORS[type], boxShadow: `0 0 6px ${HIT_COLORS[type]}` }}
              />
              <span className="text-[12px] tracking-wider uppercase text-white/60" style={{ fontFamily: "var(--font-audiowide)" }}>
                {type}
              </span>
              <span className="text-[13px] font-bold text-white/90" style={{ fontFamily: "var(--font-audiowide)" }}>
                {count}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
