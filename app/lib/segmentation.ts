type ProgressCallback = (status: string, progress?: number) => void;

interface PredictionResponse {
  status: string;
  output?: string | string[];
  error?: string;
  logs?: string;
}

const MAX_POLL_SECONDS = 300; // 5 minute timeout

/** Parse frame progress from Replicate logs like "85%|████| 245/288 [00:28<..." */
function parseProgressFromLogs(logs?: string): number | null {
  if (!logs) return null;
  const matches = logs.match(/(\d+)%\|/g);
  if (!matches || matches.length === 0) return null;
  const last = matches[matches.length - 1];
  const pct = parseInt(last, 10);
  return isNaN(pct) ? null : pct;
}

/** Save a Replicate output URL to local disk cache via the server. */
async function saveSegmentedVideo(videoId: string, replicateUrl: string): Promise<void> {
  try {
    await fetch("/api/segment/save", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ videoId, url: replicateUrl }),
    });
  } catch (err) {
    console.warn("[segmentation] Failed to cache segmented video:", err);
  }
}

export async function segmentVideo(
  videoId: string,
  onProgress?: ProgressCallback
): Promise<string> {
  onProgress?.("Uploading video...", 5);

  const res = await fetch("/api/segment", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ videoId }),
  });

  if (!res.ok) {
    const data = await res.json();
    throw new Error(data.error || "Failed to start segmentation");
  }

  const data = await res.json();

  // Server found a cached segmented video on disk
  if (data.cached) {
    console.log("[segmentation] Using cached segmented video");
    onProgress?.("Complete!", 100);
    return `/api/segment/video/${videoId}`;
  }

  const { predictionId } = data;
  console.log("[segmentation] Prediction ID:", predictionId);
  onProgress?.("Queued...", 10);

  const startTime = Date.now();

  while (true) {
    const elapsed = (Date.now() - startTime) / 1000;
    if (elapsed > MAX_POLL_SECONDS) {
      throw new Error("Segmentation timed out");
    }

    const pollRes = await fetch(`/api/segment/${predictionId}`);

    if (!pollRes.ok) {
      const errData = await pollRes.json().catch(() => ({}));
      console.error("[segmentation] Poll error:", errData);
      throw new Error("Failed to poll segmentation status");
    }

    const prediction: PredictionResponse = await pollRes.json();

    if (prediction.status === "succeeded") {
      const outputUrl = Array.isArray(prediction.output)
        ? prediction.output[0]
        : prediction.output;

      if (!outputUrl) {
        throw new Error("No output from segmentation");
      }

      onProgress?.("Saving...", 98);

      // Save to disk so future loads are instant
      await saveSegmentedVideo(videoId, outputUrl);

      onProgress?.("Complete!", 100);
      return `/api/segment/video/${videoId}`;
    }

    if (prediction.status === "failed" || prediction.status === "canceled") {
      console.error("[segmentation] Failed:", prediction.error, prediction.logs);
      throw new Error(prediction.error || "Segmentation failed");
    }

    if (prediction.status === "processing") {
      const framePct = parseProgressFromLogs(prediction.logs);
      const progress = framePct !== null ? 15 + Math.round(framePct * 0.8) : 15;
      onProgress?.(`Segmenting... ${framePct ?? ""}%`, progress);
    } else {
      onProgress?.("Starting model...", 10);
    }

    await new Promise((r) => setTimeout(r, 2000));
  }
}

export async function isSegmentationAvailable(): Promise<boolean> {
  try {
    const res = await fetch("/api/segment");
    if (!res.ok) return false;
    const data = await res.json();
    return data.configured === true;
  } catch {
    return false;
  }
}
