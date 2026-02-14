"use client";

import { useState } from "react";

const GESTURES = [
  {
    icon: "\u270B",
    key: "play_pause",
    label: "Play / Pause",
    desc: "Right hand above head, hold 1.5s",
  },
  {
    icon: "\u{1F449}",
    key: "skip",
    label: "Skip \u00B15s",
    desc: "Left hand above shoulder, swipe L/R",
  },
  {
    icon: "\u{1F64C}",
    key: "restart",
    label: "Restart",
    desc: "Both hands above head, hold 2s",
  },
] as const;

export default function GestureGuide() {
  const [open, setOpen] = useState(false);

  return (
    <div className="absolute bottom-2 left-3 z-20">
      {/* Expanded panel */}
      {open && (
        <div
          className="mb-2 w-56 bg-black/85 border border-neon-cyan/20 rounded-sm backdrop-blur-sm overflow-hidden"
          style={{ fontFamily: "var(--font-audiowide)" }}
        >
          <div className="px-3 py-2 border-b border-neon-cyan/10 flex items-center justify-between">
            <span className="text-[8px] tracking-[0.25em] uppercase neon-text-cyan opacity-60">
              Gesture Controls
            </span>
          </div>
          <div className="flex flex-col gap-0">
            {GESTURES.map((g) => (
              <div
                key={g.key}
                className="flex items-start gap-2.5 px-3 py-2 border-b border-white/5 last:border-b-0"
              >
                <span className="text-base flex-shrink-0 mt-0.5 leading-none">{g.icon}</span>
                <div className="min-w-0">
                  <p className="text-[9px] tracking-[0.15em] uppercase text-white/80 leading-tight">
                    {g.label}
                  </p>
                  <p className="text-[8px] tracking-[0.1em] text-white/35 leading-tight mt-0.5">
                    {g.desc}
                  </p>
                </div>
              </div>
            ))}
          </div>
          <div className="px-3 py-1.5 border-t border-neon-cyan/10">
            <p className="text-[7px] tracking-[0.1em] text-white/20 leading-tight">
              Hold still to trigger &middot; 2s cooldown between gestures
            </p>
          </div>
        </div>
      )}

      {/* Toggle button */}
      <button
        onClick={() => setOpen((v) => !v)}
        className="flex items-center gap-1.5 px-2.5 py-1 bg-black/70 border border-neon-cyan/20 rounded-sm text-white/50 hover:text-white/80 hover:border-neon-cyan/40 transition-colors"
        title={open ? "Hide gesture controls" : "Show gesture controls"}
      >
        <svg
          xmlns="http://www.w3.org/2000/svg"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth={1.5}
          strokeLinecap="round"
          strokeLinejoin="round"
          className="w-3.5 h-3.5"
        >
          <path d="M18 11V6a2 2 0 0 0-4 0" />
          <path d="M14 10V4a2 2 0 0 0-4 0v6" />
          <path d="M10 10.5V6a2 2 0 0 0-4 0v8" />
          <path d="M18 11a2 2 0 1 1 4 0v3a8 8 0 0 1-8 8h-2c-2.8 0-4.5-.86-5.99-2.34l-3.6-3.6a2 2 0 0 1 2.83-2.82L7 15" />
        </svg>
        <span
          className="text-[8px] tracking-[0.2em] uppercase"
          style={{ fontFamily: "var(--font-audiowide)" }}
        >
          {open ? "Hide" : "Gestures"}
        </span>
      </button>
    </div>
  );
}
