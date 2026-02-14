/**
 * Extracts a green outline from a mask video frame.
 * The mask video has white foreground (person) on black background.
 * This finds edge pixels where foreground meets background and returns
 * green (#00ff00) outline ImageData.
 */
export function extractOutline(
  maskVideo: HTMLVideoElement,
  tempCanvas: HTMLCanvasElement
): ImageData | null {
  const ctx = tempCanvas.getContext("2d", { willReadFrequently: true });
  if (!ctx) return null;

  ctx.drawImage(maskVideo, 0, 0, tempCanvas.width, tempCanvas.height);

  try {
    const imageData = ctx.getImageData(0, 0, tempCanvas.width, tempCanvas.height);
    const data = imageData.data;
    const width = tempCanvas.width;
    const height = tempCanvas.height;

    const outlineData = ctx.createImageData(width, height);
    const outline = outlineData.data;

    // Initialize fully transparent
    for (let i = 0; i < outline.length; i += 4) {
      outline[i + 3] = 0;
    }

    // Find edge pixels: foreground pixels with at least one background neighbor
    for (let y = 1; y < height - 1; y++) {
      for (let x = 1; x < width - 1; x++) {
        const idx = (y * width + x) * 4;

        if (data[idx] > 128) {
          let hasBackgroundNeighbor = false;

          for (let dy = -1; dy <= 1; dy++) {
            for (let dx = -1; dx <= 1; dx++) {
              if (dx === 0 && dy === 0) continue;
              const nIdx = ((y + dy) * width + (x + dx)) * 4;
              if (data[nIdx] < 128) {
                hasBackgroundNeighbor = true;
                break;
              }
            }
            if (hasBackgroundNeighbor) break;
          }

          if (hasBackgroundNeighbor) {
            outline[idx] = 0;       // R
            outline[idx + 1] = 255; // G
            outline[idx + 2] = 0;   // B
            outline[idx + 3] = 255; // A
          }
        }
      }
    }

    return outlineData;
  } catch (err) {
    console.error("Error extracting outline:", err);
    return null;
  }
}
