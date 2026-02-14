"use client";

import { useState, useEffect, useRef } from "react";

const HISTORY_KEY = "urlHistory";
const MAX_HISTORY = 3;

function readHistory(): string[] {
  try {
    const raw = localStorage.getItem(HISTORY_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter((s): s is string => typeof s === "string").slice(0, MAX_HISTORY);
  } catch {
    return [];
  }
}

function pushHistory(url: string) {
  const history = readHistory().filter((u) => u !== url);
  history.unshift(url);
  try {
    localStorage.setItem(HISTORY_KEY, JSON.stringify(history.slice(0, MAX_HISTORY)));
  } catch {
    // ignore
  }
}

type Props = {
  onSubmit: (url: string) => void;
  initialUrl?: string;
};

export default function UrlInput({ onSubmit, initialUrl = "" }: Props) {
  const [value, setValue] = useState(initialUrl);
  const [history, setHistory] = useState<string[]>([]);
  const [open, setOpen] = useState(false);
  const wrapperRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setHistory(readHistory());
  }, []);

  // Close dropdown on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (wrapperRef.current && !wrapperRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = value.trim();
    if (!trimmed) return;
    pushHistory(trimmed);
    setHistory(readHistory());
    setOpen(false);
    onSubmit(trimmed);
  };

  const handlePick = (url: string) => {
    setValue(url);
    setOpen(false);
    pushHistory(url);
    setHistory(readHistory());
    onSubmit(url);
  };

  return (
    <form onSubmit={handleSubmit} className="flex gap-2 w-full max-w-2xl mx-auto items-center">
      <div className="flex-1 relative" ref={wrapperRef}>
        <span
          className="absolute left-3 top-1/2 -translate-y-1/2 text-[10px] tracking-widest uppercase text-neon-cyan/35"
          style={{ fontFamily: "var(--font-audiowide)" }}
        >
          URL
        </span>
        <input
          type="text"
          value={value}
          onChange={(e) => setValue(e.target.value)}
          onFocus={() => history.length > 0 && setOpen(true)}
          placeholder="paste youtube url..."
          className="neon-input w-full pl-14 pr-4 py-2.5 rounded-none text-sm tracking-wide"
          style={{ fontFamily: "var(--font-chakra-petch)" }}
        />
        {open && history.length > 0 && (
          <ul className="absolute left-0 right-0 top-full mt-1 z-50 border border-neon-cyan/20 bg-[#0a0a1a]/95 backdrop-blur-md">
            {history.map((url) => (
              <li key={url}>
                <button
                  type="button"
                  onMouseDown={(e) => {
                    e.preventDefault();
                    handlePick(url);
                  }}
                  className="w-full text-left px-4 py-2 text-xs tracking-wide text-neon-cyan/70 hover:bg-neon-cyan/10 hover:text-neon-cyan transition-colors truncate"
                  style={{ fontFamily: "var(--font-chakra-petch)" }}
                >
                  {url}
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
      <button
        type="submit"
        className="neon-btn px-5 py-2.5 text-sm font-semibold uppercase tracking-[0.15em] rounded-none"
        style={{ fontFamily: "var(--font-audiowide)" }}
      >
        Load
      </button>
    </form>
  );
}
