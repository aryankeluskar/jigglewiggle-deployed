/**
 * Extracts an "oreo" outline from a mask video frame.
 * The mask video has white foreground (person) on black background.
 * This creates a 3-layer border: black (outer), white (middle), black (inner).
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

    // Helper to check if pixel is foreground (white in mask)
    const isForeground = (x: number, y: number) => {
      if (x < 0 || x >= width || y < 0 || y >= height) return false;
      return data[(y * width + x) * 4] > 128;
    };

    // Helper to get distance to nearest background pixel
    const distanceToBackground = (x: number, y: number, maxDist: number) => {
      for (let dist = 1; dist <= maxDist; dist++) {
        for (let dy = -dist; dy <= dist; dy++) {
          for (let dx = -dist; dx <= dist; dx++) {
            if (Math.abs(dx) === dist || Math.abs(dy) === dist) {
              if (!isForeground(x + dx, y + dy)) {
                return dist;
              }
            }
          }
        }
      }
      return maxDist + 1;
    };

    // Create thick oreo border: black (2px), white (4px), black (2px) = 8px total
    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        if (isForeground(x, y)) {
          const dist = distanceToBackground(x, y, 8);
          const idx = (y * width + x) * 4;

          // Inner black (1-2px from edge)
          if (dist >= 1 && dist <= 2) {
            outline[idx] = 0;       // R
            outline[idx + 1] = 0;   // G
            outline[idx + 2] = 0;   // B
            outline[idx + 3] = 255; // A
          }
          // Middle white (3-6px from edge)
          else if (dist >= 3 && dist <= 6) {
            outline[idx] = 255;     // R
            outline[idx + 1] = 255; // G
            outline[idx + 2] = 255; // B
            outline[idx + 3] = 255; // A
          }
          // Outer black (7-8px from edge)
          else if (dist >= 7 && dist <= 8) {
            outline[idx] = 0;       // R
            outline[idx + 1] = 0;   // G
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
