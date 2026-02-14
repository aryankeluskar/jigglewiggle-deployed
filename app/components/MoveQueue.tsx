"use client";

import { useEffect, useRef, useMemo, useState, useCallback } from "react";
import { drawSkeleton } from "../lib/pose";
import type { NormalizedLandmark } from "../lib/pose";
import type { StripPoseTimeline } from "../lib/videoPoseExtractor";
import { normalizePose, comparePoses, classifyPose } from "../lib/poseComparison";

type Props = {
  timeline: StripPoseTimeline;
  currentTime: number;
  livePoseRef: React.RefObject<NormalizedLandmark[] | null>;
  onSeek: (time: number) => void;
};

const CARD_W = 80;
const CARD_H = 120;
const VISIBLE_CARDS = 7;

const REF_STYLE = {
  mirror: false,
  strokeColor: "#A78BFA",
  fillColor: "#C4B5FD",
  lineWidth: 1.5,
  pointRadius: 2,
  opacity: 1,
  clear: true,
} as const;

export default function MoveQueue({ timeline, currentTime, livePoseRef, onSeek }: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const canvasRefs = useRef<Map<number, HTMLCanvasElement>>(new Map());
  const overlayCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const prevSampleIdxRef = useRef(0);
  const [matchScore, setMatchScore] = useState<number | null>(null);
  // Track best score achieved per card index (persists as user dances through)
  const cardScoresRef = useRef<Map<number, number>>(new Map());
  const [cardScores, setCardScores] = useState<Map<number, number>>(new Map());

  // Timeline is already sampled (e.g. every 2s) — just classify
  const samples = useMemo(() => {
    return timeline.map((frame, idx) => ({
      idx,
      time: frame.time,
      label: frame.landmarks.length > 0 ? classifyPose(frame.landmarks) : "—",
    }));
  }, [timeline]);

  // Pre-render mini skeletons onto canvases once
  useEffect(() => {
    for (const sample of samples) {
      const canvas = canvasRefs.current.get(sample.idx);
      if (!canvas) continue;
      const ctx = canvas.getContext("2d");
      if (!ctx) continue;

      const landmarks = timeline[sample.idx]?.landmarks ?? [];
      if (landmarks.length > 0) {
        drawSkeleton(ctx, landmarks, CARD_W, CARD_H, REF_STYLE);
      } else {
        ctx.clearRect(0, 0, CARD_W, CARD_H);
        ctx.fillStyle = "rgba(255,255,255,0.1)";
        ctx.font = "10px sans-serif";
        ctx.textAlign = "center";
        ctx.fillText("No pose", CARD_W / 2, CARD_H / 2);
      }
    }
  }, [samples, timeline]);

  // Find current sample index
  const currentSampleIdx = useMemo(() => {
    let closest = 0;
    for (let i = 0; i < samples.length; i++) {
      if (samples[i].time <= currentTime) {
        closest = i;
      } else {
        break;
      }
    }
    return closest;
  }, [samples, currentTime]);

  // When active card changes: redraw active in normalized space, restore previous
  useEffect(() => {
    const prevIdx = prevSampleIdxRef.current;

    if (prevIdx !== currentSampleIdx && prevIdx < samples.length) {
      const prevSample = samples[prevIdx];
      const canvas = canvasRefs.current.get(prevSample.idx);
      if (canvas) {
        const ctx = canvas.getContext("2d");
        if (ctx) {
          const landmarks = timeline[prevSample.idx]?.landmarks ?? [];
          if (landmarks.length > 0) {
            drawSkeleton(ctx, landmarks, CARD_W, CARD_H, REF_STYLE);
          }
        }
      }
    }

    const sample = samples[currentSampleIdx];
    if (sample) {
      const canvas = canvasRefs.current.get(sample.idx);
      if (canvas) {
        const ctx = canvas.getContext("2d");
        if (ctx) {
          const landmarks = timeline[sample.idx]?.landmarks ?? [];
          if (landmarks.length > 0) {
            const normRef = normalizePose(landmarks);
            drawSkeleton(ctx, normRef, CARD_W, CARD_H, REF_STYLE);
          }
        }
      }
    }

    prevSampleIdxRef.current = currentSampleIdx;
  }, [currentSampleIdx, samples, timeline]);

  // rAF loop: draw live overlay + track per-card performance
  useEffect(() => {
    let raf: number;
    let lastScoreUpdate = 0;

    const draw = () => {
      const canvas = overlayCanvasRef.current;
      const live = livePoseRef.current;
      const sample = samples[currentSampleIdx];

      if (canvas && live && sample) {
        const ctx = canvas.getContext("2d");
        if (ctx) {
          const refLandmarks = timeline[sample.idx]?.landmarks ?? [];

          if (refLandmarks.length > 0 && live.length > 0) {
            const normRef = normalizePose(refLandmarks);
            const normLive = normalizePose(live);
            const comparison = comparePoses(normRef, normLive);

            drawSkeleton(ctx, normLive, CARD_W, CARD_H, {
              mirror: true,
              strokeColor: "#ffffff",
              fillColor: "#ffffff",
              lineWidth: 1.5,
              pointRadius: 1.5,
              opacity: 0.85,
              clear: true,
              connectionColors: comparison.connectionColors,
            });

            const now = performance.now();
            if (now - lastScoreUpdate > 250) {
              lastScoreUpdate = now;
              setMatchScore(comparison.overallScore);

              // Record best score for this card
              const prev = cardScoresRef.current.get(currentSampleIdx) ?? 0;
              if (comparison.overallScore > prev) {
                cardScoresRef.current.set(currentSampleIdx, comparison.overallScore);
                setCardScores(new Map(cardScoresRef.current));
              }
            }
          } else {
            ctx.clearRect(0, 0, CARD_W, CARD_H);
          }
        }
      }

      raf = requestAnimationFrame(draw);
    };

    raf = requestAnimationFrame(draw);
    return () => cancelAnimationFrame(raf);
  }, [currentSampleIdx, samples, timeline, livePoseRef]);

  const handleCardClick = useCallback(
    (time: number) => {
      onSeek(time);
    },
    [onSeek]
  );

  if (samples.length === 0) return null;

  const halfVisible = Math.floor(VISIBLE_CARDS / 2);
  const offsetX = -(currentSampleIdx - halfVisible) * (CARD_W + 12);

  return (
    <div className="w-full overflow-hidden" style={{ height: CARD_H + 44 }}>
      <div
        ref={containerRef}
        className="flex gap-3 items-end transition-transform duration-300 ease-out"
        style={{
          transform: `translateX(calc(50% - ${CARD_W / 2}px + ${offsetX}px))`,
        }}
      >
        {samples.map((sample, i) => {
          const isCurrent = i === currentSampleIdx;
          const isPast = i < currentSampleIdx;
          const opacity = isCurrent ? 1 : isPast ? 0.4 : 0.6;

          const mins = Math.floor(sample.time / 60);
          const secs = Math.floor(sample.time % 60);
          const timestamp = `${mins}:${secs.toString().padStart(2, "0")}`;

          // Performance border color for past cards
          const perfScore = cardScores.get(i);
          let borderClass = "border-white/10";
          if (isCurrent) {
            borderClass = "border-pink-500 shadow-[0_0_12px_rgba(236,72,153,0.4)]";
          } else if (perfScore !== undefined) {
            borderClass =
              perfScore >= 80
                ? "border-green-500/70"
                : perfScore >= 50
                  ? "border-yellow-500/70"
                  : "border-red-500/70";
          }

          return (
            <div
              key={sample.idx}
              className="flex flex-col items-center flex-shrink-0 transition-all duration-300 cursor-pointer"
              style={{ opacity }}
              onClick={() => handleCardClick(sample.time)}
            >
              <div
                className={`rounded-lg border-2 transition-all duration-300 ${borderClass} ${
                  isCurrent ? "scale-110" : "hover:scale-105 hover:border-white/30"
                }`}
                style={{
                  width: CARD_W,
                  height: CARD_H,
                  background: "rgba(0,0,0,0.6)",
                  position: "relative",
                }}
              >
                <canvas
                  ref={(el) => {
                    if (el) canvasRefs.current.set(sample.idx, el);
                  }}
                  width={CARD_W}
                  height={CARD_H}
                  style={{ position: "absolute", top: 0, left: 0 }}
                />

                {isCurrent && (
                  <canvas
                    ref={overlayCanvasRef}
                    width={CARD_W}
                    height={CARD_H}
                    style={{ position: "absolute", top: 0, left: 0 }}
                  />
                )}

                {isCurrent && matchScore !== null && (
                  <div
                    style={{
                      position: "absolute",
                      top: 2,
                      right: 2,
                      fontSize: 9,
                      fontWeight: 700,
                      padding: "1px 4px",
                      borderRadius: 4,
                      background:
                        matchScore >= 80
                          ? "#22c55e"
                          : matchScore >= 50
                            ? "#eab308"
                            : "#ef4444",
                      color: "#000",
                      lineHeight: 1.2,
                    }}
                  >
                    {matchScore}
                  </div>
                )}
              </div>
              <span className={`text-[10px] mt-1 ${isCurrent ? "text-pink-400" : "text-white/30"}`}>
                {timestamp}
              </span>
              <span className={`text-[8px] leading-tight ${isCurrent ? "text-white/70" : "text-white/20"}`}>
                {sample.label}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
