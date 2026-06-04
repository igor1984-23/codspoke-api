// =============================================================================
// CodSpoke API — Main Server Entry
// =============================================================================

import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';

import { errorHandler } from './middleware/errorHandler.js';
import { authRouter } from './routes/auth.js';
import { projectsRouter } from './routes/projects.js';
import { paymentsRouter } from './routes/payments.js';
import { chatRouter } from './routes/chat.js';

const app = express();
const PORT = parseInt(process.env.PORT, 10) || 3000;

// Trust nginx reverse proxy (rate-limiter needs this behind nginx)
app.set('trust proxy', 1);

// ---------------------------------------------------------------------------
// Security & parsing middleware
// ---------------------------------------------------------------------------
app.use(helmet());
app.use(cors({
  origin: process.env.CORS_ORIGIN || '*',
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE'],
  allowedHeaders: ['Content-Type', 'Authorization'],
}));
app.use(express.json({ limit: '64kb' }));

// ---------------------------------------------------------------------------
// Global rate‑limiter (soft per‑IP)
// ---------------------------------------------------------------------------
const globalLimiter = rateLimit({
  windowMs: 60_000,        // 1 minute
  max: 120,                // 120 req/min per IP
  standardHeaders: true,
  legacyHeaders: false,
  validate: { xForwardedForHeader: false },
  message: { error: 'too_many_requests', detail: 'Slow down, cowboy.' },
});
app.use(globalLimiter);

// ---------------------------------------------------------------------------
// Routes
// ---------------------------------------------------------------------------
app.get('/', (_req, res) => res.redirect('/health'));

app.get('/health', (_req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

app.use('/v1/auth', authRouter);
app.use('/v1/projects', projectsRouter);
app.use('/v1/payments', paymentsRouter);
app.use('/v1/chat', chatRouter);

// ---------------------------------------------------------------------------
// Error handler (must be last)
// ---------------------------------------------------------------------------
app.use(errorHandler);

app.listen(PORT, () => {
  console.log(`[codspoke-api] listening on :${PORT}`);
});
