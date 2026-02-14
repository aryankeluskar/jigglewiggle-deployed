import express from 'express';
import cors from 'cors';
import Replicate from 'replicate';
import dotenv from 'dotenv';

dotenv.config();

const app = express();
const port = 3001;

app.use(cors({
  origin: '*',
  credentials: true,
  methods: ['GET', 'POST', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization']
}));
app.use(express.json({ limit: '50mb' }));

const replicate = new Replicate({
  auth: process.env.REPLICATE_API_TOKEN,
});

app.get('/health', (_req, res) => {
  res.json({ status: 'ok', replicate: !!process.env.REPLICATE_API_TOKEN });
});

app.post('/api/segment-video', async (req, res) => {
  try {
    const { videoDataUrl } = req.body;

    if (!videoDataUrl) {
      return res.status(400).json({ error: 'No video data provided' });
    }

    console.log('Starting video segmentation...');

    const prediction = await replicate.predictions.create({
      version: '8cbab4c2a3133e679b5b863b80527f6b5c751ec7b33681b7e0b7c79c749df961',
      input: {
        video: videoDataUrl,
        prompt: 'person',
        mask_only: true,
      },
    });

    console.log('Prediction created:', prediction.id);
    res.json({ predictionId: prediction.id });
  } catch (error) {
    console.error('Error creating prediction:', error);
    res.status(500).json({ error: error.message });
  }
});

app.get('/api/prediction/:id', async (req, res) => {
  try {
    const prediction = await replicate.predictions.get(req.params.id);
    res.json(prediction);
  } catch (error) {
    console.error('Error fetching prediction:', error);
    res.status(500).json({ error: error.message });
  }
});

app.get('/api/proxy-video', async (req, res) => {
  try {
    const videoUrl = req.query.url;
    if (!videoUrl) {
      return res.status(400).json({ error: 'No URL provided' });
    }

    console.log('Proxying video from:', videoUrl);

    const response = await fetch(videoUrl);

    if (!response.ok) {
      throw new Error(`Failed to fetch video: ${response.statusText}`);
    }

    res.setHeader('Content-Type', response.headers.get('content-type') || 'video/mp4');
    res.setHeader('Access-Control-Allow-Origin', '*');

    const buffer = await response.arrayBuffer();
    res.send(Buffer.from(buffer));
  } catch (error) {
    console.error('Error proxying video:', error);
    res.status(500).json({ error: error.message });
  }
});

app.listen(port, () => {
  console.log(`Backend server running at http://localhost:${port}`);
  console.log(`Replicate API token configured: ${!!process.env.REPLICATE_API_TOKEN}`);
});
