import express from 'express';
import cors from 'cors';

const app = express();

app.use(cors({ origin: true, credentials: true }));
app.use(express.json());

// Debug: check what env vars are available
app.get('/api/health', (_req, res) => {
  res.json({
    status: 'ok',
    env: {
      hasSupabaseUrl: !!process.env.SUPABASE_URL,
      hasSupabaseKey: !!process.env.SUPABASE_SERVICE_ROLE_KEY,
      nodeVersion: process.version
    }
  });
});

app.get('/api/test', (_req, res) => {
  res.json({ message: 'API is working!' });
});

// Try loading routes with detailed error reporting
app.all('/api/*', async (req, res) => {
  try {
    // Lazy-load routes on first request
    const membersModule = await import('../server/src/routes/members.js');
    const membersRouter = express.Router();
    membersRouter.use('/api/members', membersModule.default);
    membersRouter(req, res, () => {
      res.status(404).json({ error: 'Route not found', path: req.path });
    });
  } catch (err) {
    res.status(500).json({
      error: 'Failed to load route module',
      details: String(err),
      stack: err instanceof Error ? err.stack : undefined
    });
  }
});

export default app;
