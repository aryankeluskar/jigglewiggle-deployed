"use client";

import { useState, useCallback, useRef, useEffect } from "react";
import CameraPanel from "../shared/CameraPanel";
import CoachPanel from "../shared/CoachPanel";
import ScreenCapturePanel from "../shared/ScreenCapturePanel";
import { computeScore, buildPoseSummary } from "../shared/scoring";
import { getCoachMessage } from "../shared/coach";
import { speak } from "../shared/speech";
import type { NormalizedLandmark } from "../shared/pose";

type Mode = "choose" | "zoom-sdk" | "screen-capture";
type ZoomState = "idle" | "ready" | "joining" | "joined" | "error";

export default function ZoomApp() {
  const [mode, setMode] = useState<Mode>("choose");
  const [score, setScore] = useState(0);
  const [coachMsg, setCoachMsg] = useState("");

  // Zoom state
  const [meetingNumber, setMeetingNumber] = useState("");
  const [passcode, setPasscode] = useState("");
  const [userName, setUserName] = useState("JiggleWiggle");
  const [zoomState, setZoomState] = useState<ZoomState>("idle");
  const [zoomError, setZoomError] = useState("");
  const iframeRef = useRef<HTMLIFrameElement>(null);

  // --- Scoring from captured/remote pose ---
  const onRemotePoseRef = useRef<(landmarks: NormalizedLandmark[] | null) => void>(null);
  onRemotePoseRef.current = (landmarks: NormalizedLandmark[] | null) => {
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

  const handleRemotePose = useCallback(
    (landmarks: NormalizedLandmark[] | null) => {
      onRemotePoseRef.current?.(landmarks);
    },
    []
  );

  const handleSelfPose = useCallback(
    (_landmarks: NormalizedLandmark[] | null) => {},
    []
  );

  // Listen for messages from the Zoom iframe
  useEffect(() => {
    const handler = (event: MessageEvent) => {
      if (event.data?.type !== "zoom-status") return;
      const { state, error } = event.data;
      if (state === "ready") setZoomState("ready");
      else if (state === "joining") setZoomState("joining");
      else if (state === "joined") setZoomState("joined");
      else if (state === "error") {
        setZoomState("error");
        setZoomError(error || "Unknown error");
      }
    };
    window.addEventListener("message", handler);
    return () => window.removeEventListener("message", handler);
  }, []);

  // Join via iframe postMessage
  const joinZoomMeeting = async () => {
    if (!meetingNumber.trim()) {
      setZoomError("Enter a meeting number.");
      return;
    }

    setZoomState("joining");
    setZoomError("");

    try {
      // Get JWT signature
      const sigRes = await fetch("/api/zoom-signature", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          meetingNumber: meetingNumber.replace(/\s/g, ""),
          role: 0,
        }),
      });

      const sigData = await sigRes.json();

      if (!sigRes.ok || !sigData.signature) {
        setZoomState("error");
        setZoomError(sigData.error || "Failed to get signature. Check ZOOM_SDK_KEY/SECRET in .env.local");
        return;
      }

      // Send join command to the iframe
      iframeRef.current?.contentWindow?.postMessage({
        type: "join",
        sdkKey: process.env.NEXT_PUBLIC_ZOOM_SDK_KEY || "",
        signature: sigData.signature,
        meetingNumber: meetingNumber.replace(/\s/g, ""),
        password: passcode,
        userName: userName || "JiggleWiggle",
      }, "*");
    } catch (err) {
      setZoomState("error");
      setZoomError(err instanceof Error ? err.message : "Failed to join");
    }
  };

  // ==================== VIEWS ====================

  if (mode === "choose") {
    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-950 via-gray-900 to-black text-white flex flex-col items-center justify-center gap-8 p-8">
        <div className="text-center">
          <h1 className="text-3xl font-bold mb-2">
            <span className="bg-gradient-to-r from-pink-500 to-violet-500 bg-clip-text text-transparent">
              Jiggle Wiggle
            </span>
          </h1>
          <p className="text-white/40 text-sm">Zoom Mode — choose how to connect</p>
        </div>

        <div className="flex gap-6 max-w-2xl w-full">
          <button
            onClick={() => setMode("zoom-sdk")}
            className="flex-1 p-6 rounded-2xl bg-white/5 border border-white/10 hover:border-blue-500/50 transition-colors text-left cursor-pointer group"
          >
            <div className="text-2xl mb-3">📹</div>
            <h3 className="font-semibold text-white group-hover:text-blue-400 transition-colors mb-2">
              Join Zoom Meeting
            </h3>
            <p className="text-white/40 text-xs leading-relaxed">
              Enter a meeting ID to embed a live Zoom call. Requires ZOOM_SDK_KEY in .env.local
            </p>
          </button>

          <button
            onClick={() => setMode("screen-capture")}
            className="flex-1 p-6 rounded-2xl bg-white/5 border border-white/10 hover:border-cyan-500/50 transition-colors text-left cursor-pointer group"
          >
            <div className="text-2xl mb-3">🖥️</div>
            <h3 className="font-semibold text-white group-hover:text-cyan-400 transition-colors mb-2">
              Capture Zoom Window
            </h3>
            <p className="text-white/40 text-xs leading-relaxed">
              Share your Zoom window directly. No credentials needed — just pick the window.
            </p>
          </button>
        </div>
      </div>
    );
  }

  if (mode === "screen-capture") {
    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-950 via-gray-900 to-black text-white flex flex-col">
        <header className="flex-shrink-0 px-6 py-4 flex items-center border-b border-white/5">
          <button onClick={() => setMode("choose")} className="text-white/40 hover:text-white text-sm cursor-pointer mr-3">← Back</button>
          <h1 className="text-xl font-bold">
            <span className="bg-gradient-to-r from-pink-500 to-violet-500 bg-clip-text text-transparent">Jiggle Wiggle</span>
            <span className="text-white/30 text-sm ml-3 font-normal">Screen Capture</span>
          </h1>
        </header>
        <main className="flex-1 flex gap-4 p-4 min-h-0">
          <div className="flex-1 min-w-0"><ScreenCapturePanel onPose={handleRemotePose} /></div>
          <div className="flex-1 min-w-0"><CameraPanel onPose={handleSelfPose} badge="YOU" /></div>
        </main>
        <footer className="flex-shrink-0 px-4 pb-4"><CoachPanel score={score} message={coachMsg} /></footer>
      </div>
    );
  }

  // --- Zoom SDK mode (via iframe) ---
  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-950 via-gray-900 to-black text-white flex flex-col">
      <header className="flex-shrink-0 px-6 py-4 flex items-center justify-between border-b border-white/5">
        <div className="flex items-center gap-3">
          <button onClick={() => setMode("choose")} className="text-white/40 hover:text-white text-sm cursor-pointer">← Back</button>
          <h1 className="text-xl font-bold">
            <span className="bg-gradient-to-r from-pink-500 to-violet-500 bg-clip-text text-transparent">Jiggle Wiggle</span>
            <span className="text-white/30 text-sm ml-3 font-normal">Zoom Meeting</span>
          </h1>
        </div>
        <div className="flex items-center gap-2">
          <span className={`w-2 h-2 rounded-full ${
            zoomState === "joined" ? "bg-green-400 animate-pulse"
            : zoomState === "joining" ? "bg-yellow-400 animate-pulse"
            : zoomState === "error" ? "bg-red-400"
            : "bg-white/30"
          }`} />
          <span className="text-xs text-white/40">
            {zoomState === "idle" && "Loading SDK…"}
            {zoomState === "ready" && "Ready to join"}
            {zoomState === "joining" && "Joining…"}
            {zoomState === "joined" && "In meeting"}
            {zoomState === "error" && "Error"}
          </span>
        </div>
      </header>

      {zoomState !== "joined" && (
        <div className="flex-shrink-0 px-6 py-4 border-b border-white/5">
          <div className="flex gap-3 items-end max-w-3xl mx-auto">
            <div className="flex-1">
              <label className="text-xs text-white/40 mb-1 block">Meeting Number</label>
              <input type="text" value={meetingNumber} onChange={(e) => setMeetingNumber(e.target.value)}
                placeholder="123 456 7890"
                className="w-full px-4 py-2.5 rounded-xl bg-white/10 border border-white/20 text-white placeholder-white/30 outline-none focus:border-blue-500 text-sm" />
            </div>
            <div className="w-40">
              <label className="text-xs text-white/40 mb-1 block">Passcode</label>
              <input type="text" value={passcode} onChange={(e) => setPasscode(e.target.value)}
                placeholder="optional"
                className="w-full px-4 py-2.5 rounded-xl bg-white/10 border border-white/20 text-white placeholder-white/30 outline-none focus:border-blue-500 text-sm" />
            </div>
            <div className="w-40">
              <label className="text-xs text-white/40 mb-1 block">Your Name</label>
              <input type="text" value={userName} onChange={(e) => setUserName(e.target.value)}
                placeholder="Your name"
                className="w-full px-4 py-2.5 rounded-xl bg-white/10 border border-white/20 text-white placeholder-white/30 outline-none focus:border-blue-500 text-sm" />
            </div>
            <button onClick={joinZoomMeeting} disabled={zoomState === "joining" || zoomState === "idle"}
              className="px-6 py-2.5 rounded-xl bg-gradient-to-r from-blue-500 to-cyan-500 text-white font-semibold text-sm hover:opacity-90 transition-opacity cursor-pointer disabled:opacity-50">
              {zoomState === "joining" ? "Joining…" : "Join"}
            </button>
          </div>
          {zoomError && <p className="text-red-400 text-xs mt-2 text-center">{zoomError}</p>}
        </div>
      )}

      <main className="flex-1 flex gap-4 p-4 min-h-0">
        {/* Left — Zoom meeting in iframe (isolated React 18) */}
        <div className="flex-1 min-w-0 rounded-2xl overflow-hidden border border-white/10 bg-black">
          <iframe
            ref={iframeRef}
            src="/zoom-embed.html"
            className="w-full h-full border-0"
            allow="camera; microphone; display-capture; autoplay"
            style={{ minHeight: 400 }}
          />
        </div>

        {/* Right — Your webcam */}
        <div className="flex-1 min-w-0">
          <CameraPanel onPose={handleSelfPose} badge="YOU" />
        </div>
      </main>

      <footer className="flex-shrink-0 px-4 pb-4">
        <CoachPanel score={score} message={coachMsg} />
      </footer>
    </div>
  );
}
