import { Router } from 'express';
import { z } from 'zod';
import { AuthRequest, authMiddleware } from '../middleware/auth.js';

const router = Router();

const taskStatusEnum = z.enum(['TODO', 'IN_PROGRESS', 'IN_REVIEW', 'DONE']);
const taskPriorityEnum = z.enum(['LOW', 'MEDIUM', 'HIGH', 'URGENT']);

const createTaskSchema = z.object({
  title: z.string().min(1).max(200),
  description: z.string().max(2000).optional(),
  status: taskStatusEnum.optional().default('TODO'),
  priority: taskPriorityEnum.optional().default('MEDIUM'),
  due_date: z.string().datetime().optional()
});

const updateTaskSchema = z.object({
  title: z.string().min(1).max(200).optional(),
  description: z.string().max(2000).optional().nullable(),
  status: taskStatusEnum.optional(),
  priority: taskPriorityEnum.optional(),
  due_date: z.string().datetime().optional().nullable(),
  position: z.number().int().min(0).optional()
});

// Get all tasks for a project
router.get('/projects/:projectId/tasks', authMiddleware, async (req: AuthRequest, res) => {
  try {
    const { data, error } = await req.supabase!
      .from('tasks')
      .select('*')
      .eq('project_id', req.params.projectId)
      .order('position', { ascending: true });

    if (error) throw error;
    res.json(data);
  } catch (error) {
    console.error('Error fetching tasks:', error);
    res.status(500).json({ error: 'Failed to fetch tasks' });
  }
});

// Create a new task
router.post('/projects/:projectId/tasks', authMiddleware, async (req: AuthRequest, res) => {
  try {
    const validated = createTaskSchema.parse(req.body);

    // Get max position for the status
    const { data: existingTasks } = await req.supabase!
      .from('tasks')
      .select('position')
      .eq('project_id', req.params.projectId)
      .eq('status', validated.status)
      .order('position', { ascending: false })
      .limit(1);

    const maxPosition = existingTasks && existingTasks.length > 0 ? (existingTasks[0] as any).position : -1;

    const { data, error } = await req.supabase!
      .from('tasks')
      .insert({
        ...validated,
        project_id: req.params.projectId,
        assignee_id: req.user!.id,
        position: maxPosition + 1
      } as any)
      .select()
      .single();

    if (error) throw error;
    res.status(201).json(data);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: error.errors });
    }
    console.error('Error creating task:', error);
    res.status(500).json({ error: 'Failed to create task' });
  }
});

// Update a task
router.put('/tasks/:id', authMiddleware, async (req: AuthRequest, res) => {
  try {
    const validated = updateTaskSchema.parse(req.body);

    const { data, error } = await req.supabase!
      .from('tasks')
      .update(validated as any)
      .eq('id', req.params.id)
      .select()
      .single();

    if (error) throw error;
    res.json(data);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: error.errors });
    }
    console.error('Error updating task:', error);
    res.status(500).json({ error: 'Failed to update task' });
  }
});

// Delete a task
router.delete('/tasks/:id', authMiddleware, async (req: AuthRequest, res) => {
  try {
    const { error } = await req.supabase!
      .from('tasks')
      .delete()
      .eq('id', req.params.id);

    if (error) throw error;
    res.status(204).send();
  } catch (error) {
    console.error('Error deleting task:', error);
    res.status(500).json({ error: 'Failed to delete task' });
  }
});

export default router;
