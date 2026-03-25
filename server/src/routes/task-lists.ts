import { Router } from 'express';
import { supabaseAdmin } from '../lib/supabase.js';

const router = Router();

// Get all lists
router.get('/', async (_req, res) => {
  try {
    const { data, error } = await supabaseAdmin
      .from('task_lists')
      .select('*')
      .order('position', { ascending: true });

    if (error) throw error;
    res.json(data || []);
  } catch (error) {
    console.error('Get task lists error:', error);
    res.status(500).json({ error: 'Failed to fetch task lists' });
  }
});

// Get lists by space (lists not in any folder)
router.get('/space/:spaceId', async (req, res) => {
  try {
    const { spaceId } = req.params;
    const { data, error } = await supabaseAdmin
      .from('task_lists')
      .select('*')
      .eq('space_id', spaceId)
      .is('folder_id', null)
      .order('position', { ascending: true });

    if (error) throw error;
    res.json(data || []);
  } catch (error) {
    console.error('Get space lists error:', error);
    res.status(500).json({ error: 'Failed to fetch space lists' });
  }
});

// Get lists by folder
router.get('/folder/:folderId', async (req, res) => {
  try {
    const { folderId } = req.params;
    const { data, error } = await supabaseAdmin
      .from('task_lists')
      .select('*')
      .eq('folder_id', folderId)
      .order('position', { ascending: true });

    if (error) throw error;
    res.json(data || []);
  } catch (error) {
    console.error('Get folder lists error:', error);
    res.status(500).json({ error: 'Failed to fetch folder lists' });
  }
});

// Get all lists in a space (including those in folders)
router.get('/space/:spaceId/all', async (req, res) => {
  try {
    const { spaceId } = req.params;

    // Get lists directly in space
    const { data: directLists, error: directError } = await supabaseAdmin
      .from('task_lists')
      .select('*')
      .eq('space_id', spaceId)
      .order('position', { ascending: true });

    if (directError) throw directError;

    // Get folders in this space
    const { data: folders, error: foldersError } = await supabaseAdmin
      .from('folders')
      .select('id')
      .eq('space_id', spaceId);

    if (foldersError) throw foldersError;

    // Get lists in folders
    let folderLists: any[] = [];
    if (folders && folders.length > 0) {
      const folderIds = folders.map(f => f.id);
      const { data: listsInFolders, error: listsError } = await supabaseAdmin
        .from('task_lists')
        .select('*')
        .in('folder_id', folderIds)
        .order('position', { ascending: true });

      if (listsError) throw listsError;
      folderLists = listsInFolders || [];
    }

    res.json([...(directLists || []), ...folderLists]);
  } catch (error) {
    console.error('Get all space lists error:', error);
    res.status(500).json({ error: 'Failed to fetch space lists' });
  }
});

// Create a list
router.post('/', async (req, res) => {
  try {
    const { name, description, color, space_id, folder_id, owner_id } = req.body;

    if (!name) {
      return res.status(400).json({ error: 'Name is required' });
    }

    if (!space_id && !folder_id) {
      return res.status(400).json({ error: 'Either space_id or folder_id is required' });
    }

    // If folder_id is provided, get the space_id from the folder
    let actualSpaceId = space_id;
    if (folder_id && !space_id) {
      const { data: folder, error: folderError } = await supabaseAdmin
        .from('folders')
        .select('space_id')
        .eq('id', folder_id)
        .single();

      if (folderError) throw folderError;
      actualSpaceId = folder.space_id;
    }

    const { data, error } = await supabaseAdmin
      .from('task_lists')
      .insert({
        name,
        description: description || null,
        color: color || '#6366f1',
        space_id: actualSpaceId,
        folder_id: folder_id || null,
        owner_id: owner_id || null,
        position: 0
      })
      .select()
      .single();

    if (error) throw error;
    res.json(data);
  } catch (error) {
    console.error('Create task list error:', error);
    res.status(500).json({ error: 'Failed to create task list' });
  }
});

// Update a list
router.put('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { name, description, color, position } = req.body;

    const updateData: any = {};
    if (name !== undefined) updateData.name = name;
    if (description !== undefined) updateData.description = description;
    if (color !== undefined) updateData.color = color;
    if (position !== undefined) updateData.position = position;
    updateData.updated_at = new Date().toISOString();

    const { data, error } = await supabaseAdmin
      .from('task_lists')
      .update(updateData)
      .eq('id', id)
      .select()
      .single();

    if (error) throw error;
    res.json(data);
  } catch (error) {
    console.error('Update task list error:', error);
    res.status(500).json({ error: 'Failed to update task list' });
  }
});

// Delete a list
router.delete('/:id', async (req, res) => {
  try {
    const { id } = req.params;

    const { error } = await supabaseAdmin
      .from('task_lists')
      .delete()
      .eq('id', id);

    if (error) throw error;
    res.json({ message: 'List deleted successfully' });
  } catch (error) {
    console.error('Delete task list error:', error);
    res.status(500).json({ error: 'Failed to delete task list' });
  }
});

export default router;
