import express from 'express';
import cors from 'cors';
import projectsRouter from './routes/projects.js';
import tasksRouter from './routes/tasks.js';
import aiRouter from './routes/ai.js';
import membersRouter from './routes/members.js';
import spaceMembersRouter from './routes/space-members.js';
import taskListsRouter from './routes/task-lists.js';
import customFieldsRouter from './routes/custom-fields.js';
import sprintsRouter from './routes/sprints.js';
import docsRouter from './routes/docs.js';
import docPagesRouter from './routes/doc-pages.js';
import formsRouter from './routes/forms.js';
import formResponsesRouter from './routes/form-responses.js';
import taskStatusesRouter from './routes/task-statuses.js';

const app = express();

// Middleware
const allowedOrigins = (process.env.ALLOWED_ORIGINS || '')
  .split(',')
  .map(origin => origin.trim())
  .filter(Boolean);

app.use(cors({
  origin: (origin, callback) => {
    if (!origin) return callback(null, true);
    if (allowedOrigins.length === 0) return callback(null, true);
    if (allowedOrigins.includes(origin)) return callback(null, true);
    return callback(new Error('Not allowed by CORS'));
  },
  credentials: true
}));
app.use(express.json());

// Health check
app.get('/health', (_req, res) => {
  res.json({ status: 'ok' });
});

// API Routes
app.use('/api/projects', projectsRouter);
app.use('/api', tasksRouter);
app.use('/api/ai', aiRouter);
app.use('/api/members', membersRouter);
app.use('/api/space-members', spaceMembersRouter);
app.use('/api/task-lists', taskListsRouter);
app.use('/api/custom-fields', customFieldsRouter);
app.use('/api/sprints', sprintsRouter);
app.use('/api/docs', docsRouter);
app.use('/api/doc-pages', docPagesRouter);
app.use('/api/forms', formsRouter);
app.use('/api/form-responses', formResponsesRouter);
app.use('/api/task-statuses', taskStatusesRouter);

// Error handling
app.use((err: Error, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  console.error('Unhandled error:', err);
  res.status(500).json({ error: 'Internal server error' });
});

export default app;
