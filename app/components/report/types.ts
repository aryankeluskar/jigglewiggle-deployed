import type { SessionStats } from "../../lib/sessionStats";
import type { AppMode } from "../../shared/mode";

export type AIReport = {
  grade: "S" | "A" | "B" | "C" | "D";
  headline: string;
  persona: string;
  personaDesc: string;
  summary: string;
  tips: string[];
  bestLimb: string;
  worstLimb: string;
};

export type ReportCardProps = {
  stats: SessionStats;
  report: AIReport | null;
  mode: AppMode;
  videoTitle: string;
  loading: boolean;
  onClose: () => void;
};

export const GRADE_COLORS: Record<string, { color: string; glow: string; shadow: string }> = {
  S: {
    color: "#00ffff",
    glow: "rgba(255, 0, 170, 0.6)",
    shadow: "0 0 10px rgba(0,255,255,1), 0 0 30px rgba(0,255,255,0.9), 0 0 60px rgba(255,0,170,0.6), 0 0 120px rgba(255,0,170,0.4), 0 0 200px rgba(0,255,255,0.2)",
  },
  A: {
    color: "#39ff14",
    glow: "rgba(0, 255, 255, 0.6)",
    shadow: "0 0 10px rgba(57,255,20,1), 0 0 30px rgba(57,255,20,0.9), 0 0 60px rgba(0,255,255,0.6), 0 0 120px rgba(0,255,255,0.4), 0 0 200px rgba(57,255,20,0.2)",
  },
  B: {
    color: "#ffe100",
    glow: "rgba(255, 107, 43, 0.6)",
    shadow: "0 0 10px rgba(255,225,0,1), 0 0 30px rgba(255,225,0,0.9), 0 0 60px rgba(255,107,43,0.6), 0 0 120px rgba(255,107,43,0.4), 0 0 200px rgba(255,225,0,0.2)",
  },
  C: {
    color: "#ff6b2b",
    glow: "rgba(255, 0, 60, 0.6)",
    shadow: "0 0 10px rgba(255,107,43,1), 0 0 30px rgba(255,107,43,0.9), 0 0 60px rgba(255,0,60,0.6), 0 0 120px rgba(255,0,60,0.4), 0 0 200px rgba(255,107,43,0.2)",
  },
  D: {
    color: "#ff003c",
    glow: "rgba(184, 41, 255, 0.6)",
    shadow: "0 0 10px rgba(255,0,60,1), 0 0 30px rgba(255,0,60,0.9), 0 0 60px rgba(184,41,255,0.6), 0 0 120px rgba(184,41,255,0.4), 0 0 200px rgba(255,0,60,0.2)",
  },
};

export const LIMB_LABELS: Record<string, string> = {
  rightArm: "Right Arm",
  leftArm: "Left Arm",
  rightLeg: "Right Leg",
  leftLeg: "Left Leg",
  torso: "Torso",
};

export function limbAverage(limbTotals: Record<string, { sum: number; count: number }>): Record<string, number> {
  const avgs: Record<string, number> = {};
  for (const [limb, { sum, count }] of Object.entries(limbTotals)) {
    avgs[limb] = count > 0 ? Math.round(sum / count) : 0;
  }
  return avgs;
}
