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
    <form onSubmit={handleSubmit} className="flex gap-2 w-full max-w-2xl mx-auto">
      <input
        type="text"
        value={value}
        onChange={(e) => setValue(e.target.value)}
        placeholder="Paste a YouTube URL…"
        className="flex-1 px-4 py-3 rounded-xl bg-white/10 border border-white/20 text-white placeholder-white/40 outline-none focus:border-pink-500 focus:ring-1 focus:ring-pink-500 transition-all text-sm"
      />
      <button
        type="submit"
        className="px-6 py-3 rounded-xl bg-gradient-to-r from-pink-500 to-violet-500 text-white font-semibold text-sm hover:opacity-90 transition-opacity cursor-pointer"
      >
        Load
      </button>
    </form>
  );
}
