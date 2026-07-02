import express from 'express';
import 'express-async-errors';
import dotenv from 'dotenv';
import { AppError } from './factory/error';
import Database from './singleton/database';
import MinioStorage from './singleton/minio';
import './models/associations'; 
import UserDAO from './dao/UserDAO';
import authRoutes from './routes/auth';
import userRoutes from './routes/users';
import regulationRoutes from './routes/regulations';
import documentRoutes from './routes/documents';
import analysesRoutes from './routes/analyses';
import reportsRoutes from './routes/reports';

dotenv.config();

const app = express();

// Variabile utilizzata per fornire 10 token ogni 6h
const TOKEN_REFILL = 6 * 60 * 60 * 1000; 

// Rimuove l'header X-Powered-By
app.disable('x-powered-by');
app.use(express.json());

// Rotte
app.use('/auth', authRoutes);
app.use('/regulations', regulationRoutes);
app.use('/users', userRoutes);
app.use('/documents', documentRoutes);
app.use('/analyses', analysesRoutes);
app.use('/reports', reportsRoutes);

// Gestione centralizzata degli errori non catturati nei controller async
app.use((err: Error, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  console.error('Unhandled error:', err.message);
  if (err instanceof AppError) {
    return res.status(err.status).json({ success: false, error: err.message });
  }
  res.status(500).json({ success: false, error: 'Errore interno del server' });
});


export async function initializeServices(): Promise<void> {
  await Database.getInstance().authenticate();
  await Database.getInstance().sync();
  await Database.getInstance().query(
    `ALTER TABLE users ADD COLUMN IF NOT EXISTS tokens INTEGER NOT NULL DEFAULT 100;`
  );
  await MinioStorage.ensureBuckets();

  setInterval(async () => {
    await UserDAO.refillTokens();
    console.log(`Assegnazione token completata`);
  }, TOKEN_REFILL);
}

export default app;