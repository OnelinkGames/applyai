import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import express from 'express';
import cors from 'cors';
import { initDatabase } from './db.js';
import { createRouter } from './routes/api.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.resolve(__dirname, '../../.env') });

const app = express();
const port = Number(process.env.PORT) || 3001;
const clientOrigin = process.env.CLIENT_ORIGIN || 'http://localhost:5173';

const db = initDatabase();

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

app.listen(port, () => {
  console.log(`Server running at http://localhost:${port}`);
});
