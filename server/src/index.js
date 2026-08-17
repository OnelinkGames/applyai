import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import { initDatabase } from './db.js';
import { createApp } from './app.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.resolve(__dirname, '../../.env') });

const port = Number(process.env.BACKEND_PORT) || 3001;
const frontendPort = Number(process.env.FRONTEND_PORT) || 5173;
const clientOrigin = process.env.CLIENT_ORIGIN || `http://localhost:${frontendPort}`;

const db = initDatabase();
const app = createApp(db, { clientOrigin });

app.listen(port, () => {
  console.log(`Server running at http://localhost:${port}`);
});
