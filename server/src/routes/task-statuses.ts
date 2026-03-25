import { Router } from 'express';
import { supabaseAdmin } from '../lib/supabase.js';

const router = Router();

// Default statuses for new scopes (status_group is optional now)
const defaultStatuses = [
  { name: 'TO DO', color: '#6b7280', position: 0 },
  { name: 'IN PROGRESS', color: '#3b82f6', position: 1 },
  { name: 'REVIEW', color: '#f59e0b', position: 2 },
  { name: 'DONE', color: '#22c55e', position: 3 }
];

// =============================================
// STRICT ISOLATION: Each scope has its own statuses
// No inheritance between space/folder/list/sprint
// =============================================

// Get statuses for a SPACE (space-level only, no folder/list)
router.get('/space/:spaceId', async (req, res) => {
  try {
    const { spaceId } = req.params;

    // Get ONLY space-level statuses (where folder_id, list_id, and sprint_id are null)
    let { data, error } = await supabaseAdmin
      .from('task_statuses')
      .select('*')
      .eq('space_id', spaceId)
      .is('folder_id', null)
      .is('list_id', null)
      .is('sprint_id', null)
      .order('position', { ascending: true });

    if (error) {
      if (error.code === '42P01') {
        return res.json([]);
      }
      throw error;
    }

    // Return statuses or empty array
    res.json(data || []);
  } catch (error: any) {
    console.error('Get space statuses error:', error);
    res.json([]);
  }
});

// Get statuses for a FOLDER (folder-level only, no inheritance)
router.get('/folder/:folderId', async (req, res) => {
  try {
    const { folderId } = req.params;

    // Get ONLY folder-level statuses (where list_id and sprint_id are null)
    const { data, error } = await supabaseAdmin
      .from('task_statuses')
      .select('*')
      .eq('folder_id', folderId)
      .is('list_id', null)
      .is('sprint_id', null)
      .order('position', { ascending: true });

    if (error) {
      if (error.code === '42P01') {
        return res.json([]);
      }
      throw error;
    }

    // Return folder statuses only - NO INHERITANCE
    res.json(data || []);
  } catch (error: any) {
    console.error('Get folder statuses error:', error);
    res.json([]);
  }
});

// Get statuses for a LIST (list-level only, no inheritance)
router.get('/list/:listId', async (req, res) => {
  try {
    const { listId } = req.params;

    // Get ONLY list-level statuses (where sprint_id is null)
    const { data, error } = await supabaseAdmin
      .from('task_statuses')
      .select('*')
      .eq('list_id', listId)
      .is('sprint_id', null)
      .order('position', { ascending: true });

    if (error) {
      if (error.code === '42P01') {
        return res.json([]);
      }
      throw error;
    }

    // Return list statuses only - NO INHERITANCE
    res.json(data || []);
  } catch (error: any) {
    console.error('Get list statuses error:', error);
    res.json([]);
  }
});

// Get statuses for a SPRINT (sprint-level only, no inheritance)
router.get('/sprint/:sprintId', async (req, res) => {
  try {
    const { sprintId } = req.params;

    // Get ONLY sprint-level statuses
    const { data, error } = await supabaseAdmin
      .from('task_statuses')
      .select('*')
      .eq('sprint_id', sprintId)
      .order('position', { ascending: true });

    if (error) {
      if (error.code === '42P01' || error.code === '42703') {
        // Table doesn't exist or column doesn't exist
        return res.json([]);
      }
      throw error;
    }

    // Return sprint statuses only - NO INHERITANCE
    res.json(data || []);
  } catch (error: any) {
    console.error('Get sprint statuses error:', error);
    res.json([]);
  }
});

// Get statuses for a FORM (form has its own statuses in custom_statuses column)
router.get('/form/:formId', async (req, res) => {
  try {
    const { formId } = req.params;

    // Get form to check custom_statuses
    const { data: form } = await supabaseAdmin
      .from('forms')
      .select('space_id, custom_statuses, status_settings')
      .eq('id', formId)
      .single();

    if (!form) {
      return res.json([]);
    }

    // If form has custom statuses, use them
    if (form.custom_statuses && Array.isArray(form.custom_statuses) && form.custom_statuses.length > 0) {
      return res.json(form.custom_statuses);
    }

    // Check status_settings for inheritance preference
    const statusSettings = form.status_settings || { inherit_from_space: true };

    // If explicitly NOT inheriting, return empty (form manages its own)
    if (!statusSettings.inherit_from_space) {
      return res.json([]);
    }

    // If inheriting from space, get space statuses
    if (form.space_id) {
      const { data: spaceStatuses } = await supabaseAdmin
        .from('task_statuses')
        .select('*')
        .eq('space_id', form.space_id)
        .is('folder_id', null)
        .is('list_id', null)
        .is('sprint_id', null)
        .order('position', { ascending: true });

      if (spaceStatuses && spaceStatuses.length > 0) {
        return res.json(spaceStatuses);
      }
    }

    // Return empty array
    res.json([]);
  } catch (error: any) {
    console.error('Get form statuses error:', error);
    res.json([]);
  }
});

// Create status
router.post('/', async (req, res) => {
  try {
    const { name, color, status_group, position, space_id, folder_id, list_id, sprint_id } = req.body;

    if (!name) {
      return res.status(400).json({ error: 'Name is required' });
    }

    // Ensure only ONE scope is set (strict isolation)
    let scopeCount = 0;
    if (space_id) scopeCount++;
    if (folder_id) scopeCount++;
    if (list_id) scopeCount++;
    if (sprint_id) scopeCount++;

    if (scopeCount !== 1) {
      return res.status(400).json({ error: 'Exactly one scope (space_id, folder_id, list_id, or sprint_id) must be provided' });
    }

    const { data, error } = await supabaseAdmin
      .from('task_statuses')
      .insert({
        name,
        color: color || '#6b7280',
        status_group: status_group || null, // Optional - no forced categorization
        position: position || 0,
        space_id: space_id || null,
        folder_id: folder_id || null,
        list_id: list_id || null,
        sprint_id: sprint_id || null
      })
      .select()
      .single();

    if (error) throw error;
    res.json(data);
  } catch (error: any) {
    console.error('Create status error:', error);
    res.status(500).json({ error: 'Failed to create status' });
  }
});

// Update status
router.put('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { name, color, status_group, position } = req.body;

    const updateData: any = {};
    if (name !== undefined) updateData.name = name;
    if (color !== undefined) updateData.color = color;
    if (status_group !== undefined) updateData.status_group = status_group;
    if (position !== undefined) updateData.position = position;
    updateData.updated_at = new Date().toISOString();

    const { data, error } = await supabaseAdmin
      .from('task_statuses')
      .update(updateData)
      .eq('id', id)
      .select()
      .single();

    if (error) throw error;
    res.json(data);
  } catch (error: any) {
    console.error('Update status error:', error);
    res.status(500).json({ error: 'Failed to update status' });
  }
});

// Delete status
router.delete('/:id', async (req, res) => {
  try {
    const { id } = req.params;

    const { error } = await supabaseAdmin
      .from('task_statuses')
      .delete()
      .eq('id', id);

    if (error) throw error;
    res.json({ message: 'Status deleted successfully' });
  } catch (error: any) {
    console.error('Delete status error:', error);
    res.status(500).json({ error: 'Failed to delete status' });
  }
});

// Bulk update statuses - STRICT ISOLATION
// Only affects statuses for the specified scope
router.put('/bulk/update', async (req, res) => {
  try {
    const { statuses, space_id, folder_id, list_id, sprint_id, form_id } = req.body;

    if (!statuses || !Array.isArray(statuses)) {
      return res.status(400).json({ error: 'Statuses array is required' });
    }

    // Handle FORM statuses (stored in forms table)
    if (form_id) {
      const { data, error } = await supabaseAdmin
        .from('forms')
        .update({
          custom_statuses: statuses,
          status_settings: { inherit_from_space: false },
          updated_at: new Date().toISOString()
        })
        .eq('id', form_id)
        .select()
        .single();

      if (error) throw error;
      return res.json({ message: 'Form statuses updated', form: data });
    }

    // Count scopes - exactly one must be provided
    let scopeCount = 0;
    if (space_id) scopeCount++;
    if (folder_id) scopeCount++;
    if (list_id) scopeCount++;
    if (sprint_id) scopeCount++;

    if (scopeCount !== 1) {
      return res.status(400).json({ error: 'Exactly one scope must be provided for strict isolation' });
    }

    // Delete existing statuses ONLY for this specific scope
    if (space_id) {
      // Delete ONLY space-level statuses (where folder_id, list_id, and sprint_id are null)
      const { error: deleteError } = await supabaseAdmin
        .from('task_statuses')
        .delete()
        .eq('space_id', space_id)
        .is('folder_id', null)
        .is('list_id', null)
        .is('sprint_id', null);
      if (deleteError) throw deleteError;
    } else if (folder_id) {
      // Delete ONLY folder-level statuses (where list_id and sprint_id are null)
      const { error: deleteError } = await supabaseAdmin
        .from('task_statuses')
        .delete()
        .eq('folder_id', folder_id)
        .is('list_id', null)
        .is('sprint_id', null);
      if (deleteError) throw deleteError;
    } else if (list_id) {
      // Delete ONLY list-level statuses (where sprint_id is null)
      const { error: deleteError } = await supabaseAdmin
        .from('task_statuses')
        .delete()
        .eq('list_id', list_id)
        .is('sprint_id', null);
      if (deleteError) throw deleteError;
    } else if (sprint_id) {
      // Delete ONLY sprint-level statuses
      const { error: deleteError } = await supabaseAdmin
        .from('task_statuses')
        .delete()
        .eq('sprint_id', sprint_id);
      if (deleteError) throw deleteError;
    }

    // Insert new statuses with ONLY the specified scope
    // Don't include id field - let the database generate UUIDs
    const insertData = statuses.map((s: any, index: number) => {
      const statusData: any = {
        name: s.name,
        color: s.color || '#6b7280',
        status_group: s.status_group || null, // Optional - no forced categorization
        position: index,
        space_id: space_id || null,
        folder_id: folder_id || null,
        list_id: list_id || null,
        sprint_id: sprint_id || null
      };
      // Only include existing valid UUIDs (not temp IDs like 'status-xxx')
      if (s.id && !s.id.startsWith('status-') && !s.id.startsWith('temp-')) {
        statusData.id = s.id;
      }
      return statusData;
    });

    const { data, error } = await supabaseAdmin
      .from('task_statuses')
      .insert(insertData)
      .select();

    if (error) throw error;
    res.json(data);
  } catch (error: any) {
    console.error('Bulk update statuses error:', error);
    res.status(500).json({ error: 'Failed to update statuses' });
  }
});

// Initialize default statuses for a scope
router.post('/initialize', async (req, res) => {
  try {
    const { space_id, folder_id, list_id, sprint_id } = req.body;

    // Count scopes - exactly one must be provided
    let scopeCount = 0;
    if (space_id) scopeCount++;
    if (folder_id) scopeCount++;
    if (list_id) scopeCount++;
    if (sprint_id) scopeCount++;

    if (scopeCount !== 1) {
      return res.status(400).json({ error: 'Exactly one scope must be provided' });
    }

    // Check if statuses already exist for this scope
    let existingQuery = supabaseAdmin.from('task_statuses').select('id');

    if (space_id) {
      existingQuery = existingQuery.eq('space_id', space_id).is('folder_id', null).is('list_id', null).is('sprint_id', null);
    } else if (folder_id) {
      existingQuery = existingQuery.eq('folder_id', folder_id).is('list_id', null).is('sprint_id', null);
    } else if (list_id) {
      existingQuery = existingQuery.eq('list_id', list_id).is('sprint_id', null);
    } else if (sprint_id) {
      existingQuery = existingQuery.eq('sprint_id', sprint_id);
    }

    const { data: existing } = await existingQuery;

    if (existing && existing.length > 0) {
      return res.json({ message: 'Statuses already exist for this scope', count: existing.length });
    }

    // Create default statuses (status_group is optional)
    const insertData = defaultStatuses.map((s, index) => ({
      name: s.name,
      color: s.color,
      status_group: null, // No forced categorization
      position: index,
      space_id: space_id || null,
      folder_id: folder_id || null,
      list_id: list_id || null,
      sprint_id: sprint_id || null
    }));

    const { data, error } = await supabaseAdmin
      .from('task_statuses')
      .insert(insertData)
      .select();

    if (error) throw error;
    res.json({ message: 'Default statuses created', statuses: data });
  } catch (error: any) {
    console.error('Initialize statuses error:', error);
    res.status(500).json({ error: 'Failed to initialize statuses' });
  }
});

// Copy statuses from one scope to another
router.post('/copy', async (req, res) => {
  try {
    const { from_space_id, from_folder_id, from_list_id, to_space_id, to_folder_id, to_list_id, to_sprint_id } = req.body;

    // Get source statuses
    let sourceQuery = supabaseAdmin.from('task_statuses').select('*');

    if (from_list_id) {
      sourceQuery = sourceQuery.eq('list_id', from_list_id);
    } else if (from_folder_id) {
      sourceQuery = sourceQuery.eq('folder_id', from_folder_id).is('list_id', null);
    } else if (from_space_id) {
      sourceQuery = sourceQuery.eq('space_id', from_space_id).is('folder_id', null).is('list_id', null);
    } else {
      return res.status(400).json({ error: 'Source scope is required' });
    }

    const { data: sourceStatuses, error: sourceError } = await sourceQuery.order('position');

    if (sourceError) throw sourceError;
    if (!sourceStatuses || sourceStatuses.length === 0) {
      return res.status(404).json({ error: 'No statuses found in source scope' });
    }

    // Create copies in target scope (preserve status_group if it exists)
    const insertData = sourceStatuses.map((s, index) => ({
      name: s.name,
      color: s.color,
      status_group: s.status_group || null, // Keep original or null if not set
      position: index,
      space_id: to_space_id || null,
      folder_id: to_folder_id || null,
      list_id: to_list_id || null,
      sprint_id: to_sprint_id || null
    }));

    const { data, error } = await supabaseAdmin
      .from('task_statuses')
      .insert(insertData)
      .select();

    if (error) throw error;
    res.json({ message: 'Statuses copied', statuses: data });
  } catch (error: any) {
    console.error('Copy statuses error:', error);
    res.status(500).json({ error: 'Failed to copy statuses' });
  }
});

export default router;
