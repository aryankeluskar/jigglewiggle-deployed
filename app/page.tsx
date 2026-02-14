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

  // Score aura class
  const getAuraClass = () => {
    if (score >= 90) return "score-aura score-aura-perfect";
    if (score >= 80) return "score-aura score-aura-high";
    if (score >= 50) return "score-aura score-aura-mid";
    if (score > 0) return "score-aura score-aura-low";
    return "score-aura score-aura-idle";
  };

  // Camera wrapper reactive glow
  const getCameraGlow = () => {
    if (score >= 80) return "rounded animate-camera-green";
    if (score >= 50) return "rounded animate-camera-yellow";
    return "rounded";
  };

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

    const summary = buildPoseSummary(landmarks, frame);
    getCoachMessage(summary).then((result) => {
      if (result) {
        setCoachMsg(result.message);
        if (result.audio) speak(result.audio);
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
    <div
      className="h-screen overflow-hidden arena text-white flex flex-col"
      style={{ fontFamily: "var(--font-chakra-petch, system-ui)" }}
    >
      {/* Floating ambient light orbs */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none z-0">
        <div className="orb orb-1" />
        <div className="orb orb-2" />
        <div className="orb orb-3" />
      </div>

      {/* Score-reactive screen-edge aura */}
      <div className={getAuraClass()} />


      {/* Header — Neon Marquee */}
      <header className="flex-shrink-0 px-6 py-3 flex items-center justify-between relative z-10">
        <div className="flex items-center gap-4">
          <h1
            className="text-xl tracking-[0.2em] uppercase neon-title animate-flicker"
            style={{ fontFamily: "var(--font-audiowide)" }}
          >
            Jiggle Wiggle
          </h1>
          <div className="h-5 w-px bg-neon-cyan/20" />
          <span
            className="text-[9px] tracking-[0.35em] uppercase neon-text-cyan opacity-40"
            style={{ fontFamily: "var(--font-audiowide)" }}
          >
            Dance Arena
          </span>
        </div>

        <div className="flex-1 max-w-xl mx-8">
          <UrlInput onSubmit={handleUrl} />
        </div>

        <div
          className="text-[9px] tracking-[0.2em] uppercase px-3 py-1.5 border border-neon-cyan/20 neon-text-cyan opacity-50"
          style={{ fontFamily: "var(--font-audiowide)" }}
        >
          TreeHacks &apos;26
        </div>
      </header>

      {/* Neon Divider */}
      <div className="flex-shrink-0 neon-divider relative z-10" />

      {/* Main Split Screen */}
      <main className="flex-1 flex gap-3 p-3 min-h-0 relative z-10">
        {/* Left — Reference Video */}
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

        {/* Right — Live Camera with score-reactive glow */}
        <div className={`flex-1 min-w-0 transition-all duration-700 ${getCameraGlow()}`}>
          <CameraPanel onPose={handlePose} />
        </div>
      </main>

      {/* Move Queue Strip */}
      {poseTimeline && poseTimeline.length > 0 && (
        <div className="flex-shrink-0 px-3 relative z-10">
          <MoveQueue
            timeline={poseTimeline}
            currentTime={currentVideoTime}
            livePoseRef={livePoseRef}
            onSeek={(time: number) => youtubePanelRef.current?.seekTo(time)}
          />
        </div>
      )}

      {/* Coach Panel */}
      <footer className="flex-shrink-0 px-3 pb-3 relative z-10">
        <CoachPanel score={score} message={coachMsg} />
      </footer>
    </div>
  );
}
