"use client";

import { useEffect, useRef, useCallback, useState } from "react";
import { loadPose, POSE_CONNECTIONS } from "./pose";
import type { NormalizedLandmark, PoseResults } from "./pose";

type Props = {
  onPose: (landmarks: NormalizedLandmark[] | null) => void;
  /** Called when the user stops sharing */
  onStop?: () => void;
};

export default function ScreenCapturePanel({ onPose, onStop }: Props) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const poseRef = useRef<unknown>(null);
  const animFrameRef = useRef<number>(0);
  const activeRef = useRef(false);
  const streamRef = useRef<MediaStream | null>(null);
  const [capturing, setCapturing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const processFrame = useCallback(async () => {
    if (!activeRef.current) return;
    const video = videoRef.current;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const pose = poseRef.current as any;

    if (video && pose && video.readyState >= 2) {
      try {
        await pose.send({ image: video });
      } catch {
        // pose may not be ready yet
      }
    }

    if (activeRef.current) {
      animFrameRef.current = requestAnimationFrame(processFrame);
    }
  }, []);

  const startCapture = useCallback(async () => {
    try {
      setError(null);

      const stream = await navigator.mediaDevices.getDisplayMedia({
        video: {
          width: { ideal: 1280 },
          height: { ideal: 720 },
          frameRate: { ideal: 30 },
        },
        audio: false,
      });

      streamRef.current = stream;

      // Detect when user stops sharing via the browser UI
      stream.getVideoTracks()[0].addEventListener("ended", () => {
        stopCapture();
        onStop?.();
      });

      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play();
      }

      // Load pose detection
      const pose = await loadPose();
      poseRef.current = pose;

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (pose as any).onResults((results: PoseResults) => {
        const landmarks = results.poseLandmarks ?? null;
        onPose(landmarks);

        const canvas = canvasRef.current;
        if (canvas && landmarks) {
          const ctx = canvas.getContext("2d");
          if (ctx) {
            canvas.width = canvas.offsetWidth;
            canvas.height = canvas.offsetHeight;
            // No mirror for screen capture (unlike webcam)
            drawSkeletonNoMirror(ctx, landmarks, canvas.width, canvas.height);
          }
        } else if (canvas) {
          const ctx = canvas.getContext("2d");
          ctx?.clearRect(0, 0, canvas.width, canvas.height);
        }
      });

      activeRef.current = true;
      setCapturing(true);
      animFrameRef.current = requestAnimationFrame(processFrame);
    } catch (err) {
      console.error("Screen capture error:", err);
      if (err instanceof Error && err.name === "NotAllowedError") {
        setError("Screen sharing was cancelled.");
      } else {
        setError("Could not start screen capture.");
      }
    }
  }, [onPose, onStop, processFrame]);

  const stopCapture = useCallback(() => {
    activeRef.current = false;
    cancelAnimationFrame(animFrameRef.current);
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
    }
    setCapturing(false);
  }, []);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      activeRef.current = false;
      cancelAnimationFrame(animFrameRef.current);
      if (streamRef.current) {
        streamRef.current.getTracks().forEach((t) => t.stop());
      }
    };
  }, []);

  if (!capturing) {
    return (
      <div className="w-full h-full flex flex-col items-center justify-center bg-black/40 rounded-2xl border border-white/10 gap-4">
        <div className="text-center">
          <p className="text-white/60 text-sm mb-1">Capture your Zoom call</p>
          <p className="text-white/30 text-xs max-w-xs">
            Share your Zoom window so the AI coach can see the dancer and track their moves
          </p>
        </div>
        <button
          onClick={startCapture}
          className="px-6 py-3 rounded-xl bg-gradient-to-r from-blue-500 to-cyan-500 text-white font-semibold text-sm hover:opacity-90 transition-opacity cursor-pointer"
        >
          Share Zoom Window
        </button>
        {error && (
          <p className="text-red-400 text-xs">{error}</p>
        )}
      </div>
    );
  }

  return (
    <div className="relative w-full h-full rounded-2xl overflow-hidden border border-white/10 bg-black">
      <video
        ref={videoRef}
        playsInline
        muted
        className="w-full h-full object-contain bg-black"
      />
      <canvas
        ref={canvasRef}
        className="absolute inset-0 w-full h-full pointer-events-none"
      />
      <div className="absolute top-3 left-3 flex items-center gap-2 bg-black/60 px-3 py-1 rounded-full">
        <span className="w-2 h-2 rounded-full bg-blue-500 animate-pulse" />
        <span className="text-xs text-white/70">ZOOM CAPTURE</span>
      </div>
      <button
        onClick={() => { stopCapture(); onStop?.(); }}
        className="absolute top-3 right-3 bg-red-500/80 hover:bg-red-500 text-white text-xs px-3 py-1 rounded-full transition-colors cursor-pointer"
      >
        Stop
      </button>
    </div>
  );
}

/**
 * Draw skeleton WITHOUT mirroring (screen capture shows the real orientation).
 */
function drawSkeletonNoMirror(
  ctx: CanvasRenderingContext2D,
  landmarks: NormalizedLandmark[],
  width: number,
  height: number
) {
  ctx.clearRect(0, 0, width, height);

  ctx.strokeStyle = "#00CCFF";
  ctx.lineWidth = 3;
  ctx.lineCap = "round";

  for (const [a, b] of POSE_CONNECTIONS) {
    const la = landmarks[a];
    const lb = landmarks[b];
    if (!la || !lb) continue;
    if ((la.visibility ?? 0) < 0.3 || (lb.visibility ?? 0) < 0.3) continue;

    ctx.beginPath();
    ctx.moveTo(la.x * width, la.y * height);
    ctx.lineTo(lb.x * width, lb.y * height);
    ctx.stroke();
  }

  ctx.fillStyle = "#FF6644";
  for (let i = 11; i < landmarks.length; i++) {
    const lm = landmarks[i];
    if (!lm || (lm.visibility ?? 0) < 0.3) continue;
    ctx.beginPath();
    ctx.arc(lm.x * width, lm.y * height, 5, 0, 2 * Math.PI);
    ctx.fill();
  }
}
