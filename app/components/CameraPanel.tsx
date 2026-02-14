"use client";

import { useEffect, useRef, useCallback } from "react";
import { drawSkeleton, loadPose } from "../lib/pose";
import type { NormalizedLandmark, PoseResults } from "../lib/pose";

type Props = {
  onPose: (landmarks: NormalizedLandmark[] | null) => void;
};

export default function CameraPanel({ onPose }: Props) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const poseRef = useRef<unknown>(null);
  const animFrameRef = useRef<number>(0);
  const activeRef = useRef(true);

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
              drawSkeleton(ctx, landmarks, canvas.width, canvas.height);
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
    <div className="relative w-full h-full rounded-2xl overflow-hidden border border-white/10 bg-black">
      <video
        ref={videoRef}
        playsInline
        muted
        className="w-full h-full object-cover"
        style={{ transform: "scaleX(-1)" }}
      />
      <canvas
        ref={canvasRef}
        className="absolute inset-0 w-full h-full pointer-events-none"
      />
      <div className="absolute top-3 right-3 flex items-center gap-2 bg-black/60 px-3 py-1 rounded-full">
        <span className="w-2 h-2 rounded-full bg-red-500 animate-pulse" />
        <span className="text-xs text-white/70">LIVE</span>
      </div>
    </div>
  );
}
