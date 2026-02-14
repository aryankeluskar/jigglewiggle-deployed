import { loadPose } from "./pose";
import type { NormalizedLandmark, PoseResults } from "./pose";

export type PoseFrame = {
  time: number;
  landmarks: NormalizedLandmark[];
};

export type PoseTimeline = PoseFrame[];

export type StripPoseFrame = {
  time: number;
  landmarks: NormalizedLandmark[];
};

export type StripPoseTimeline = StripPoseFrame[];

/**
 * Extracts pose landmarks from a video at ~10fps by seeking through frames.
 * Runs client-side using the same MediaPipe Pose model as the webcam.
 */
export async function extractPoses(
  videoSrc: string,
  onProgress: (percent: number) => void
): Promise<PoseTimeline> {
  const video = document.createElement("video");
  video.src = videoSrc;
  video.crossOrigin = "anonymous";
  video.muted = true;
  video.playsInline = true;
  video.style.display = "none";
  document.body.appendChild(video);

  const canvas = document.createElement("canvas");
  canvas.width = 320;
  canvas.height = 240;
  canvas.style.display = "none";
  document.body.appendChild(canvas);
  const ctx = canvas.getContext("2d")!;

  // Wait for video metadata
  await new Promise<void>((resolve, reject) => {
    video.onloadedmetadata = () => resolve();
    video.onerror = () => reject(new Error("Failed to load video for pose extraction"));
    video.load();
  });

  const duration = video.duration;
  if (!duration || !isFinite(duration)) {
    cleanup();
    throw new Error("Video has no valid duration");
  }

  // Load MediaPipe Pose
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const pose = (await loadPose()) as any;

  const timeline: PoseTimeline = [];
  const step = 0.1; // 10fps

  // Wrap onResults in a promise-based interface for sequential processing
  let resolveFrame: ((landmarks: NormalizedLandmark[]) => void) | null = null;

  pose.onResults((results: PoseResults) => {
    if (resolveFrame) {
      resolveFrame(results.poseLandmarks ? [...results.poseLandmarks] : []);
      resolveFrame = null;
    }
  });

  for (let t = 0; t < duration; t += step) {
    // Seek to time
    video.currentTime = t;
    await new Promise<void>((resolve) => {
      video.onseeked = () => resolve();
    });

    // Draw frame to canvas
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);

    // Run pose detection and wait for result
    const landmarks = await new Promise<NormalizedLandmark[]>((resolve) => {
      resolveFrame = resolve;
      pose.send({ image: canvas });
    });

    timeline.push({ time: t, landmarks });
    onProgress((t / duration) * 100);
  }

  onProgress(100);
  cleanup();
  return timeline;

  function cleanup() {
    video.remove();
    canvas.remove();
  }
}

/**
 * Extracts poses at a coarse interval (default 2s) for the MoveQueue strip.
 * Much faster + smaller than extracting the full ~10fps timeline.
 */
export async function extractStripPoses(
  videoSrc: string,
  onProgress: (percent: number) => void,
  intervalSeconds = 2
): Promise<StripPoseTimeline> {
  const video = document.createElement("video");
  video.src = videoSrc;
  video.crossOrigin = "anonymous";
  video.muted = true;
  video.playsInline = true;
  video.style.display = "none";
  document.body.appendChild(video);

  const canvas = document.createElement("canvas");
  canvas.width = 320;
  canvas.height = 240;
  canvas.style.display = "none";
  document.body.appendChild(canvas);
  const ctx = canvas.getContext("2d")!;

  await new Promise<void>((resolve, reject) => {
    video.onloadedmetadata = () => resolve();
    video.onerror = () => reject(new Error("Failed to load video for pose extraction"));
    video.load();
  });

  const duration = video.duration;
  if (!duration || !isFinite(duration)) {
    cleanup();
    throw new Error("Video has no valid duration");
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const pose = (await loadPose()) as any;

  const timeline: StripPoseTimeline = [];

  let resolveFrame: ((landmarks: NormalizedLandmark[]) => void) | null = null;
  pose.onResults((results: PoseResults) => {
    if (!resolveFrame) return;
    resolveFrame(results.poseLandmarks ? [...results.poseLandmarks] : []);
    resolveFrame = null;
  });

  const step = Math.max(0.25, intervalSeconds);
  for (let t = 0; t < duration; t += step) {
    video.currentTime = t;
    await new Promise<void>((resolve) => {
      video.onseeked = () => resolve();
    });

    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);

    const landmarks = await new Promise<NormalizedLandmark[]>((resolve) => {
      resolveFrame = resolve;
      pose.send({ image: canvas });
    });

    timeline.push({ time: t, landmarks });
    onProgress((t / duration) * 100);
  }

  onProgress(100);
  cleanup();
  return timeline;

  function cleanup() {
    video.remove();
    canvas.remove();
  }
}
