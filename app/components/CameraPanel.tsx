"use client";

import { useEffect, useRef, useCallback } from "react";
import { drawSkeleton, loadPose } from "../lib/pose";
import { extractOutline } from "../lib/outlineExtractor";
import { captureVideoFrame } from "../lib/frameCapture";
import type { NormalizedLandmark, PoseResults } from "../lib/pose";

type Props = {
  onPose: (landmarks: NormalizedLandmark[] | null) => void;
  segmentedVideoUrl?: string | null;
  referenceVideoTime?: number;
  webcamCaptureRef?: React.MutableRefObject<(() => string | null) | null>;
};

const NEON_SKELETON_STYLE = {
  mirror: true,
  strokeColor: "#00ffff",
  fillColor: "#ff00aa",
  lineWidth: 3,
  pointRadius: 5,
  opacity: 1,
  clear: true,
} as const;

export default function CameraPanel({ onPose, segmentedVideoUrl, referenceVideoTime, webcamCaptureRef }: Props) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const overlayCanvasRef = useRef<HTMLCanvasElement>(null);
  const overlayVideoRef = useRef<HTMLVideoElement>(null);
  const tempCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const poseRef = useRef<unknown>(null);
  const animFrameRef = useRef<number>(0);
  const activeRef = useRef(true);
  const overlayRafRef = useRef<number>(0);

  // Create offscreen temp canvas for outline extraction
  useEffect(() => {
    if (!tempCanvasRef.current) {
      tempCanvasRef.current = document.createElement("canvas");
      tempCanvasRef.current.width = 640;
      tempCanvasRef.current.height = 480;
    }
  }, []);

  // Load and play the segmented overlay video when URL changes
  useEffect(() => {
    const video = overlayVideoRef.current;
    if (!video || !segmentedVideoUrl) return;

    video.crossOrigin = "anonymous";
    video.src = segmentedVideoUrl;
    video.loop = true;
    video.muted = true;
    video.play().catch((err) => {
      console.error("Overlay video play failed:", err);
    });
  }, [segmentedVideoUrl]);

  // Sync overlay video time with reference video
  useEffect(() => {
    const video = overlayVideoRef.current;
    if (!video || !segmentedVideoUrl || referenceVideoTime === undefined) return;
    if (video.readyState < 2) return;

    // Only seek if drift is significant (>0.3s) to avoid constant seeking
    if (Math.abs(video.currentTime - referenceVideoTime) > 0.3) {
      video.currentTime = referenceVideoTime;
    }
  }, [referenceVideoTime, segmentedVideoUrl]);

  // Render the outline overlay on a separate canvas via rAF
  useEffect(() => {
    if (!segmentedVideoUrl) return;

    const renderOverlay = () => {
      const overlayVideo = overlayVideoRef.current;
      const overlayCanvas = overlayCanvasRef.current;
      const tempCanvas = tempCanvasRef.current;

      if (overlayCanvas && overlayVideo && tempCanvas && overlayVideo.readyState >= 2) {
        overlayCanvas.width = overlayCanvas.offsetWidth;
        overlayCanvas.height = overlayCanvas.offsetHeight;

        // Resize temp canvas to match
        tempCanvas.width = overlayCanvas.width;
        tempCanvas.height = overlayCanvas.height;

        const outlineData = extractOutline(overlayVideo, tempCanvas);
        if (outlineData) {
          const ctx = overlayCanvas.getContext("2d");
          if (ctx) {
            ctx.clearRect(0, 0, overlayCanvas.width, overlayCanvas.height);
            // Draw outline to temp canvas, then mirror onto overlay canvas
            const tempCtx = tempCanvas.getContext("2d");
            if (tempCtx) {
              tempCtx.putImageData(outlineData, 0, 0);
              ctx.save();
              ctx.scale(-1, 1);
              ctx.drawImage(tempCanvas, -overlayCanvas.width, 0, overlayCanvas.width, overlayCanvas.height);
              ctx.restore();
            }
          }
        }
      }

      overlayRafRef.current = requestAnimationFrame(renderOverlay);
    };

    overlayRafRef.current = requestAnimationFrame(renderOverlay);

    return () => {
      cancelAnimationFrame(overlayRafRef.current);
    };
  }, [segmentedVideoUrl]);

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

  useEffect(() => {
    activeRef.current = true;
    let stream: MediaStream | null = null;

    const init = async () => {
      try {
        stream = await navigator.mediaDevices.getUserMedia({
          video: { width: 640, height: 480, facingMode: "user" },
          audio: false,
        });

        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          await videoRef.current.play();
          if (webcamCaptureRef) {
            webcamCaptureRef.current = () =>
              videoRef.current ? captureVideoFrame(videoRef.current, false) : null;
          }
        }

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
              drawSkeleton(ctx, landmarks, canvas.width, canvas.height, NEON_SKELETON_STYLE);
            }
          } else if (canvas) {
            const ctx = canvas.getContext("2d");
            ctx?.clearRect(0, 0, canvas.width, canvas.height);
          }
        });

        // Start processing frames
        animFrameRef.current = requestAnimationFrame(processFrame);
      } catch (err) {
        console.error("Camera/Pose init error:", err);
      }
    };

    init();

    return () => {
      activeRef.current = false;
      cancelAnimationFrame(animFrameRef.current);
      if (stream) {
        stream.getTracks().forEach((t) => t.stop());
      }
    };
  }, [onPose, processFrame]);

  return (
    <div className="relative w-full h-full rounded overflow-hidden border border-neon-magenta/15 bg-black glow-magenta">
      {/* HUD corners — magenta theme for camera */}
      <div className="absolute top-0 left-0 w-4 h-4 border-t-2 border-l-2 border-neon-magenta/50 z-10" />
      <div className="absolute top-0 right-0 w-4 h-4 border-t-2 border-r-2 border-neon-magenta/50 z-10" />
      <div className="absolute bottom-0 left-0 w-4 h-4 border-b-2 border-l-2 border-neon-magenta/50 z-10" />
      <div className="absolute bottom-0 right-0 w-4 h-4 border-b-2 border-r-2 border-neon-magenta/50 z-10" />

      {/* Panel label */}
      <div
        className="absolute top-2 left-3 z-10 text-[8px] tracking-[0.3em] uppercase text-neon-magenta/35"
        style={{ fontFamily: "var(--font-audiowide)" }}
      >
        Your Move
      </div>

      {/* Webcam video */}
      <video
        ref={videoRef}
        playsInline
        muted
        className="w-full h-full object-cover"
        style={{ transform: "scaleX(-1)" }}
      />

      {/* Skeleton overlay canvas */}
      <canvas
        ref={canvasRef}
        className="absolute inset-0 w-full h-full pointer-events-none"
      />

      {/* Segmented outline overlay canvas */}
      <canvas
        ref={overlayCanvasRef}
        className="absolute inset-0 w-full h-full pointer-events-none"
        style={{ opacity: 0.7 }}
      />

      {/* Hidden overlay video for segmented mask */}
      {segmentedVideoUrl && (
        <video
          ref={overlayVideoRef}
          playsInline
          muted
          className="hidden"
        />
      )}

      {/* Live indicator */}
      <div className="absolute top-2 right-3 z-10 flex items-center gap-2 bg-black/70 px-2.5 py-1 border border-neon-red/30 rounded-sm">
        <span className="w-1.5 h-1.5 rounded-full bg-neon-red animate-live-dot" />
        <span
          className="text-[9px] tracking-[0.2em] text-neon-red/80 uppercase"
          style={{ fontFamily: "var(--font-audiowide)" }}
        >
          Live
        </span>
      </div>
    </div>
  );
}
