"use client";

import { forwardRef, useImperativeHandle, useRef } from "react";

type DownloadStatus = "idle" | "downloading" | "done" | "error";
type ExtractionStatus = "idle" | "extracting" | "done";

export type YoutubePanelHandle = {
  getCurrentTime: () => number;
  seekTo: (time: number) => void;
};

type Props = {
  videoId: string | null;
  downloadStatus: DownloadStatus;
  downloadProgress: number;
  downloadError: string | null;
  extractionStatus: ExtractionStatus;
  extractionProgress: number;
};

function HudCorners({ color = "neon-cyan" }: { color?: string }) {
  const c = `border-${color}/50`;
  return (
    <>
      <div className={`absolute top-0 left-0 w-4 h-4 border-t-2 border-l-2 ${c} z-10`} />
      <div className={`absolute top-0 right-0 w-4 h-4 border-t-2 border-r-2 ${c} z-10`} />
      <div className={`absolute bottom-0 left-0 w-4 h-4 border-b-2 border-l-2 ${c} z-10`} />
      <div className={`absolute bottom-0 right-0 w-4 h-4 border-b-2 border-r-2 ${c} z-10`} />
    </>
  );
}

function PanelLabel({ children }: { children: React.ReactNode }) {
  return (
    <div
      className="absolute top-2 left-3 z-10 text-[8px] tracking-[0.3em] uppercase text-neon-cyan/35"
      style={{ fontFamily: "var(--font-audiowide)" }}
    >
      {children}
    </div>
  );
}

const YoutubePanel = forwardRef<YoutubePanelHandle, Props>(function YoutubePanel(
  {
    videoId,
    downloadStatus,
    downloadProgress,
    downloadError,
    extractionStatus,
    extractionProgress,
  },
  ref
) {
  const videoRef = useRef<HTMLVideoElement>(null);

  useImperativeHandle(ref, () => ({
    getCurrentTime: () => videoRef.current?.currentTime ?? 0,
    seekTo: (time: number) => {
      if (videoRef.current) videoRef.current.currentTime = time;
    },
  }));

  if (!videoId || downloadStatus === "idle") {
    return (
      <div className="relative w-full h-full flex items-center justify-center bg-black/50 border border-neon-cyan/10 rounded animate-border-breathe">
        <HudCorners />
        <PanelLabel>Reference</PanelLabel>
        <div className="text-center">
          <div
            className="neon-text-cyan text-[40px] mb-3 opacity-20"
            style={{ fontFamily: "var(--font-audiowide)" }}
          >
            &#9654;
          </div>
          <p className="text-neon-cyan/25 text-xs tracking-wider uppercase">
            Paste a YouTube URL to begin
          </p>
        </div>
      </div>
    );
  }

  if (downloadStatus === "downloading") {
    return (
      <div className="relative w-full h-full flex flex-col items-center justify-center gap-5 bg-black/50 border border-neon-cyan/10 rounded">
        <HudCorners />
        <PanelLabel>Downloading</PanelLabel>
        <div
          className="text-neon-cyan/50 text-xs tracking-[0.2em] uppercase"
          style={{ fontFamily: "var(--font-audiowide)" }}
        >
          Downloading
        </div>
        <div className="w-56 h-1.5 bg-white/5 rounded-full overflow-hidden">
          <div
            className="h-full rounded-full neon-progress transition-all duration-300"
            style={{ width: `${downloadProgress}%` }}
          />
        </div>
        <div
          className="neon-text-cyan text-2xl font-bold"
          style={{ fontFamily: "var(--font-audiowide)" }}
        >
          {Math.round(downloadProgress)}%
        </div>
      </div>
    );
  }

  if (downloadStatus === "error") {
    return (
      <div className="relative w-full h-full flex flex-col items-center justify-center gap-3 bg-black/50 border border-neon-red/20 rounded">
        <HudCorners color="neon-red" />
        <div
          className="neon-text-red text-xs tracking-[0.2em] uppercase"
          style={{ fontFamily: "var(--font-audiowide)" }}
        >
          Error
        </div>
        <p className="text-neon-red/50 text-xs max-w-xs text-center">
          {downloadError || "Unknown error"}
        </p>
      </div>
    );
  }

  if (extractionStatus === "extracting") {
    return (
      <div className="relative w-full h-full flex flex-col items-center justify-center gap-5 bg-black/50 border border-neon-violet/15 rounded">
        <HudCorners color="neon-violet" />
        <PanelLabel>Analyzing</PanelLabel>
        <div
          className="neon-text-violet text-xs tracking-[0.2em] uppercase"
          style={{ fontFamily: "var(--font-audiowide)" }}
        >
          Analyzing Moves
        </div>
        <div className="w-56 h-1.5 bg-white/5 rounded-full overflow-hidden">
          <div
            className="h-full rounded-full transition-all duration-300"
            style={{
              width: `${extractionProgress}%`,
              background: "linear-gradient(90deg, #b829ff, #ff00aa)",
              boxShadow: "0 0 10px rgba(184, 41, 255, 0.4)",
            }}
          />
        </div>
        <div
          className="neon-text-violet text-2xl font-bold"
          style={{ fontFamily: "var(--font-audiowide)" }}
        >
          {Math.round(extractionProgress)}%
        </div>
      </div>
    );
  }

  return (
    <div className="relative w-full h-full rounded overflow-hidden border border-neon-cyan/15 bg-black glow-cyan">
      <HudCorners />
      <PanelLabel>Reference</PanelLabel>
      <video
        ref={videoRef}
        src={`/api/video/${videoId}`}
        controls
        autoPlay
        className="absolute inset-0 w-full h-full object-contain"
      />
    </div>
  );
});

export default YoutubePanel;
