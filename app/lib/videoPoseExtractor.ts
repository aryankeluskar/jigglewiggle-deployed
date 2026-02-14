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

const MAX_EXTRACT_DIM = 320;

/** Create a hidden video + aspect-ratio-matched canvas for extraction. */
async function prepareExtractionElements(videoSrc: string) {
  const video = document.createElement("video");
  video.src = videoSrc;
  video.crossOrigin = "anonymous";
  video.muted = true;
  video.playsInline = true;
  video.style.display = "none";
  document.body.appendChild(video);

  await new Promise<void>((resolve, reject) => {
    video.onloadedmetadata = () => resolve();
    video.onerror = () => reject(new Error("Failed to load video for pose extraction"));
    video.load();
  });

  const duration = video.duration;
  if (!duration || !isFinite(duration)) {
    video.remove();
    throw new Error("Video has no valid duration");
  }

  // Scale canvas to match video aspect ratio (max 320px on longest side)
  const vw = video.videoWidth || 320;
  const vh = video.videoHeight || 240;
  const scale = Math.min(MAX_EXTRACT_DIM / vw, MAX_EXTRACT_DIM / vh);
  const cw = Math.round(vw * scale);
  const ch = Math.round(vh * scale);

  const canvas = document.createElement("canvas");
  canvas.width = cw;
  canvas.height = ch;
  canvas.style.display = "none";
  document.body.appendChild(canvas);
  const ctx = canvas.getContext("2d")!;

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const pose = (await loadPose()) as any;

  const cleanup = () => {
    video.remove();
    canvas.remove();
  };

  return { video, canvas, ctx, pose, duration, cleanup };
}

/**
 * Extracts pose landmarks from a video at ~10fps by seeking through frames.
 * Runs client-side using the same MediaPipe Pose model as the webcam.
 */
export async function extractPoses(
  videoSrc: string,
  onProgress: (percent: number) => void
): Promise<PoseTimeline> {
  const { video, canvas, ctx, pose, duration, cleanup } =
    await prepareExtractionElements(videoSrc);

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
  const { video, canvas, ctx, pose, duration, cleanup } =
    await prepareExtractionElements(videoSrc);

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

  const densifiedTimeline = fillMissingStripLandmarks(timeline);

  onProgress(100);
  cleanup();
  return densifiedTimeline;
}

function fillMissingStripLandmarks(timeline: StripPoseTimeline): StripPoseTimeline {
  if (timeline.length === 0) return timeline;

  const nextValidIdx: number[] = Array(timeline.length).fill(-1);
  let next = -1;
  for (let i = timeline.length - 1; i >= 0; i -= 1) {
    if (timeline[i].landmarks.length > 0) next = i;
    nextValidIdx[i] = next;
  }

  let prev = -1;
  return timeline.map((frame, i) => {
    if (frame.landmarks.length > 0) {
      prev = i;
      return frame;
    }

    const nextIdx = nextValidIdx[i];
    if (prev === -1 && nextIdx === -1) return frame;

    if (prev === -1) {
      return { ...frame, landmarks: [...timeline[nextIdx].landmarks] };
    }
    if (nextIdx === -1) {
      return { ...frame, landmarks: [...timeline[prev].landmarks] };
    }

    const prevDelta = Math.abs(frame.time - timeline[prev].time);
    const nextDelta = Math.abs(timeline[nextIdx].time - frame.time);
    const source = prevDelta <= nextDelta ? timeline[prev] : timeline[nextIdx];
    return { ...frame, landmarks: [...source.landmarks] };
  });
}
