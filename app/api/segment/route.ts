import { NextRequest } from "next/server";
import Replicate from "replicate";
import { readFile, access } from "fs/promises";
import path from "path";

const VIDEO_DIR = "/tmp/jigglewiggle";

function maskPath(videoId: string) {
  return path.join(VIDEO_DIR, `${videoId}_mask.mp4`);
}

export async function POST(request: NextRequest) {
  const token = process.env.REPLICATE_API_TOKEN;
  if (!token) {
    return Response.json(
      { error: "REPLICATE_API_TOKEN not configured" },
      { status: 503 }
    );
  }

  const { videoId } = (await request.json()) as { videoId: string };

  if (!videoId || !/^[a-zA-Z0-9_-]{11}$/.test(videoId)) {
    return Response.json({ error: "Invalid video ID" }, { status: 400 });
  }

  // Check for cached segmentation on disk
  try {
    await access(maskPath(videoId));
    console.log(`[segment] Cache hit for ${videoId}`);
    return Response.json({ cached: true });
  } catch {
    // not cached, continue
  }

  const filePath = path.join(VIDEO_DIR, `${videoId}.mp4`);

  try {
    await access(filePath);
  } catch {
    return Response.json(
      { error: "Video not yet downloaded" },
      { status: 404 }
    );
  }

  try {
    const buffer = await readFile(filePath);

    const replicate = new Replicate({ auth: token });

    const videoBlob = new Blob([buffer], { type: "video/mp4" });

    console.log(`[segment] Starting segmentation for ${videoId} (${buffer.length} bytes)`);

    const prediction = await replicate.predictions.create({
      version:
        "8cbab4c2a3133e679b5b863b80527f6b5c751ec7b33681b7e0b7c79c749df961",
      input: {
        video: videoBlob,
        prompt: "person",
        mask_only: true,
      },
    });

    console.log(`[segment] Prediction created: ${prediction.id}, status: ${prediction.status}`);

    return Response.json({ predictionId: prediction.id });
  } catch (err) {
    console.error("[segment] Segmentation error:", err);
    return Response.json(
      { error: err instanceof Error ? err.message : "Segmentation failed" },
      { status: 500 }
    );
  }
}

export async function GET() {
  const configured = !!process.env.REPLICATE_API_TOKEN;
  return Response.json({ configured });
}
