import { Router } from 'express';
import { metricsRegistry } from '../lib/metrics';
import { createLogger } from '../lib/logger';

const router = Router();
const logger = createLogger();

router.get('/metrics', async (req, res) => {
  try {
    const metrics = await metricsRegistry.metrics();
    res.set('Content-Type', metricsRegistry.contentType);
    res.send(metrics);
  } catch (error) {
    logger.error('Error generating metrics', error);
    res.status(500).json({ error: 'Failed to generate metrics' });
  }
});

export default router;
