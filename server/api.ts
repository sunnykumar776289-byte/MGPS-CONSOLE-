import { Router, Request, Response } from 'express';
import { analyzeGaugePhoto, analyzeCylinderPhoto } from './geminiService.ts';

export const apiRouter = Router();

apiRouter.get('/health', (_req: Request, res: Response) => {
  res.json({
    status: 'ok',
    app: 'MGPS Plant Console',
    timestamp: new Date().toISOString(),
    geminiConfigured: !!process.env.GEMINI_API_KEY
  });
});

apiRouter.post('/gemini/gauge', async (req: Request, res: Response) => {
  try {
    const { imageBase64 } = req.body;
    if (!imageBase64) {
      res.status(400).json({ error: 'imageBase64 is required' });
      return;
    }
    const result = await analyzeGaugePhoto(imageBase64);
    res.json(result);
  } catch (error) {
    console.error('Error in /api/gemini/gauge:', error);
    res.status(500).json({
      error: error instanceof Error ? error.message : 'Internal Server Error'
    });
  }
});

apiRouter.post('/gemini/cylinder', async (req: Request, res: Response) => {
  try {
    const { imageBase64 } = req.body;
    if (!imageBase64) {
      res.status(400).json({ error: 'imageBase64 is required' });
      return;
    }
    const result = await analyzeCylinderPhoto(imageBase64);
    res.json(result);
  } catch (error) {
    console.error('Error in /api/gemini/cylinder:', error);
    res.status(500).json({
      error: error instanceof Error ? error.message : 'Internal Server Error'
    });
  }
});
