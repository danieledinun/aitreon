import express from 'express';
import { config } from './config.js';
import { startWorker, stopWorker, runPollCycle } from './worker.js';
import { sessionManager } from './session-manager.js';

const app = express();
app.use(express.json());

const startTime = Date.now();

app.get('/health', (_req, res) => {
  res.json({
    status: 'ok',
    uptime: Math.floor((Date.now() - startTime) / 1000),
    activeSessions: sessionManager.activeSessionCount,
  });
});

app.post('/poll', async (req, res) => {
  // Verify API key for webhook trigger
  const apiKey = req.headers['x-api-key'];
  if (apiKey !== config.automationApiKey) {
    res.status(401).json({ error: 'Unauthorized' });
    return;
  }

  // Trigger immediate poll cycle (non-blocking)
  runPollCycle().catch(err => {
    console.error('[index] Triggered poll cycle error:', err);
  });

  res.json({ status: 'poll_triggered' });
});

const server = app.listen(config.port, () => {
  console.log(`[tandym-automation] Server listening on port ${config.port}`);
  startWorker();
});

// Graceful shutdown
async function shutdown(signal: string): Promise<void> {
  console.log(`[tandym-automation] Received ${signal}, shutting down...`);
  stopWorker();
  await sessionManager.closeAll();
  server.close(() => {
    console.log('[tandym-automation] Server closed');
    process.exit(0);
  });
  // Force exit after 10s if graceful shutdown hangs
  setTimeout(() => process.exit(1), 10000);
}

process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));
