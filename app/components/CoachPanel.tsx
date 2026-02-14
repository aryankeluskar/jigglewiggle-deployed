"use client";

type Props = {
  score: number;
  message: string;
};

export default function CoachPanel({ score, message }: Props) {
  const getScoreColor = () => {
    if (score >= 80) return "text-green-400";
    if (score >= 50) return "text-yellow-400";
    return "text-red-400";
  };

  const getScoreGlow = () => {
    if (score >= 80) return "shadow-green-500/30";
    if (score >= 50) return "shadow-yellow-500/30";
    return "shadow-red-500/30";
  };

  return (
    <div className="flex items-center gap-6 w-full px-6 py-4 bg-black/40 backdrop-blur-sm rounded-2xl border border-white/10">
      {/* Score circle */}
      <div
        className={`flex-shrink-0 w-20 h-20 rounded-full flex items-center justify-center bg-black/60 shadow-lg ${getScoreGlow()}`}
      >
        <span className={`text-3xl font-bold ${getScoreColor()}`}>
          {score}
        </span>
      </div>

      {/* Coaching subtitle */}
      <div className="flex-1 min-w-0">
        <p className="text-xs text-white/40 uppercase tracking-widest mb-1">
          Coach says
        </p>
        <p className="text-white text-lg font-medium truncate">
          {message || "Get ready to dance!"}
        </p>
      </div>

      {/* Score bar */}
      <div className="hidden sm:block flex-shrink-0 w-32">
        <div className="w-full h-2 bg-white/10 rounded-full overflow-hidden">
          <div
            className="h-full rounded-full transition-all duration-300 ease-out"
            style={{
              width: `${score}%`,
              background:
                score >= 80
                  ? "linear-gradient(90deg, #22c55e, #4ade80)"
                  : score >= 50
                  ? "linear-gradient(90deg, #eab308, #facc15)"
                  : "linear-gradient(90deg, #ef4444, #f87171)",
            }}
          />
        </div>
      </div>
    </div>
  );
}
