import { Router } from 'express';
import { supabaseAdmin } from '../lib/supabase.js';

const router = Router();

// ==================== Sprint Folders ====================

// Get all sprint folders
router.get('/folders', async (_req, res) => {
  try {
    const { data, error } = await supabaseAdmin
      .from('sprint_folders')
      .select('*')
      .order('created_at', { ascending: true });

    if (error) throw error;
    res.json(data || []);
  } catch (error) {
    console.error('Get sprint folders error:', error);
    res.status(500).json({ error: 'Failed to fetch sprint folders' });
  }
});

// Get sprint folders by space
router.get('/folders/space/:spaceId', async (req, res) => {
  try {
    const { spaceId } = req.params;
    const { data, error } = await supabaseAdmin
      .from('sprint_folders')
      .select('*')
      .eq('space_id', spaceId)
      .order('created_at', { ascending: true });

    if (error) throw error;
    res.json(data || []);
  } catch (error) {
    console.error('Get space sprint folders error:', error);
    res.status(500).json({ error: 'Failed to fetch sprint folders' });
  }
});

// Create a sprint folder (auto-creates Sprint 1 + Backlog list)
router.post('/folders', async (req, res) => {
  try {
    const { name, space_id, default_duration, owner_id, folder_id } = req.body;

    if (!space_id) {
      return res.status(400).json({ error: 'space_id is required' });
    }

    // Create the sprint folder
    const { data: folder, error: folderError } = await supabaseAdmin
      .from('sprint_folders')
      .insert({
        name: name || 'Sprints',
        space_id,
        default_duration: default_duration || 14,
        owner_id: owner_id || null
      })
      .select()
      .single();

    if (folderError) throw folderError;

    // Auto-create Sprint 1
    const today = new Date();
    const endDate = new Date(today);
    endDate.setDate(endDate.getDate() + (default_duration || 14));

    const sprintInsert: Record<string, unknown> = {
      name: 'Sprint 1',
      sprint_folder_id: folder.id,
      space_id,
      start_date: today.toISOString().split('T')[0],
      end_date: endDate.toISOString().split('T')[0],
      position: 0,
      owner_id: owner_id || null
    };
    if (folder_id) sprintInsert.folder_id = folder_id;

    const { data: sprint, error: sprintError } = await supabaseAdmin
      .from('sprints')
      .insert(sprintInsert)
      .select()
      .single();

    if (sprintError) throw sprintError;

    // Auto-create Backlog task list
    const { data: backlog, error: backlogError } = await supabaseAdmin
      .from('task_lists')
      .insert({
        name: 'Backlog',
        space_id,
        folder_id: null,
        color: '#6b7280',
        position: 0,
        owner_id: owner_id || null
      })
      .select()
      .single();

    if (backlogError) {
      console.error('Backlog creation error:', backlogError);
    }

    res.json({
      folder,
      sprint,
      backlog: backlog || null
    });
  } catch (error) {
    console.error('Create sprint folder error:', error);
    res.status(500).json({ error: 'Failed to create sprint folder' });
  }
});

// Update a sprint folder
router.put('/folders/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { name, default_duration } = req.body;

    const updateData: Record<string, unknown> = {};
    if (name !== undefined) updateData.name = name;
    if (default_duration !== undefined) updateData.default_duration = default_duration;

    const { data, error } = await supabaseAdmin
      .from('sprint_folders')
      .update(updateData)
      .eq('id', id)
      .select()
      .single();

    if (error) throw error;
    res.json(data);
  } catch (error) {
    console.error('Update sprint folder error:', error);
    res.status(500).json({ error: 'Failed to update sprint folder' });
  }
});

// Delete a sprint folder
router.delete('/folders/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { error } = await supabaseAdmin
      .from('sprint_folders')
      .delete()
      .eq('id', id);

    if (error) throw error;
    res.json({ message: 'Sprint folder deleted successfully' });
  } catch (error) {
    console.error('Delete sprint folder error:', error);
    res.status(500).json({ error: 'Failed to delete sprint folder' });
  }
});

// ==================== Sprints ====================

// Get sprints by sprint folder
router.get('/folder/:folderId', async (req, res) => {
  try {
    const { folderId } = req.params;
    const { data, error } = await supabaseAdmin
      .from('sprints')
      .select('*')
      .eq('sprint_folder_id', folderId)
      .order('position', { ascending: true });

    if (error) throw error;
    res.json(data || []);
  } catch (error) {
    console.error('Get sprints error:', error);
    res.status(500).json({ error: 'Failed to fetch sprints' });
  }
});

// Get all sprints (optionally by space)
router.get('/', async (req, res) => {
  try {
    const { space_id } = req.query;
    let query = supabaseAdmin
      .from('sprints')
      .select('*')
      .order('position', { ascending: true });

    if (space_id) {
      query = query.eq('space_id', space_id as string);
    }

    const { data, error } = await query;
    if (error) throw error;
    res.json(data || []);
  } catch (error) {
    console.error('Get all sprints error:', error);
    res.status(500).json({ error: 'Failed to fetch sprints' });
  }
});

// Create a new sprint
router.post('/', async (req, res) => {
  try {
    const { name, sprint_folder_id, space_id, start_date, end_date, owner_id, folder_id } = req.body;

    if (!sprint_folder_id || !space_id || !start_date || !end_date) {
      return res.status(400).json({ error: 'sprint_folder_id, space_id, start_date, and end_date are required' });
    }

    // Get the next position
    const { data: existing, error: existingError } = await supabaseAdmin
      .from('sprints')
      .select('position')
      .eq('sprint_folder_id', sprint_folder_id)
      .order('position', { ascending: false })
      .limit(1);

    if (existingError) throw existingError;
    const nextPosition = existing && existing.length > 0 ? existing[0].position + 1 : 0;

    // Auto-generate name if not provided
    const sprintName = name || `Sprint ${nextPosition + 1}`;

    const insertData: Record<string, unknown> = {
      name: sprintName,
      sprint_folder_id,
      space_id,
      start_date,
      end_date,
      position: nextPosition,
      owner_id: owner_id || null
    };
    if (folder_id) insertData.folder_id = folder_id;

    const { data, error } = await supabaseAdmin
      .from('sprints')
      .insert(insertData)
      .select()
      .single();

    if (error) throw error;
    res.json(data);
  } catch (error) {
    console.error('Create sprint error:', error);
    res.status(500).json({ error: 'Failed to create sprint' });
  }
});

// Update a sprint
router.put('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { name, start_date, end_date, position } = req.body;

    const updateData: Record<string, unknown> = {};
    if (name !== undefined) updateData.name = name;
    if (start_date !== undefined) updateData.start_date = start_date;
    if (end_date !== undefined) updateData.end_date = end_date;
    if (position !== undefined) updateData.position = position;

    const { data, error } = await supabaseAdmin
      .from('sprints')
      .update(updateData)
      .eq('id', id)
      .select()
      .single();

    if (error) throw error;
    res.json(data);
  } catch (error) {
    console.error('Update sprint error:', error);
    res.status(500).json({ error: 'Failed to update sprint' });
  }
});

// Delete a sprint
router.delete('/:id', async (req, res) => {
  try {
    const { id } = req.params;

    // Unlink tasks from this sprint (set sprint_id to null)
    await supabaseAdmin
      .from('lists')
      .update({ sprint_id: null })
      .eq('sprint_id', id);

    const { error } = await supabaseAdmin
      .from('sprints')
      .delete()
      .eq('id', id);

    if (error) throw error;
    res.json({ message: 'Sprint deleted successfully' });
  } catch (error) {
    console.error('Delete sprint error:', error);
    res.status(500).json({ error: 'Failed to delete sprint' });
  }
});

// Rollover: Move unfinished tasks from this sprint to the next sprint
router.post('/:id/rollover', async (req, res) => {
  try {
    const { id } = req.params;
    const { target_sprint_id } = req.body;

    if (!target_sprint_id) {
      return res.status(400).json({ error: 'target_sprint_id is required' });
    }

    // Get all unfinished tasks in this sprint
    const { data: unfinishedTasks, error: tasksError } = await supabaseAdmin
      .from('lists')
      .select('id, name, status')
      .eq('sprint_id', id)
      .neq('status', 'Done');

    if (tasksError) throw tasksError;

    if (!unfinishedTasks || unfinishedTasks.length === 0) {
      return res.json({ message: 'No unfinished tasks to roll over', moved: 0 });
    }

    // Move tasks to target sprint
    const taskIds = unfinishedTasks.map(t => t.id);
    const { error: updateError } = await supabaseAdmin
      .from('lists')
      .update({ sprint_id: target_sprint_id })
      .in('id', taskIds);

    if (updateError) throw updateError;

    res.json({
      message: `Rolled over ${unfinishedTasks.length} tasks`,
      moved: unfinishedTasks.length,
      tasks: unfinishedTasks
    });
  } catch (error) {
    console.error('Sprint rollover error:', error);
    res.status(500).json({ error: 'Failed to rollover sprint tasks' });
  }
});

export default router;
