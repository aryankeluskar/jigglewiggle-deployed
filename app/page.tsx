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
import { computeGymScore, buildGymPoseSummary, resetGymScoring } from "./lib/gymScoring";
import { getCoachMessage } from "./lib/coach";
import type { AppMode } from "./shared/mode";
import { findClosestFrame, comparePosesDetailed } from "./lib/poseComparison";
import type { DetailedComparison } from "./lib/poseComparison";
import { speak } from "./lib/speech";
import { segmentVideo, isSegmentationAvailable } from "./lib/segmentation";
import { startGroqScoring, resetGroqScoring } from "./lib/groqScoring";
import { processGestureLandmarks, resetGestureState } from "./lib/gestureControl";
import type { GestureAction } from "./lib/gestureControl";
import { GestureToast, GestureProgressBar } from "./components/GestureToast";
import GestureGuide from "./components/GestureGuide";
import type { NormalizedLandmark } from "./lib/pose";
import {
  startRecording,
  stopRecording,
  recordFrame,
  isRecording,
  downloadRecording,
  loadRecording,
} from "./lib/poseRecorder";
import type { PoseRecording } from "./lib/poseRecorder";
import {
  startReplay,
  pauseReplay,
  resumeReplay,
  stopReplay,
} from "./lib/poseReplay";
import { resetCoach } from "./lib/coach";
import { resetScoring } from "./lib/scoring";
import RecordReplayPanel from "./components/RecordReplayPanel";
import ModeOverlay from "./components/ModeOverlay";

type DownloadStatus = "idle" | "downloading" | "done" | "error";
type ExtractionStatus = "idle" | "extracting" | "done";
type SegmentationStatus = "idle" | "segmenting" | "done" | "error" | "unavailable";
type ClassificationStatus = "idle" | "pending" | "done";

const STRIP_POSE_CACHE_VERSION = 4;
const STRIP_POSE_INTERVAL_SECONDS = 2;

// Scoring blend constants
const SCORE_EMA_ALPHA = 0.15;
const MAX_REF_DISTANCE_SEC = 3.0;
const SCORE_DEAD_ZONE = 2;

const LIMB_LABELS: Record<string, string> = {
  rightArm: "Right arm",
  leftArm: "Left arm",
  rightLeg: "Right leg",
  leftLeg: "Left leg",
  torso: "Torso",
};

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
  const [segmentationStatus, setSegmentationStatus] = useState<SegmentationStatus>("idle");
  const [segmentationProgress, setSegmentationProgress] = useState(0);
  const [segmentedVideoUrl, setSegmentedVideoUrl] = useState<string | null>(null);
  const [playbackRate, setPlaybackRate] = useState(1);
  const [isVideoPaused, setIsVideoPaused] = useState(false);
  const [referenceVideoAspectRatio, setReferenceVideoAspectRatio] = useState(16/9);
  const [groqFeedback, setGroqFeedback] = useState("");
  const [gestureToast, setGestureToast] = useState<GestureAction | null>(null);
  const [gestureToastSeq, setGestureToastSeq] = useState(0);
  const [gestureProgress, setGestureProgress] = useState(0);
  const [gesturePending, setGesturePending] = useState<GestureAction | null>(null);
  const [replayActive, setReplayActive] = useState(false);
  const [replayPaused, setReplayPaused] = useState(false);
  const [replayProgress, setReplayProgress] = useState(0);
  const [mode, setMode] = useState<AppMode>("dance");
  const [classificationStatus, setClassificationStatus] = useState<ClassificationStatus>("idle");
  const [modeOverlaySeq, setModeOverlaySeq] = useState(0);

  const youtubePanelRef = useRef<YoutubePanelHandle>(null);
  const webcamCaptureRef = useRef<(() => string | null) | null>(null);
  const livePoseRef = useRef<NormalizedLandmark[] | null>(null);
  const stripPoseCacheRef = useRef<Map<string, StripPoseTimeline>>(new Map());
  const segmentationStartedRef = useRef(false);
  const smoothedScoreRef = useRef(0);
  const groqAnchorRef = useRef<number | null>(null);
  const replayModeRef = useRef(false);
  const replayVideoTimeRef = useRef<number | null>(null);
  const loadedRecordingRef = useRef<PoseRecording | null>(null);

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
      setSegmentationStatus("idle");
      setSegmentationProgress(0);
      setSegmentedVideoUrl(null);
      segmentationStartedRef.current = false;
      groqAnchorRef.current = null;
      smoothedScoreRef.current = 0;
      setGroqFeedback("");
      resetGroqScoring();
      resetGestureState();
      setMode("dance");
      setClassificationStatus("idle");
      resetGymScoring();
    }

    setVideoId(id);
    setDownloadStatus("downloading");
    setClassificationStatus("pending");
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
            } else if (event.type === "classified") {
              setMode(event.mode === "gym" ? "gym" : "dance");
              setClassificationStatus("done");
              setModeOverlaySeq(s => s + 1);
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

  // Safety timeout: if classification hasn't resolved 8s after download, default to dance
  useEffect(() => {
    if (downloadStatus !== "done" || classificationStatus !== "pending") return;
    const timer = setTimeout(() => {
      setClassificationStatus("done");
      setModeOverlaySeq(s => s + 1);
    }, 8000);
    return () => clearTimeout(timer);
  }, [downloadStatus, classificationStatus]);

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

  // Kick off segmentation after download completes (parallel with pose extraction)
  // Uses a ref guard instead of segmentationStatus in deps to avoid the effect
  // re-running (and cancelling itself) when we set segmentationStatus to "segmenting".
  useEffect(() => {
    if (downloadStatus !== "done" || !videoId || segmentationStartedRef.current) return;
    segmentationStartedRef.current = true;

    let cancelled = false;

    (async () => {
      const available = await isSegmentationAvailable();
      if (cancelled) return;

      if (!available) {
        setSegmentationStatus("unavailable");
        return;
      }

      setSegmentationStatus("segmenting");
      setSegmentationProgress(0);

      try {
        const url = await segmentVideo(videoId, (_status, progress) => {
          if (!cancelled && progress !== undefined) {
            setSegmentationProgress(progress);
          }
        });

        if (!cancelled) {
          setSegmentedVideoUrl(url);
          setSegmentationStatus("done");
        }
      } catch (err) {
        console.error("Segmentation failed:", err);
        if (!cancelled) {
          setSegmentationStatus("error");
        }
      }
    })();

    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [downloadStatus, videoId]);

  // Video is ready when both extraction and segmentation are resolved
  const segmentationReady =
    segmentationStatus === "done" ||
    segmentationStatus === "error" ||
    segmentationStatus === "unavailable";

  // Poll video currentTime, paused state, and aspect ratio via rAF loop (video only mounts when ready)
  useEffect(() => {
    if (extractionStatus !== "done" || !poseTimeline || !segmentationReady) return;

    let raf: number;
    const tick = () => {
      const t = youtubePanelRef.current?.getCurrentTime() ?? 0;
      const paused = youtubePanelRef.current?.isPaused() ?? false;
      const aspectRatio = youtubePanelRef.current?.getVideoAspectRatio() ?? 16/9;
      setCurrentVideoTime(t);
      setIsVideoPaused(paused);
      setReferenceVideoAspectRatio(aspectRatio);
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [extractionStatus, poseTimeline, segmentationReady]);

  // Start Groq vision scoring when video is ready
  useEffect(() => {
    if (extractionStatus !== "done" || !poseTimeline || !segmentationReady) return;
    if (replayActive) return;

    const cleanup = startGroqScoring(
      () => youtubePanelRef.current?.captureFrame() ?? null,
      () => webcamCaptureRef.current?.() ?? null,
      (result) => {
        groqAnchorRef.current = result.smoothedScore;
        setGroqFeedback(result.feedback);
      },
      3000
    );

    return () => {
      cleanup();
      groqAnchorRef.current = null;
    };
  }, [extractionStatus, poseTimeline, segmentationReady, replayActive]);

  // Stable callback ref to avoid re-mounting CameraPanel
  const onPoseRef = useRef<(landmarks: NormalizedLandmark[] | null) => void>(null);
  onPoseRef.current = (landmarks: NormalizedLandmark[] | null) => {
    livePoseRef.current = landmarks;

    // Recording hook
    if (isRecording()) recordFrame(landmarks!, currentVideoTime);

    // Gesture detection (skip during replay to prevent spurious video seeks)
    const gesture = replayModeRef.current
      ? { lastAction: null as GestureAction | null, pending: null as GestureAction | null, progress: 0 }
      : processGestureLandmarks(landmarks);
    setGestureProgress(gesture.progress);
    setGesturePending(gesture.pending);
    if (gesture.lastAction) {
      setGestureToast(gesture.lastAction);
      setGestureToastSeq((s) => s + 1);
      const panel = youtubePanelRef.current;
      if (panel) {
        switch (gesture.lastAction) {
          case "play_pause":
            panel.togglePlayPause();
            break;
          case "skip_forward":
            panel.seekTo(panel.getCurrentTime() + 5);
            break;
          case "skip_backward":
            panel.seekTo(Math.max(0, panel.getCurrentTime() - 5));
            break;
          case "restart":
            panel.seekTo(0);
            break;
        }
      }
    }

    // 1. Heuristic score (mode-aware — feeds body metrics for coach summary)
    const frame = mode === "gym" ? computeGymScore(landmarks) : computeScore(landmarks);
    const issues = [...frame.issues];

    // 2. Geometric reference comparison (every frame, when timeline available)
    const effectiveVideoTime = replayVideoTimeRef.current ?? currentVideoTime;
    let detailed: DetailedComparison | null = null;
    if (poseTimeline && landmarks && landmarks.length >= 33) {
      const refFrame = findClosestFrame(poseTimeline, effectiveVideoTime);
      if (refFrame && Math.abs(refFrame.time - effectiveVideoTime) <= MAX_REF_DISTANCE_SEC) {
        detailed = comparePosesDetailed(refFrame.landmarks, landmarks);
      }
    }

    // 3. Blend scores
    let finalScore: number;
    if (detailed) {
      const geoScore = detailed.matchScore;
      const groqAnchor = replayModeRef.current ? null : groqAnchorRef.current;
      if (groqAnchor !== null) {
        finalScore = Math.round(0.5 * geoScore + 0.4 * groqAnchor + 0.1 * frame.score);
      } else {
        finalScore = Math.round(0.8 * geoScore + 0.2 * frame.score);
      }
      finalScore = Math.max(0, Math.min(100, finalScore));

      // Add worst-limb feedback
      if (detailed.limbScores[detailed.worstLimb] < 60) {
        const label = LIMB_LABELS[detailed.worstLimb] ?? detailed.worstLimb;
        issues.unshift(`${label} off from reference`);
      }
    } else {
      // No reference available — use heuristic only
      finalScore = frame.score;
    }

    // 4. EMA smoothing + dead zone to suppress jitter
    const smoothed = smoothedScoreRef.current * (1 - SCORE_EMA_ALPHA) + finalScore * SCORE_EMA_ALPHA;
    smoothedScoreRef.current = smoothed;
    const rounded = Math.round(smoothed);
    if (Math.abs(rounded - score) >= SCORE_DEAD_ZONE) {
      setScore(rounded);
    }

    // 5. Build summary for LLM coach (mode-aware)
    const blendedFrame = { ...frame, score: Math.round(smoothed), issues };
    const summary = mode === "gym"
      ? buildGymPoseSummary(landmarks, blendedFrame)
      : buildPoseSummary(landmarks, blendedFrame);
    if (detailed) {
      summary.reference = detailed;
    }

    if (!replayModeRef.current) {
      getCoachMessage(summary, mode).then((result) => {
        if (result) {
          setCoachMsg(result.message);
          if (result.audio) speak(result.audio);
        }
      });
    }
  };

  const handlePose = useCallback(
    (landmarks: NormalizedLandmark[] | null) => {
      onPoseRef.current?.(landmarks);
    },
    []
  );

  // --- Record / Replay handlers ---
  const handleStartRecord = () => {
    if (videoId) startRecording(videoId);
  };

  const handleStopRecord = () => {
    const rec = stopRecording();
    downloadRecording(rec);
  };

  const handleLoadRecording = async (file: File) => {
    const rec = await loadRecording(file);
    loadedRecordingRef.current = rec;
  };

  const handleStartReplay = () => {
    const rec = loadedRecordingRef.current;
    if (!rec) return;

    // Reset scoring / coach / gesture state for a clean run
    smoothedScoreRef.current = 0;
    setScore(0);
    resetScoring();
    resetGymScoring();
    resetCoach();
    resetGestureState();
    groqAnchorRef.current = null;
    setGroqFeedback("");

    replayModeRef.current = true;
    setReplayActive(true);
    setReplayPaused(false);
    setReplayProgress(0);

    startReplay({
      recording: rec,
      onFrame: (landmarks, videoTime) => {
        replayVideoTimeRef.current = videoTime;
        onPoseRef.current?.(landmarks);
      },
      seekVideo: (time) => {
        youtubePanelRef.current?.seekTo(time);
      },
      onComplete: () => {
        replayModeRef.current = false;
        replayVideoTimeRef.current = null;
        setReplayActive(false);
        setReplayPaused(false);
        setReplayProgress(100);
      },
      onProgress: (frameIndex, totalFrames) => {
        setReplayProgress(totalFrames > 0 ? (frameIndex / totalFrames) * 100 : 0);
      },
    });
  };

  const handlePauseReplay = () => {
    pauseReplay();
    setReplayPaused(true);
  };

  const handleResumeReplay = () => {
    resumeReplay();
    setReplayPaused(false);
  };

  const handleStopReplay = () => {
    stopReplay();
    replayModeRef.current = false;
    replayVideoTimeRef.current = null;
    setReplayActive(false);
    setReplayPaused(false);
  };

  return (
    <div
      data-mode={mode}
      className={`h-screen overflow-hidden ${mode === "gym" ? "gym-arena" : "arena"} text-white flex flex-col`}
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

      {/* Gesture action toast */}
      <GestureToast action={gestureToast} seq={gestureToastSeq} />

      {/* Header — Neon Marquee */}
      <header className="flex-shrink-0 px-6 py-3 flex items-center justify-between relative z-20">
        <div className="flex items-center gap-4">
          <h1
            className="text-xl tracking-[0.2em] uppercase neon-title animate-flicker"
            style={{ fontFamily: "var(--font-audiowide)" }}
          >
            {mode === "gym" ? "Iron Form" : "Jiggle Wiggle"}
          </h1>
          <div className="h-5 w-px bg-neon-cyan/20" />
          <span
            className="text-[9px] tracking-[0.35em] uppercase neon-text-cyan opacity-40"
            style={{ fontFamily: "var(--font-audiowide)" }}
          >
            {mode === "gym" ? "Gym Arena" : "Dance Arena"}
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

      {/* Mode activation overlay */}
      <ModeOverlay mode={mode} seq={modeOverlaySeq} />

      {/* Classification pending — "Detecting mode..." indicator */}
      {downloadStatus === "done" && classificationStatus === "pending" && (
        <main className="flex-1 flex items-center justify-center min-h-0 relative z-10">
          <div className="flex flex-col items-center gap-4">
            <div
              className="text-lg tracking-[0.3em] uppercase neon-text-cyan animate-glow-pulse"
              style={{ fontFamily: "var(--font-audiowide)" }}
            >
              Detecting mode...
            </div>
            <div className="w-48 h-1 rounded-full overflow-hidden bg-black/40 border border-neon-cyan/10">
              <div className="h-full neon-progress" style={{ width: "60%" }} />
            </div>
          </div>
        </main>
      )}

      {/* Main Split Screen — only when classification resolved or still downloading */}
      {(classificationStatus === "done" || downloadStatus !== "done") && (
        <>
          <main className="flex-1 flex gap-3 p-3 min-h-0 relative z-10">
            {/* Left — Reference Video */}
            <div className="flex-1 min-w-0 min-h-0 flex flex-col gap-2">
              <YoutubePanel
                ref={youtubePanelRef}
                videoId={videoId}
                downloadStatus={downloadStatus}
                downloadProgress={downloadProgress}
                downloadError={downloadError}
                extractionStatus={extractionStatus}
                extractionProgress={extractionProgress}
                segmentationStatus={segmentationStatus}
                segmentationProgress={segmentationProgress}
              />

              {/* Playback Speed Slider */}
              {downloadStatus === "done" && (
                <div className="flex items-center gap-3 px-3 py-2 bg-black/30 border border-neon-cyan/10 rounded">
                  <label
                    className="text-[10px] tracking-[0.2em] uppercase text-neon-cyan/50"
                    style={{ fontFamily: "var(--font-audiowide)" }}
                  >
                    Speed
                  </label>
                  <input
                    type="range"
                    min="0.25"
                    max="2"
                    step="0.25"
                    value={playbackRate}
                    onChange={(e) => {
                      const rate = parseFloat(e.target.value);
                      setPlaybackRate(rate);
                      youtubePanelRef.current?.setPlaybackRate(rate);
                    }}
                    className="flex-1 h-1 bg-black/50 rounded appearance-none cursor-pointer"
                    style={{
                      accentColor: "#00ffff",
                    }}
                  />
                  <span
                    className="text-[11px] text-neon-cyan/70 font-mono min-w-[40px] text-right"
                    style={{ fontFamily: "var(--font-audiowide)" }}
                  >
                    {playbackRate.toFixed(2)}x
                  </span>
                </div>
              )}
            </div>

            {/* Right — Live Camera with score-reactive glow */}
            <div className={`flex-1 min-w-0 relative transition-all duration-700 ${getCameraGlow()}`}>
              <GestureProgressBar progress={gestureProgress} pending={gesturePending} />
              <CameraPanel
                onPose={handlePose}
                segmentedVideoUrl={segmentedVideoUrl}
                referenceVideoTime={currentVideoTime}
                playbackRate={playbackRate}
                isReferencePaused={isVideoPaused}
                referenceVideoAspectRatio={referenceVideoAspectRatio}
                webcamCaptureRef={webcamCaptureRef}
              />
              <GestureGuide />
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
                playbackRate={playbackRate}
              />
            </div>
          )}

          {/* Coach Panel */}
          <footer className="flex-shrink-0 px-3 pb-3 relative z-10">
            <CoachPanel score={score} message={coachMsg} showScore={poseTimeline !== null} mode={mode} />
          </footer>

          {/* Record / Replay toolbar */}
          <RecordReplayPanel
            videoId={videoId}
            poseTimeline={poseTimeline}
            isReplaying={replayActive}
            isPaused={replayPaused}
            replayProgress={replayProgress}
            onStartRecord={handleStartRecord}
            onStopRecord={handleStopRecord}
            onLoadRecording={handleLoadRecording}
            onStartReplay={handleStartReplay}
            onPauseReplay={handlePauseReplay}
            onResumeReplay={handleResumeReplay}
            onStopReplay={handleStopReplay}
          />
        </>
      )}
    </div>
  );
}
