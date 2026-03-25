import { Router } from 'express';
import { supabaseAdmin } from '../lib/supabase.js';

const router = Router();

// Get all forms
router.get('/', async (_req, res) => {
  try {
    const { data, error } = await supabaseAdmin
      .from('forms')
      .select('*')
      .order('updated_at', { ascending: false });

    if (error) throw error;
    res.json(data || []);
  } catch (error) {
    console.error('Get forms error:', error);
    res.status(500).json({ error: 'Failed to fetch forms' });
  }
});

// Get forms by space (not in any folder)
router.get('/space/:spaceId', async (req, res) => {
  try {
    const { spaceId } = req.params;
    const { data, error } = await supabaseAdmin
      .from('forms')
      .select('*')
      .eq('space_id', spaceId)
      .is('folder_id', null)
      .order('updated_at', { ascending: false });

    if (error) throw error;
    res.json(data || []);
  } catch (error) {
    console.error('Get space forms error:', error);
    res.status(500).json({ error: 'Failed to fetch space forms' });
  }
});

// Get forms by folder
router.get('/folder/:folderId', async (req, res) => {
  try {
    const { folderId } = req.params;
    const { data, error } = await supabaseAdmin
      .from('forms')
      .select('*')
      .eq('folder_id', folderId)
      .order('updated_at', { ascending: false });

    if (error) throw error;
    res.json(data || []);
  } catch (error) {
    console.error('Get folder forms error:', error);
    res.status(500).json({ error: 'Failed to fetch folder forms' });
  }
});

// Get single form
router.get('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { data, error } = await supabaseAdmin
      .from('forms')
      .select('*')
      .eq('id', id)
      .single();

    if (error) throw error;
    res.json(data);
  } catch (error) {
    console.error('Get form error:', error);
    res.status(500).json({ error: 'Failed to fetch form' });
  }
});

// Create a form
router.post('/', async (req, res) => {
  try {
    const { name, description, space_id, folder_id, list_id, owner_id, status, fields, template_type, settings, is_published, cover_color } = req.body;

    if (!name) {
      return res.status(400).json({ error: 'Name is required' });
    }

    if (!space_id && !folder_id && !list_id) {
      return res.status(400).json({ error: 'Either space_id, folder_id, or list_id is required' });
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

    // If list_id is provided, get the space_id from the list
    if (list_id && !space_id && !folder_id) {
      const { data: list, error: listError } = await supabaseAdmin
        .from('task_lists')
        .select('space_id, folder_id')
        .eq('id', list_id)
        .single();

      if (listError) throw listError;
      actualSpaceId = list.space_id;
    }

    const insertData: any = {
      name,
      description: description || null,
      space_id: actualSpaceId,
      folder_id: folder_id || null,
      owner_id: owner_id || null,
      status: status || 'active',
      fields: fields || []
    };

    // Add enhanced fields if provided
    if (list_id !== undefined) insertData.list_id = list_id;
    if (template_type !== undefined) insertData.template_type = template_type;
    if (settings !== undefined) insertData.settings = settings;
    if (is_published !== undefined) insertData.is_published = is_published;
    if (cover_color !== undefined) insertData.cover_color = cover_color;

    const { data, error } = await supabaseAdmin
      .from('forms')
      .insert(insertData)
      .select()
      .single();

    if (error) {
      // If enhanced columns don't exist, retry with basic fields
      if (error.message?.includes('column')) {
        const { data: retryData, error: retryError } = await supabaseAdmin
          .from('forms')
          .insert({
            name,
            description: description || null,
            space_id: actualSpaceId,
            folder_id: folder_id || null,
            owner_id: owner_id || null,
            status: status || 'active',
            fields: fields || []
          })
          .select()
          .single();
        if (retryError) throw retryError;
        return res.json(retryData);
      }
      throw error;
    }
    res.json(data);
  } catch (error) {
    console.error('Create form error:', error);
    res.status(500).json({ error: 'Failed to create form' });
  }
});

// Update a form
router.put('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { name, description, status, fields, space_id, folder_id, list_id, template_type, settings, is_published, cover_color, last_viewed_at, custom_statuses, status_settings } = req.body;

    const updateData: any = {};
    if (name !== undefined) updateData.name = name;
    if (description !== undefined) updateData.description = description;
    if (status !== undefined) updateData.status = status;
    if (fields !== undefined) updateData.fields = fields;
    if (space_id !== undefined) updateData.space_id = space_id;
    if (folder_id !== undefined) updateData.folder_id = folder_id;
    if (list_id !== undefined) updateData.list_id = list_id;
    if (template_type !== undefined) updateData.template_type = template_type;
    if (settings !== undefined) updateData.settings = settings;
    if (is_published !== undefined) updateData.is_published = is_published;
    if (cover_color !== undefined) updateData.cover_color = cover_color;
    if (last_viewed_at !== undefined) updateData.last_viewed_at = last_viewed_at;
    if (custom_statuses !== undefined) updateData.custom_statuses = custom_statuses;
    if (status_settings !== undefined) updateData.status_settings = status_settings;
    updateData.updated_at = new Date().toISOString();

    const { data, error } = await supabaseAdmin
      .from('forms')
      .update(updateData)
      .eq('id', id)
      .select()
      .single();

    if (error) {
      // If enhanced columns don't exist, retry with basic fields
      if (error.message?.includes('column')) {
        const baseUpdate: any = {};
        if (name !== undefined) baseUpdate.name = name;
        if (description !== undefined) baseUpdate.description = description;
        if (status !== undefined) baseUpdate.status = status;
        if (fields !== undefined) baseUpdate.fields = fields;
        baseUpdate.updated_at = new Date().toISOString();

        const { data: retryData, error: retryError } = await supabaseAdmin
          .from('forms')
          .update(baseUpdate)
          .eq('id', id)
          .select()
          .single();
        if (retryError) throw retryError;
        return res.json(retryData);
      }
      throw error;
    }
    res.json(data);
  } catch (error) {
    console.error('Update form error:', error);
    res.status(500).json({ error: 'Failed to update form' });
  }
});

// Delete a form
router.delete('/:id', async (req, res) => {
  try {
    const { id } = req.params;

    const { error } = await supabaseAdmin
      .from('forms')
      .delete()
      .eq('id', id);

    if (error) throw error;
    res.json({ message: 'Form deleted successfully' });
  } catch (error) {
    console.error('Delete form error:', error);
    res.status(500).json({ error: 'Failed to delete form' });
  }
});

export default router;
