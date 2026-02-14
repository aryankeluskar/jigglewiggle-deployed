import type { ReplicatePrediction } from '../types/pose.types';

const BACKEND_URL = 'http://localhost:3001';

export const segmentVideo = async (
  videoFile: File,
  onProgress?: (status: string, progress?: number) => void
): Promise<string> => {
  try {
    onProgress?.('Initializing...', 0);

    const videoDataUrl = await fileToDataUrl(videoFile);

    onProgress?.('Uploading video to backend...', 10);

    const response = await fetch(`${BACKEND_URL}/api/segment-video`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ videoDataUrl }),
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || 'Failed to start segmentation');
    }

    const { predictionId } = await response.json();

    onProgress?.('Processing video...', 30);

    const result = await pollPrediction(predictionId, (status) => {
      onProgress?.(status, status === 'processing' ? 60 : 30);
    });

    if (result.status === 'failed') {
      throw new Error(result.error || 'Video segmentation failed');
    }

    if (!result.output) {
      throw new Error('No output received from segmentation');
    }

    onProgress?.('Complete!', 100);

    return result.output as string;
  } catch (error) {
    console.error('Error segmenting video:', error);
    throw error;
  }
};

const fileToDataUrl = (file: File): Promise<string> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
};

const pollPrediction = async (
  predictionId: string,
  onStatusChange?: (status: string) => void
): Promise<ReplicatePrediction> => {
  let prediction: ReplicatePrediction;

  while (true) {
    const response = await fetch(`${BACKEND_URL}/api/prediction/${predictionId}`);

    if (!response.ok) {
      throw new Error('Failed to fetch prediction status');
    }

    prediction = await response.json();

    if (prediction.status !== 'starting' && prediction.status !== 'processing') {
      break;
    }

    onStatusChange?.(prediction.status);

    await new Promise((resolve) => setTimeout(resolve, 1000));
  }

  return prediction;
};

export const isReplicateConfigured = async (): Promise<boolean> => {
  try {
    const response = await fetch(`${BACKEND_URL}/health`);
    if (!response.ok) return false;
    const data = await response.json();
    return data.replicate === true;
  } catch (error) {
    return false;
  }
};
