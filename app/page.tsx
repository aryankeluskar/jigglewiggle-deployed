"use client";

import { useState, useCallback, useRef, useEffect } from "react";
import UrlInput from "./components/UrlInput";
import YoutubePanel from "./components/YoutubePanel";
import type { YoutubePanelHandle } from "./components/YoutubePanel";
import CameraPanel from "./components/CameraPanel";
import CoachPanel from "./components/CoachPanel";
import MoveQueue from "./components/MoveQueue";
import { extractVideoId } from "./lib/youtube";
import { extractPoses } from "./lib/videoPoseExtractor";
import type { PoseTimeline } from "./lib/videoPoseExtractor";
import { computeScore, buildPoseSummary } from "./lib/scoring";
import { getCoachMessage } from "./lib/coach";
import { speak } from "./lib/speech";
import type { NormalizedLandmark } from "./lib/pose";

type DownloadStatus = "idle" | "downloading" | "done" | "error";
type ExtractionStatus = "idle" | "extracting" | "done";

export default function Home() {
  const [videoId, setVideoId] = useState<string | null>(null);
  const [downloadStatus, setDownloadStatus] = useState<DownloadStatus>("idle");
  const [downloadProgress, setDownloadProgress] = useState(0);
  const [downloadError, setDownloadError] = useState<string | null>(null);
  const [extractionStatus, setExtractionStatus] = useState<ExtractionStatus>("idle");
  const [extractionProgress, setExtractionProgress] = useState(0);
  const [poseTimeline, setPoseTimeline] = useState<PoseTimeline | null>(null);
  const [currentVideoTime, setCurrentVideoTime] = useState(0);
  const [score, setScore] = useState(0);
  const [coachMsg, setCoachMsg] = useState("");

  const youtubePanelRef = useRef<YoutubePanelHandle>(null);

  const handleUrl = useCallback(async (url: string) => {
    const id = extractVideoId(url);
    if (!id) {
      alert("Could not extract a YouTube video ID from that URL.");
      return;
    }

    setVideoId(id);
    setDownloadStatus("downloading");
    setDownloadProgress(0);
    setDownloadError(null);

    try {
      const res = await fetch("/api/download", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ videoId: id }),
      });

      if (!res.ok || !res.body) {
        setDownloadStatus("error");
        setDownloadError(`Server responded with ${res.status}`);
        return;
      }

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buf = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buf += decoder.decode(value, { stream: true });
        const lines = buf.split("\n\n");
        buf = lines.pop() || "";

        for (const line of lines) {
          const dataLine = line.replace(/^data: /, "");
          if (!dataLine) continue;

          try {
            const event = JSON.parse(dataLine);
            if (event.type === "progress") {
              setDownloadProgress(event.percent);
            } else if (event.type === "done") {
              setDownloadStatus("done");
            } else if (event.type === "error") {
              setDownloadStatus("error");
              setDownloadError(event.message);
            }
          } catch {
            // ignore malformed SSE lines
          }
        }
      }
    } catch (err) {
      setDownloadStatus("error");
      setDownloadError(err instanceof Error ? err.message : "Network error");
    }
  }, []);

  // Read ?url= query param on mount (for Chrome extension)
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const urlParam = params.get("url");
    if (urlParam) {
      handleUrl(urlParam);
    }
  }, [handleUrl]);

  // Kick off pose extraction after download completes
  useEffect(() => {
    if (downloadStatus !== "done" || !videoId || extractionStatus !== "idle") return;

    setExtractionStatus("extracting");
    setExtractionProgress(0);

    extractPoses(`/api/video/${videoId}`, (pct) => {
      setExtractionProgress(pct);
    })
      .then((timeline) => {
        setPoseTimeline(timeline);
        setExtractionStatus("done");
      })
      .catch(() => {
        // Extraction failed — still allow video playback, just no move queue
        setExtractionStatus("done");
      });
  }, [downloadStatus, videoId, extractionStatus]);

  // Poll video currentTime via rAF loop
  useEffect(() => {
    if (extractionStatus !== "done" || !poseTimeline) return;

    let raf: number;
    const tick = () => {
      const t = youtubePanelRef.current?.getCurrentTime() ?? 0;
      setCurrentVideoTime(t);
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [extractionStatus, poseTimeline]);

  // Stable callback ref to avoid re-mounting CameraPanel
  const onPoseRef = useRef<(landmarks: NormalizedLandmark[] | null) => void>(null);
  onPoseRef.current = (landmarks: NormalizedLandmark[] | null) => {
    const frame = computeScore(landmarks);
    setScore(frame.score);

    // Build the rich summary and send it to the LLM coach (async, fire-and-forget)
    const summary = buildPoseSummary(landmarks, frame);
    getCoachMessage(summary).then((msg) => {
      if (msg) {
        setCoachMsg(msg);
        speak(msg);
      }
    });
  };

  const handlePose = useCallback(
    (landmarks: NormalizedLandmark[] | null) => {
      onPoseRef.current?.(landmarks);
    },
    []
  );

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-950 via-gray-900 to-black text-white flex flex-col">
      {/* Header */}
      <header className="flex-shrink-0 px-6 py-4 flex items-center justify-between border-b border-white/5">
        <h1 className="text-xl font-bold tracking-tight">
          <span className="bg-gradient-to-r from-pink-500 to-violet-500 bg-clip-text text-transparent">
            Steal This Move
          </span>
        </h1>
        <div className="flex-1 max-w-xl mx-8">
          <UrlInput onSubmit={handleUrl} />
        </div>
        <div className="text-xs text-white/30">TreeHacks 2026</div>
      </header>

      {/* Main split screen */}
      <main className="flex-1 flex gap-4 p-4 min-h-0">
        {/* Left — YouTube */}
        <div className="flex-1 min-w-0 min-h-0">
          <YoutubePanel
            ref={youtubePanelRef}
            videoId={videoId}
            downloadStatus={downloadStatus}
            downloadProgress={downloadProgress}
            downloadError={downloadError}
            extractionStatus={extractionStatus}
            extractionProgress={extractionProgress}
          />
        </div>

        {/* Right — Camera */}
        <div className="flex-1 min-w-0">
          <CameraPanel onPose={handlePose} />
        </div>
      </main>

      {/* Move queue strip */}
      {poseTimeline && poseTimeline.length > 0 && (
        <div className="flex-shrink-0 px-4">
          <MoveQueue timeline={poseTimeline} currentTime={currentVideoTime} />
        </div>
      )}

      {/* Bottom — Coach panel */}
      <footer className="flex-shrink-0 px-4 pb-4">
        <CoachPanel score={score} message={coachMsg} />
      </footer>
    </div>
  );
}
