"use client";

import { useState, useCallback, useRef, useEffect } from "react";
import UrlInput from "./components/UrlInput";
import YoutubePanel from "./components/YoutubePanel";
import type { YoutubePanelHandle } from "./components/YoutubePanel";
import CameraPanel from "./components/CameraPanel";
import CoachPanel from "./components/CoachPanel";
import MoveQueue from "./components/MoveQueue";
import { extractVideoId } from "./lib/youtube";
import { extractStripPoses } from "./lib/videoPoseExtractor";
import type { StripPoseTimeline } from "./lib/videoPoseExtractor";
import { computeScore, buildPoseSummary } from "./lib/scoring";
import { getCoachMessage } from "./lib/coach";
import { speak } from "./lib/speech";
import type { NormalizedLandmark } from "./lib/pose";

type DownloadStatus = "idle" | "downloading" | "done" | "error";
type ExtractionStatus = "idle" | "extracting" | "done";

const STRIP_POSE_CACHE_VERSION = 3;
const STRIP_POSE_INTERVAL_SECONDS = 2;

function stripPoseCacheKey(videoId: string) {
  return `stripPoses:v${STRIP_POSE_CACHE_VERSION}:${videoId}:i${STRIP_POSE_INTERVAL_SECONDS}`;
}

function readStripPoseCache(videoId: string): StripPoseTimeline | null {
  try {
    const raw = localStorage.getItem(stripPoseCacheKey(videoId));
    if (!raw) return null;
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return null;
    return parsed as StripPoseTimeline;
  } catch {
    return null;
  }
}

function writeStripPoseCache(videoId: string, timeline: StripPoseTimeline) {
  try {
    localStorage.setItem(stripPoseCacheKey(videoId), JSON.stringify(timeline));
  } catch {
    // ignore quota / storage errors
  }
}

export default function Home() {
  const [videoId, setVideoId] = useState<string | null>(null);
  const [downloadStatus, setDownloadStatus] = useState<DownloadStatus>("idle");
  const [downloadProgress, setDownloadProgress] = useState(0);
  const [downloadError, setDownloadError] = useState<string | null>(null);
  const [extractionStatus, setExtractionStatus] = useState<ExtractionStatus>("idle");
  const [extractionProgress, setExtractionProgress] = useState(0);
  const [poseTimeline, setPoseTimeline] = useState<StripPoseTimeline | null>(null);
  const [currentVideoTime, setCurrentVideoTime] = useState(0);
  const [score, setScore] = useState(0);
  const [coachMsg, setCoachMsg] = useState("");

  const youtubePanelRef = useRef<YoutubePanelHandle>(null);
  const livePoseRef = useRef<NormalizedLandmark[] | null>(null);
  const stripPoseCacheRef = useRef<Map<string, StripPoseTimeline>>(new Map());

  const handleUrl = useCallback(async (url: string) => {
    const id = extractVideoId(url);
    if (!id) {
      alert("Could not extract a YouTube video ID from that URL.");
      return;
    }

    if (id === videoId && downloadStatus === "done") {
      return;
    }

    if (id !== videoId) {
      setPoseTimeline(null);
      setExtractionStatus("idle");
      setExtractionProgress(0);
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
  }, [videoId, downloadStatus]);

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

    const cached =
      stripPoseCacheRef.current.get(videoId) ?? readStripPoseCache(videoId);
    if (cached && cached.length > 0) {
      stripPoseCacheRef.current.set(videoId, cached);
      setPoseTimeline(cached);
      setExtractionStatus("done");
      setExtractionProgress(100);
      return;
    }

    setExtractionStatus("extracting");
    setExtractionProgress(0);

    extractStripPoses(
      `/api/video/${videoId}`,
      (pct) => setExtractionProgress(pct),
      STRIP_POSE_INTERVAL_SECONDS
    )
      .then((timeline) => {
        setPoseTimeline(timeline);
        setExtractionStatus("done");
        stripPoseCacheRef.current.set(videoId, timeline);
        writeStripPoseCache(videoId, timeline);
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
    livePoseRef.current = landmarks;

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
    <div className="h-screen overflow-hidden bg-gradient-to-br from-gray-950 via-gray-900 to-black text-white flex flex-col">
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
          <MoveQueue
            timeline={poseTimeline}
            currentTime={currentVideoTime}
            livePoseRef={livePoseRef}
            onSeek={(time: number) => youtubePanelRef.current?.seekTo(time)}
          />
        </div>
      )}

      {/* Bottom — Coach panel */}
      <footer className="flex-shrink-0 px-4 pb-4">
        <CoachPanel score={score} message={coachMsg} />
      </footer>
    </div>
  );
}
