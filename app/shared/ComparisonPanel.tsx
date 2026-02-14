"use client";

import type { ComparisonResult } from "./compare";

type Props = {
  comparison: ComparisonResult | null;
  coachMessage: string;
};

export default function ComparisonPanel({ comparison, coachMessage }: Props) {
  const sim = comparison?.similarity ?? 0;

  const getColor = (score: number) => {
    if (score >= 80) return "text-green-400";
    if (score >= 50) return "text-yellow-400";
    return "text-red-400";
  };

  const getBarColor = (score: number) => {
    if (score >= 80) return "bg-green-400";
    if (score >= 50) return "bg-yellow-400";
    return "bg-red-400";
  };

  const getGlow = () => {
    if (sim >= 80) return "shadow-green-500/30";
    if (sim >= 50) return "shadow-yellow-500/30";
    return "shadow-red-500/30";
  };

  return (
    <div className="flex items-center gap-6 w-full px-6 py-4 bg-black/40 backdrop-blur-sm rounded-2xl border border-white/10">
      {/* Match score circle */}
      <div className={`flex-shrink-0 w-20 h-20 rounded-full flex flex-col items-center justify-center bg-black/60 shadow-lg ${getGlow()}`}>
        <span className={`text-3xl font-bold ${getColor(sim)}`}>{sim}</span>
        <span className="text-[10px] text-white/40 -mt-1">MATCH</span>
      </div>

      {/* Body part breakdown */}
      {comparison && (
        <div className="flex-shrink-0 flex flex-col gap-1.5 w-28">
          <PartBar label="Arms" score={comparison.parts.arms} getBarColor={getBarColor} />
          <PartBar label="Legs" score={comparison.parts.legs} getBarColor={getBarColor} />
          <PartBar label="Torso" score={comparison.parts.torso} getBarColor={getBarColor} />
        </div>
      )}

      {/* Coach feedback */}
      <div className="flex-1 min-w-0">
        <p className="text-xs text-white/40 uppercase tracking-widest mb-1">Coach says</p>
        <p className="text-white text-lg font-medium truncate">
          {coachMessage || comparison?.feedback[0] || "Get ready to dance!"}
        </p>
        {comparison && comparison.feedback.length > 1 && (
          <p className="text-white/40 text-xs mt-1 truncate">{comparison.feedback.slice(1).join(" · ")}</p>
        )}
      </div>

      {/* Overall bar */}
      <div className="hidden sm:block flex-shrink-0 w-32">
        <div className="w-full h-2 bg-white/10 rounded-full overflow-hidden">
          <div
            className="h-full rounded-full transition-all duration-300 ease-out"
            style={{
              width: `${sim}%`,
              background:
                sim >= 80
                  ? "linear-gradient(90deg, #22c55e, #4ade80)"
                  : sim >= 50
                  ? "linear-gradient(90deg, #eab308, #facc15)"
                  : "linear-gradient(90deg, #ef4444, #f87171)",
            }}
          />
        </div>
      </div>
    </div>
  );
}

function PartBar({ label, score, getBarColor }: { label: string; score: number; getBarColor: (s: number) => string }) {
  return (
    <div className="flex items-center gap-2">
      <span className="text-[10px] text-white/40 w-10 text-right">{label}</span>
      <div className="flex-1 h-1.5 bg-white/10 rounded-full overflow-hidden">
        <div
          className={`h-full rounded-full transition-all duration-300 ${getBarColor(score)}`}
          style={{ width: `${score}%` }}
        />
      </div>
      <span className="text-[10px] text-white/50 w-6">{score}</span>
    </div>
  );
}
