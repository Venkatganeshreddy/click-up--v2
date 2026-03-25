import { Router } from 'express';
import { supabaseAdmin as supabase } from '../lib/supabase.js';

const router = Router();

// Custom Field Types
const FIELD_TYPES = [
  // Basic fields
  'dropdown', 'text', 'textarea', 'number', 'date', 'checkbox',
  // Contact fields
  'email', 'url', 'phone', 'website',
  // Advanced fields
  'currency', 'money', 'labels', 'people', 'files', 'location',
  // Progress fields
  'progress_auto', 'progress_manual', 'progress_updates',
  // Relationship fields
  'relationship', 'tasks',
  // Rating fields
  'rating', 'voting',
  // AI fields
  'ai_summary', 'ai_custom_text', 'ai_custom_dropdown',
  'translation', 'sentiment', 'categorize',
  // Formula
  'formula'
] as const;
type FieldType = typeof FIELD_TYPES[number];

// =============================================
// CUSTOM FIELDS ROUTES
// =============================================

// Get all custom fields for a space (space-level fields only)
router.get('/space/:spaceId', async (req, res) => {
  try {
    const { spaceId } = req.params;

    const { data, error } = await supabase
      .from('custom_fields')
      .select('*')
      .eq('space_id', spaceId)
      .is('folder_id', null)
      .is('list_id', null)
      .order('position', { ascending: true });

    if (error) throw error;
    res.json(data || []);
  } catch (error) {
    console.error('Error fetching custom fields:', error);
    res.status(500).json({ error: 'Failed to fetch custom fields' });
  }
});

// Get all custom fields for a folder (folder + inherited from space)
router.get('/folder/:folderId', async (req, res) => {
  try {
    const { folderId } = req.params;

    // Get the folder to find parent space
    const { data: folder } = await supabase
      .from('folders')
      .select('space_id')
      .eq('id', folderId)
      .single();

    if (!folder) {
      return res.json([]);
    }

    // Get folder-specific fields
    const { data: folderFields } = await supabase
      .from('custom_fields')
      .select('*')
      .eq('folder_id', folderId)
      .order('position', { ascending: true });

    // Get space-level fields (inherited)
    const { data: spaceFields } = await supabase
      .from('custom_fields')
      .select('*')
      .eq('space_id', folder.space_id)
      .is('folder_id', null)
      .is('list_id', null)
      .order('position', { ascending: true });

    // Combine: space fields first, then folder-specific fields
    const allFields = [
      ...(spaceFields || []).map(f => ({ ...f, inherited_from: 'space' })),
      ...(folderFields || []).map(f => ({ ...f, inherited_from: null }))
    ];

    res.json(allFields);
  } catch (error) {
    console.error('Error fetching folder custom fields:', error);
    res.status(500).json({ error: 'Failed to fetch custom fields' });
  }
});

// Get all custom fields for a list (list + folder + space inheritance)
router.get('/list/:listId', async (req, res) => {
  try {
    const { listId } = req.params;

    // Get the list to find parent folder and space
    const { data: list } = await supabase
      .from('task_lists')
      .select('space_id, folder_id')
      .eq('id', listId)
      .single();

    if (!list) {
      return res.json([]);
    }

    // Get list-specific fields (only this list)
    const { data: listFields } = await supabase
      .from('custom_fields')
      .select('*')
      .eq('list_id', listId)
      .order('position', { ascending: true });

    // Get folder-level fields (if list is in a folder)
    let folderFields: any[] = [];
    if (list.folder_id) {
      const { data } = await supabase
        .from('custom_fields')
        .select('*')
        .eq('folder_id', list.folder_id)
        .is('list_id', null)
        .order('position', { ascending: true });
      folderFields = data || [];
    }

    // Get space-level fields (inherited by all)
    const { data: spaceFields } = await supabase
      .from('custom_fields')
      .select('*')
      .eq('space_id', list.space_id)
      .is('folder_id', null)
      .is('list_id', null)
      .order('position', { ascending: true });

    // Combine: space fields first, then folder fields, then list-specific fields
    const allFields = [
      ...(spaceFields || []).map(f => ({ ...f, inherited_from: 'space' })),
      ...folderFields.map(f => ({ ...f, inherited_from: 'folder' })),
      ...(listFields || []).map(f => ({ ...f, inherited_from: null }))
    ];

    res.json(allFields);
  } catch (error) {
    console.error('Error fetching list custom fields:', error);
    res.status(500).json({ error: 'Failed to fetch custom fields' });
  }
});

// Get all custom fields (for "Everything" view)
router.get('/', async (req, res) => {
  try {
    const { data, error } = await supabase
      .from('custom_fields')
      .select('*')
      .order('position', { ascending: true });

    if (error) throw error;
    res.json(data || []);
  } catch (error) {
    console.error('Error fetching all custom fields:', error);
    res.status(500).json({ error: 'Failed to fetch custom fields' });
  }
});

// Create a custom field
router.post('/', async (req, res) => {
  try {
    const {
      name,
      type,
      type_config,
      space_id,
      folder_id,
      list_id,
      description,
      default_value,
      is_required,
      is_pinned,
      is_visible_to_guests,
      is_private,
      created_by
    } = req.body;

    if (!name || !type) {
      return res.status(400).json({ error: 'Name and type are required' });
    }

    if (!FIELD_TYPES.includes(type)) {
      return res.status(400).json({ error: `Invalid field type. Must be one of: ${FIELD_TYPES.join(', ')}` });
    }

    // Get the next position
    const { data: existingFields } = await supabase
      .from('custom_fields')
      .select('position')
      .eq('space_id', space_id)
      .order('position', { ascending: false })
      .limit(1);

    const position = existingFields && existingFields.length > 0 ? existingFields[0].position + 1 : 0;

    const { data, error } = await supabase
      .from('custom_fields')
      .insert({
        name,
        type,
        type_config: type_config || {},
        space_id,
        folder_id: folder_id || null,
        list_id: list_id || null,
        description: description || null,
        default_value: default_value || null,
        is_required: is_required || false,
        is_pinned: is_pinned || false,
        is_visible_to_guests: is_visible_to_guests !== false,
        is_private: is_private || false,
        position,
        created_by: created_by || null
      })
      .select()
      .single();

    if (error) throw error;
    res.status(201).json(data);
  } catch (error) {
    console.error('Error creating custom field:', error);
    res.status(500).json({ error: 'Failed to create custom field' });
  }
});

// Update a custom field
router.put('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const updates = req.body;

    // Remove fields that shouldn't be updated directly
    delete updates.id;
    delete updates.created_at;
    delete updates.created_by;

    const { data, error } = await supabase
      .from('custom_fields')
      .update(updates)
      .eq('id', id)
      .select()
      .single();

    if (error) throw error;
    res.json(data);
  } catch (error) {
    console.error('Error updating custom field:', error);
    res.status(500).json({ error: 'Failed to update custom field' });
  }
});

// Delete a custom field
router.delete('/:id', async (req, res) => {
  try {
    const { id } = req.params;

    // First delete all values for this field
    await supabase
      .from('custom_field_values')
      .delete()
      .eq('field_id', id);

    // Then delete the field
    const { error } = await supabase
      .from('custom_fields')
      .delete()
      .eq('id', id);

    if (error) throw error;
    res.status(204).send();
  } catch (error) {
    console.error('Error deleting custom field:', error);
    res.status(500).json({ error: 'Failed to delete custom field' });
  }
});

// =============================================
// CUSTOM FIELD VALUES ROUTES
// =============================================

// Get all field values for a task
router.get('/values/task/:taskId', async (req, res) => {
  try {
    const { taskId } = req.params;

    const { data, error } = await supabase
      .from('custom_field_values')
      .select('*, custom_fields(*)')
      .eq('task_id', taskId);

    if (error) throw error;
    res.json(data || []);
  } catch (error) {
    console.error('Error fetching field values:', error);
    res.status(500).json({ error: 'Failed to fetch field values' });
  }
});

// Get all field values for multiple tasks (batch)
router.post('/values/batch', async (req, res) => {
  try {
    const { taskIds } = req.body;

    if (!taskIds || !Array.isArray(taskIds)) {
      return res.status(400).json({ error: 'taskIds array is required' });
    }

    const { data, error } = await supabase
      .from('custom_field_values')
      .select('*')
      .in('task_id', taskIds);

    if (error) throw error;
    res.json(data || []);
  } catch (error) {
    console.error('Error fetching batch field values:', error);
    res.status(500).json({ error: 'Failed to fetch field values' });
  }
});

// Set/Update a field value for a task
router.post('/values', async (req, res) => {
  try {
    const { task_id, field_id, value } = req.body;

    if (!task_id || !field_id) {
      return res.status(400).json({ error: 'task_id and field_id are required' });
    }

    // Get the field to determine the type
    const { data: field, error: fieldError } = await supabase
      .from('custom_fields')
      .select('type')
      .eq('id', field_id)
      .single();

    if (fieldError || !field) {
      return res.status(404).json({ error: 'Custom field not found' });
    }

    // Prepare the value based on field type
    const valueData: Record<string, any> = {
      task_id,
      field_id,
      value_text: null,
      value_number: null,
      value_boolean: null,
      value_date: null,
      value_json: null
    };

    switch (field.type) {
      // Text-based fields
      case 'text':
      case 'textarea':
      case 'email':
      case 'url':
      case 'phone':
      case 'website':
      case 'formula':
      case 'ai_summary':
      case 'ai_custom_text':
      case 'translation':
        valueData.value_text = value;
        break;
      // Number-based fields
      case 'number':
      case 'currency':
      case 'money':
      case 'rating':
      case 'voting':
      case 'progress_auto':
      case 'progress_manual':
        valueData.value_number = value;
        break;
      // Boolean fields
      case 'checkbox':
        valueData.value_boolean = value;
        break;
      // Date fields
      case 'date':
        valueData.value_date = value;
        break;
      // JSON/Object fields
      case 'dropdown':
      case 'ai_custom_dropdown':
      case 'people':
      case 'labels':
      case 'files':
      case 'location':
      case 'relationship':
      case 'tasks':
      case 'progress_updates':
      case 'sentiment':
      case 'categorize':
        valueData.value_json = value;
        break;
    }

    // Upsert the value
    const { data, error } = await supabase
      .from('custom_field_values')
      .upsert(valueData, { onConflict: 'task_id,field_id' })
      .select()
      .single();

    if (error) throw error;
    res.json(data);
  } catch (error) {
    console.error('Error setting field value:', error);
    res.status(500).json({ error: 'Failed to set field value' });
  }
});

// Delete a field value
router.delete('/values/:taskId/:fieldId', async (req, res) => {
  try {
    const { taskId, fieldId } = req.params;

    const { error } = await supabase
      .from('custom_field_values')
      .delete()
      .eq('task_id', taskId)
      .eq('field_id', fieldId);

    if (error) throw error;
    res.status(204).send();
  } catch (error) {
    console.error('Error deleting field value:', error);
    res.status(500).json({ error: 'Failed to delete field value' });
  }
});

export default router;
