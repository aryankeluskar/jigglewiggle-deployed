"use client";

import { useState, useCallback, useRef, useEffect } from "react";
import UrlInput from "./components/UrlInput";
import YoutubePanel from "./components/YoutubePanel";
import CameraPanel from "./components/CameraPanel";
import CoachPanel from "./components/CoachPanel";
import { extractVideoId } from "./lib/youtube";
import { computeScore, buildPoseSummary } from "./lib/scoring";
import { getCoachMessage } from "./lib/coach";
import { speak } from "./lib/speech";
import type { NormalizedLandmark } from "./lib/pose";

export default function Home() {
  const [videoId, setVideoId] = useState<string | null>(null);
  const [score, setScore] = useState(0);
  const [coachMsg, setCoachMsg] = useState("");

  // Read ?url= query param on mount (for Chrome extension)
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const urlParam = params.get("url");
    if (urlParam) {
      const id = extractVideoId(urlParam);
      if (id) setVideoId(id);
    }
  }, []);

  const handleUrl = (url: string) => {
    const id = extractVideoId(url);
    if (id) {
      setVideoId(id);
    } else {
      alert("Could not extract a YouTube video ID from that URL.");
    }
  };

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
        <div className="flex-1 min-w-0">
          <YoutubePanel videoId={videoId} />
        </div>

        {/* Right — Camera */}
        <div className="flex-1 min-w-0">
          <CameraPanel onPose={handlePose} />
        </div>
      </main>

      {/* Bottom — Coach panel */}
      <footer className="flex-shrink-0 px-4 pb-4">
        <CoachPanel score={score} message={coachMsg} />
      </footer>
    </div>
  );
}
