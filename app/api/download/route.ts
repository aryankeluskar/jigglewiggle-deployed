import { NextRequest } from "next/server";
import { spawn } from "child_process";
import { mkdir, access } from "fs/promises";
import path from "path";

const VIDEO_DIR = "/tmp/jigglewiggle";

export async function POST(request: NextRequest) {
  const { videoId } = (await request.json()) as { videoId: string };

  if (!videoId || !/^[a-zA-Z0-9_-]{11}$/.test(videoId)) {
    return new Response(
      JSON.stringify({ error: "Invalid video ID" }),
      { status: 400, headers: { "Content-Type": "application/json" } }
    );
  }

  await mkdir(VIDEO_DIR, { recursive: true });

  const outputPath = path.join(VIDEO_DIR, `${videoId}.mp4`);

  // Check if already downloaded
  try {
    await access(outputPath);
    // File exists — return immediately
    const encoder = new TextEncoder();
    const stream = new ReadableStream({
      start(controller) {
        controller.enqueue(encoder.encode(`data: ${JSON.stringify({ type: "progress", percent: 100 })}\n\n`));
        controller.enqueue(encoder.encode(`data: ${JSON.stringify({ type: "done" })}\n\n`));
        controller.close();
      },
    });
    return new Response(stream, {
      headers: {
        "Content-Type": "text/event-stream",
        "Cache-Control": "no-cache",
        Connection: "keep-alive",
      },
    });
  } catch {
    // File doesn't exist — proceed with download
  }

  const url = `https://www.youtube.com/watch?v=${videoId}`;

  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    start(controller) {
      const proc = spawn("yt-dlp", [
        "-f", "best[ext=mp4]/bestvideo[ext=mp4]+bestaudio/best",
        "--merge-output-format", "mp4",
        "-o", outputPath,
        "--newline",
        url,
      ]);

      let stderrBuf = "";

      proc.stdout.on("data", (data: Buffer) => {
        const text = data.toString();
        // yt-dlp prints progress like: [download]  45.2% of ...
        const match = text.match(/\[download\]\s+([\d.]+)%/);
        if (match) {
          const percent = parseFloat(match[1]);
          controller.enqueue(
            encoder.encode(`data: ${JSON.stringify({ type: "progress", percent })}\n\n`)
          );
        }
      });

      proc.stderr.on("data", (data: Buffer) => {
        stderrBuf += data.toString();
      });

      proc.on("error", (err) => {
        controller.enqueue(
          encoder.encode(`data: ${JSON.stringify({ type: "error", message: err.message })}\n\n`)
        );
        controller.close();
      });

      proc.on("close", (code) => {
        if (code === 0) {
          controller.enqueue(
            encoder.encode(`data: ${JSON.stringify({ type: "done" })}\n\n`)
          );
        } else {
          controller.enqueue(
            encoder.encode(
              `data: ${JSON.stringify({ type: "error", message: stderrBuf.slice(-500) || `yt-dlp exited with code ${code}` })}\n\n`
            )
          );
        }
        controller.close();
      });
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      Connection: "keep-alive",
    },
  });
}
