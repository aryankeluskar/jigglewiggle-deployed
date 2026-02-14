"use client";

import { useEffect, useRef, useMemo } from "react";
import { drawSkeleton } from "../lib/pose";
import type { PoseTimeline } from "../lib/videoPoseExtractor";

type Props = {
  timeline: PoseTimeline;
  currentTime: number;
};

const CARD_W = 80;
const CARD_H = 120;
const SAMPLE_INTERVAL = 2; // seconds between cards
const VISIBLE_CARDS = 7;

export default function MoveQueue({ timeline, currentTime }: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const canvasRefs = useRef<Map<number, HTMLCanvasElement>>(new Map());

  // Sample timeline at 2s intervals
  const samples = useMemo(() => {
    const result: { index: number; time: number }[] = [];
    for (let t = 0; t < timeline.length; t++) {
      const frame = timeline[t];
      if (result.length === 0 || frame.time - result[result.length - 1].time >= SAMPLE_INTERVAL) {
        result.push({ index: t, time: frame.time });
      }
    }
    return result;
  }, [timeline]);

  // Pre-render mini skeletons onto canvases once
  useEffect(() => {
    for (const sample of samples) {
      const canvas = canvasRefs.current.get(sample.index);
      if (!canvas) continue;
      const ctx = canvas.getContext("2d");
      if (!ctx) continue;

      const frame = timeline[sample.index];
      if (frame.landmarks.length > 0) {
        drawSkeleton(ctx, frame.landmarks, CARD_W, CARD_H, {
          mirror: false,
          strokeColor: "#A78BFA",
          fillColor: "#C4B5FD",
          lineWidth: 1.5,
          pointRadius: 2,
          opacity: 1,
          clear: true,
        });
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

  if (samples.length === 0) return null;

  // Compute scroll offset to center the current card
  const halfVisible = Math.floor(VISIBLE_CARDS / 2);
  const offsetX = -(currentSampleIdx - halfVisible) * (CARD_W + 12);

  return (
    <div className="w-full overflow-hidden" style={{ height: CARD_H + 32 }}>
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
          const opacity = isCurrent ? 1 : isPast ? 0.3 : 0.6;

          const mins = Math.floor(sample.time / 60);
          const secs = Math.floor(sample.time % 60);
          const timestamp = `${mins}:${secs.toString().padStart(2, "0")}`;

          return (
            <div
              key={sample.index}
              className="flex flex-col items-center flex-shrink-0 transition-all duration-300"
              style={{ opacity }}
            >
              <div
                className={`rounded-lg border-2 transition-all duration-300 ${
                  isCurrent
                    ? "border-pink-500 shadow-[0_0_12px_rgba(236,72,153,0.4)] scale-110"
                    : "border-white/10"
                }`}
                style={{ width: CARD_W, height: CARD_H, background: "rgba(0,0,0,0.6)" }}
              >
                <canvas
                  ref={(el) => {
                    if (el) canvasRefs.current.set(sample.index, el);
                  }}
                  width={CARD_W}
                  height={CARD_H}
                />
              </div>
              <span className={`text-[10px] mt-1 ${isCurrent ? "text-pink-400" : "text-white/30"}`}>
                {timestamp}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
