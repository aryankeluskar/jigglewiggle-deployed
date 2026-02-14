"use client";

import { useState } from "react";

type Props = {
  onSubmit: (url: string) => void;
  initialUrl?: string;
};

export default function UrlInput({ onSubmit, initialUrl = "" }: Props) {
  const [value, setValue] = useState(initialUrl);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (value.trim()) onSubmit(value.trim());
  };

  return (
    <form onSubmit={handleSubmit} className="flex gap-2 w-full max-w-2xl mx-auto items-center">
      <div className="flex-1 relative">
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
          placeholder="paste youtube url..."
          className="neon-input w-full pl-14 pr-4 py-2.5 rounded-none text-sm tracking-wide"
          style={{ fontFamily: "var(--font-chakra-petch)" }}
        />
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
