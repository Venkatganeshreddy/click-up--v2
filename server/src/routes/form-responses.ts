import { Router } from 'express';
import { supabaseAdmin } from '../lib/supabase.js';

const router = Router();

// Get all responses for a form
router.get('/form/:formId', async (req, res) => {
  try {
    const { formId } = req.params;
    // Try ordering by position first; fall back to created_at if position column doesn't exist
    let result = await supabaseAdmin
      .from('form_responses')
      .select('*')
      .eq('form_id', formId)
      .order('position', { ascending: true })
      .order('created_at', { ascending: false });

    if (result.error && result.error.code === '42703') {
      // position column doesn't exist yet, fall back
      result = await supabaseAdmin
        .from('form_responses')
        .select('*')
        .eq('form_id', formId)
        .order('created_at', { ascending: false });
    }

    if (result.error) {
      if (result.error.code === '42P01') {
        return res.json([]);
      }
      throw result.error;
    }
    res.json(result.data || []);
  } catch (error: any) {
    if (error?.code === '42P01') {
      return res.json([]);
    }
    console.error('Get form responses error:', error);
    res.status(500).json({ error: 'Failed to fetch form responses' });
  }
});

// Get single response
router.get('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { data, error } = await supabaseAdmin
      .from('form_responses')
      .select('*')
      .eq('id', id)
      .single();

    if (error) throw error;
    res.json(data);
  } catch (error) {
    console.error('Get form response error:', error);
    res.status(500).json({ error: 'Failed to fetch form response' });
  }
});

// Create a response
router.post('/', async (req, res) => {
  try {
    const { form_id, name, response_data, status, assignee_id, assignee_ids, due_date, priority, tags, description } = req.body;

    if (!form_id) {
      return res.status(400).json({ error: 'form_id is required' });
    }

    // Get max position for this form
    const { data: existing } = await supabaseAdmin
      .from('form_responses')
      .select('position')
      .eq('form_id', form_id)
      .order('position', { ascending: false })
      .limit(1);

    const maxPosition = existing && existing.length > 0 ? (existing[0] as any).position : -1;

    const { data, error } = await supabaseAdmin
      .from('form_responses')
      .insert({
        form_id,
        name: name || 'Form Response',
        response_data: response_data || {},
        status: status || 'to_do',
        assignee_id: assignee_id || null,
        assignee_ids: assignee_ids || [],
        due_date: due_date || null,
        priority: priority || 'normal',
        tags: tags || [],
        description: description || null,
        position: maxPosition + 1
      })
      .select()
      .single();

    if (error) throw error;
    res.json(data);
  } catch (error) {
    console.error('Create form response error:', error);
    res.status(500).json({ error: 'Failed to create form response' });
  }
});

// Bulk update responses (for status changes) - MUST be before /:id route
router.put('/bulk/status', async (req, res) => {
  try {
    const { ids, status } = req.body;

    if (!ids || !Array.isArray(ids) || ids.length === 0) {
      return res.status(400).json({ error: 'ids array is required' });
    }

    const { data, error } = await supabaseAdmin
      .from('form_responses')
      .update({ status, updated_at: new Date().toISOString() })
      .in('id', ids)
      .select();

    if (error) throw error;
    res.json(data);
  } catch (error) {
    console.error('Bulk update form responses error:', error);
    res.status(500).json({ error: 'Failed to update form responses' });
  }
});

// Update a response
router.put('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { name, response_data, status, assignee_id, assignee_ids, due_date, priority, tags, position, description } = req.body;

    const updateData: any = {};
    if (name !== undefined) updateData.name = name;
    if (response_data !== undefined) updateData.response_data = response_data;
    if (status !== undefined) updateData.status = status;
    if (assignee_id !== undefined) updateData.assignee_id = assignee_id;
    if (assignee_ids !== undefined) updateData.assignee_ids = assignee_ids;
    if (due_date !== undefined) updateData.due_date = due_date;
    if (priority !== undefined) updateData.priority = priority;
    if (tags !== undefined) updateData.tags = tags;
    if (position !== undefined) updateData.position = position;
    if (description !== undefined) updateData.description = description;
    updateData.updated_at = new Date().toISOString();

    const { data, error } = await supabaseAdmin
      .from('form_responses')
      .update(updateData)
      .eq('id', id)
      .select()
      .single();

    if (error) throw error;
    res.json(data);
  } catch (error) {
    console.error('Update form response error:', error);
    res.status(500).json({ error: 'Failed to update form response' });
  }
});

// Delete a response
router.delete('/:id', async (req, res) => {
  try {
    const { id } = req.params;

    const { error } = await supabaseAdmin
      .from('form_responses')
      .delete()
      .eq('id', id);

    if (error) throw error;
    res.json({ message: 'Response deleted successfully' });
  } catch (error) {
    console.error('Delete form response error:', error);
    res.status(500).json({ error: 'Failed to delete form response' });
  }
});

export default router;
