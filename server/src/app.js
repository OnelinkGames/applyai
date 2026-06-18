import express from 'express';
import cors from 'cors';
import { createRouter } from './routes/api.js';

export function createApp(db, { clientOrigin = 'http://localhost:5173' } = {}) {
  const app = express();

  app.use(cors({ origin: clientOrigin }));
  app.use(express.json({ limit: '10mb' }));

  app.get('/api/health', (_req, res) => {
    res.json({ ok: true });
  });

  app.use('/api', createRouter(db));

  app.use((err, _req, res, _next) => {
    console.error(err);
    res.status(500).json({ error: 'Erro interno do servidor' });
  });

  return app;
}
