"use client";

import { useEffect, useRef } from "react";
import { registerPoseSource } from "./poseManager";
import { drawSkeleton } from "./pose";
import type { NormalizedLandmark } from "./pose";

type Props = {
  onPose: (landmarks: NormalizedLandmark[] | null) => void;
  /** Optional label shown in the top-right badge. Defaults to "LIVE". */
  badge?: string;
  /** Optional: overlay segmented video */
  segmentedVideoUrl?: string | null;
  /** Optional: reference video time for syncing overlay */
  referenceVideoTime?: number;
};

export default function CameraPanel({ onPose, badge = "LIVE", segmentedVideoUrl, referenceVideoTime }: Props) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const overlayVideoRef = useRef<HTMLVideoElement>(null);

  // Keep onPose fresh in a ref so we don't re-register when callback identity changes
  const onPoseRef = useRef(onPose);
  onPoseRef.current = onPose;

  // Sync overlay video time
  useEffect(() => {
    if (overlayVideoRef.current && referenceVideoTime !== undefined && segmentedVideoUrl) {
      const diff = Math.abs(overlayVideoRef.current.currentTime - referenceVideoTime);
      if (diff > 0.3) {
        overlayVideoRef.current.currentTime = referenceVideoTime;
      }
      if (overlayVideoRef.current.paused && referenceVideoTime > 0) {
        overlayVideoRef.current.play().catch(() => {});
      }
    }
  }, [referenceVideoTime, segmentedVideoUrl]);

  useEffect(() => {
    let stream: MediaStream | null = null;
    let unregister: (() => void) | null = null;
    let cancelled = false;

    const init = async () => {
      try {
        stream = await navigator.mediaDevices.getUserMedia({
          video: { width: 640, height: 480, facingMode: "user" },
          audio: false,
        });

        if (cancelled) { stream.getTracks().forEach(t => t.stop()); return; }

        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          await videoRef.current.play().catch(() => {}); // suppress play() interrupted
        }

        if (cancelled) return;

        console.log("[CameraPanel] Registering with pose manager...");
        // Register with the shared pose manager
        unregister = await registerPoseSource(
          "camera",
          () => videoRef.current,
          (landmarks) => {
            onPoseRef.current(landmarks);

            const canvas = canvasRef.current;
            if (canvas && landmarks) {
              const ctx = canvas.getContext("2d");
              if (ctx) {
                canvas.width = canvas.offsetWidth;
                canvas.height = canvas.offsetHeight;
                drawSkeleton(ctx, landmarks, canvas.width, canvas.height);
              }
            } else if (canvas) {
              const ctx = canvas.getContext("2d");
              ctx?.clearRect(0, 0, canvas.width, canvas.height);
            }
          }
        );
      } catch (err) {
        console.error("Camera/Pose init error:", err);
      }
    };

    init();

    return () => {
      cancelled = true;
      unregister?.();
      if (stream) {
        stream.getTracks().forEach((t) => t.stop());
      }
    };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div className="relative w-full h-full rounded-2xl overflow-hidden border border-white/10 bg-black">
      <video
        ref={videoRef}
        playsInline
        muted
        className="w-full h-full object-cover"
        style={{ transform: "scaleX(-1)" }}
      />
      {/* Overlay segmented video */}
      {segmentedVideoUrl && (
        <video
          ref={overlayVideoRef}
          src={segmentedVideoUrl}
          playsInline
          muted
          className="absolute inset-0 w-full h-full object-cover pointer-events-none"
          style={{ transform: "scaleX(-1)", mixBlendMode: "screen", opacity: 0.7 }}
        />
      )}
      <canvas
        ref={canvasRef}
        className="absolute inset-0 w-full h-full pointer-events-none"
      />
      <div className="absolute top-3 right-3 flex items-center gap-2 bg-black/60 px-3 py-1 rounded-full">
        <span className="w-2 h-2 rounded-full bg-red-500 animate-pulse" />
        <span className="text-xs text-white/70">{badge}</span>
      </div>
    </div>
  );
}
