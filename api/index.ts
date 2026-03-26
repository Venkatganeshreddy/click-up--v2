import express from 'express';
import cors from 'cors';
import { createClient } from '@supabase/supabase-js';

const app = express();

app.use(cors({ origin: true, credentials: true }));
app.use(express.json());

// Initialize Supabase admin client
const supabaseUrl = process.env.SUPABASE_URL || '';
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || '';
const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey);

// Import and mount all routes
async function setupRoutes() {
  try {
    const projectsModule = await import('../server/src/routes/projects.js');
    const tasksModule = await import('../server/src/routes/tasks.js');
    const aiModule = await import('../server/src/routes/ai.js');
    const membersModule = await import('../server/src/routes/members.js');
    const spaceMembersModule = await import('../server/src/routes/space-members.js');
    const taskListsModule = await import('../server/src/routes/task-lists.js');
    const customFieldsModule = await import('../server/src/routes/custom-fields.js');
    const sprintsModule = await import('../server/src/routes/sprints.js');
    const docsModule = await import('../server/src/routes/docs.js');
    const docPagesModule = await import('../server/src/routes/doc-pages.js');
    const formsModule = await import('../server/src/routes/forms.js');
    const formResponsesModule = await import('../server/src/routes/form-responses.js');
    const taskStatusesModule = await import('../server/src/routes/task-statuses.js');

    app.use('/api/projects', projectsModule.default);
    app.use('/api', tasksModule.default);
    app.use('/api/ai', aiModule.default);
    app.use('/api/members', membersModule.default);
    app.use('/api/space-members', spaceMembersModule.default);
    app.use('/api/task-lists', taskListsModule.default);
    app.use('/api/custom-fields', customFieldsModule.default);
    app.use('/api/sprints', sprintsModule.default);
    app.use('/api/docs', docsModule.default);
    app.use('/api/doc-pages', docPagesModule.default);
    app.use('/api/forms', formsModule.default);
    app.use('/api/form-responses', formResponsesModule.default);
    app.use('/api/task-statuses', taskStatusesModule.default);
  } catch (err) {
    console.error('Failed to load routes:', err);
    app.use('/api', (_req, res) => {
      res.status(500).json({ error: 'Failed to load routes', details: String(err) });
    });
  }
}

const routesReady = setupRoutes();

// Wait for routes to be loaded before handling any request
app.use(async (_req, _res, next) => {
  await routesReady;
  next();
});

// Health check
app.get('/api/health', (_req, res) => {
  res.json({ status: 'ok', env: { hasUrl: !!supabaseUrl, hasKey: !!supabaseServiceKey } });
});

// Debug route - test if function works
app.get('/api/test', (_req, res) => {
  res.json({ message: 'API is working!' });
});

export default app;
