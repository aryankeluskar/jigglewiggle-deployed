/**
 * MediaPipe Pose setup and skeleton drawing utilities.
 *
 * We load MediaPipe Pose from CDN to avoid bundling WASM in Next.js.
 */

export type NormalizedLandmark = {
  x: number;
  y: number;
  z: number;
  visibility?: number;
};

export type PoseResults = {
  poseLandmarks?: NormalizedLandmark[];
};

// MediaPipe Pose connections (pairs of landmark indices)
export const POSE_CONNECTIONS: [number, number][] = [
  [11, 12],
  [11, 13],
  [13, 15],
  [12, 14],
  [14, 16],
  [11, 23],
  [12, 24],
  [23, 24],
  [23, 25],
  [25, 27],
  [24, 26],
  [26, 28],
  [27, 29],
  [28, 30],
  [29, 31],
  [30, 32],
];

export type SkeletonStyle = {
  mirror?: boolean;
  strokeColor?: string;
  fillColor?: string;
  lineWidth?: number;
  pointRadius?: number;
  opacity?: number;
  clear?: boolean;
};

/**
 * Draw a skeleton overlay on a canvas from pose landmarks.
 */
export function drawSkeleton(
  ctx: CanvasRenderingContext2D,
  landmarks: NormalizedLandmark[],
  width: number,
  height: number,
  style?: SkeletonStyle
) {
  const mirror = style?.mirror ?? true;
  const strokeColor = style?.strokeColor ?? "#00FF88";
  const fillColor = style?.fillColor ?? "#FF4488";
  const lineWidth = style?.lineWidth ?? 3;
  const pointRadius = style?.pointRadius ?? 5;
  const opacity = style?.opacity ?? 1;
  const clear = style?.clear ?? true;

  if (clear) ctx.clearRect(0, 0, width, height);

  ctx.save();
  ctx.globalAlpha = opacity;

  const xPos = (x: number) => (mirror ? (1 - x) * width : x * width);

  // Draw connections
  ctx.strokeStyle = strokeColor;
  ctx.lineWidth = lineWidth;
  ctx.lineCap = "round";

  for (const [a, b] of POSE_CONNECTIONS) {
    const la = landmarks[a];
    const lb = landmarks[b];
    if (!la || !lb) continue;
    if ((la.visibility ?? 0) < 0.3 || (lb.visibility ?? 0) < 0.3) continue;

    ctx.beginPath();
    ctx.moveTo(xPos(la.x), la.y * height);
    ctx.lineTo(xPos(lb.x), lb.y * height);
    ctx.stroke();
  }

  // Draw keypoints
  ctx.fillStyle = fillColor;
  for (let i = 11; i < landmarks.length; i++) {
    const lm = landmarks[i];
    if (!lm || (lm.visibility ?? 0) < 0.3) continue;
    ctx.beginPath();
    ctx.arc(xPos(lm.x), lm.y * height, pointRadius, 0, 2 * Math.PI);
    ctx.fill();
  }

  ctx.restore();
}

/**
 * Dynamically loads MediaPipe Pose scripts from CDN.
 * Returns a configured Pose instance.
 */
export async function loadPose(): Promise<unknown> {
  // Load scripts dynamically
  const loadScript = (src: string): Promise<void> =>
    new Promise((resolve, reject) => {
      if (document.querySelector(`script[src="${src}"]`)) {
        resolve();
        return;
      }
      const s = document.createElement("script");
      s.src = src;
      s.crossOrigin = "anonymous";
      s.onload = () => resolve();
      s.onerror = reject;
      document.head.appendChild(s);
    });

  await loadScript(
    "https://cdn.jsdelivr.net/npm/@mediapipe/pose@0.5.1675469404/pose.js"
  );

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const mp = (window as any).Pose;
  if (!mp) throw new Error("MediaPipe Pose not loaded");

  const pose = new mp({
    locateFile: (file: string) =>
      `https://cdn.jsdelivr.net/npm/@mediapipe/pose@0.5.1675469404/${file}`,
  });

  pose.setOptions({
    modelComplexity: 1,
    smoothLandmarks: true,
    enableSegmentation: false,
    minDetectionConfidence: 0.5,
    minTrackingConfidence: 0.5,
  });

  return pose;
}
