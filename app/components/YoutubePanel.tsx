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
      <div className="w-full h-full flex items-center justify-center bg-black/40 rounded-2xl border border-white/10">
        <p className="text-white/40 text-sm">
          Paste a YouTube URL above to get started
        </p>
      </div>
    );
  }

  if (downloadStatus === "downloading") {
    return (
      <div className="w-full h-full flex flex-col items-center justify-center gap-4 bg-black/40 rounded-2xl border border-white/10">
        <div className="text-white/60 text-sm">Downloading video…</div>
        <div className="w-64 h-2 bg-white/10 rounded-full overflow-hidden">
          <div
            className="h-full rounded-full bg-gradient-to-r from-pink-500 to-violet-500 transition-all duration-300"
            style={{ width: `${downloadProgress}%` }}
          />
        </div>
        <div className="text-white/40 text-xs">
          {Math.round(downloadProgress)}%
        </div>
      </div>
    );
  }

  if (downloadStatus === "error") {
    return (
      <div className="w-full h-full flex flex-col items-center justify-center gap-2 bg-black/40 rounded-2xl border border-red-500/30">
        <p className="text-red-400 text-sm">Download failed</p>
        <p className="text-white/40 text-xs max-w-xs text-center">
          {downloadError || "Unknown error"}
        </p>
      </div>
    );
  }

  if (extractionStatus === "extracting") {
    return (
      <div className="w-full h-full flex flex-col items-center justify-center gap-4 bg-black/40 rounded-2xl border border-white/10">
        <div className="text-white/60 text-sm">Analyzing dance moves…</div>
        <div className="w-64 h-2 bg-white/10 rounded-full overflow-hidden">
          <div
            className="h-full rounded-full bg-gradient-to-r from-violet-500 to-cyan-500 transition-all duration-300"
            style={{ width: `${extractionProgress}%` }}
          />
        </div>
        <div className="text-white/40 text-xs">
          {Math.round(extractionProgress)}%
        </div>
      </div>
    );
  }

  return (
    <div className="relative w-full h-full rounded-2xl overflow-hidden border border-white/10 bg-black">
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
