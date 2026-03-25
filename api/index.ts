import express from 'express';
import cors from 'cors';
import projectsRouter from '../server/src/routes/projects.js';
import tasksRouter from '../server/src/routes/tasks.js';
import aiRouter from '../server/src/routes/ai.js';
import membersRouter from '../server/src/routes/members.js';
import spaceMembersRouter from '../server/src/routes/space-members.js';
import taskListsRouter from '../server/src/routes/task-lists.js';
import customFieldsRouter from '../server/src/routes/custom-fields.js';
import sprintsRouter from '../server/src/routes/sprints.js';
import docsRouter from '../server/src/routes/docs.js';
import docPagesRouter from '../server/src/routes/doc-pages.js';
import formsRouter from '../server/src/routes/forms.js';
import formResponsesRouter from '../server/src/routes/form-responses.js';
import taskStatusesRouter from '../server/src/routes/task-statuses.js';

const app = express();

app.use(cors({ origin: true, credentials: true }));
app.use(express.json());

app.get('/health', (_req, res) => {
  res.json({ status: 'ok' });
});

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

app.use((err: Error, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  console.error('Unhandled error:', err);
  res.status(500).json({ error: 'Internal server error' });
});

export default app;
