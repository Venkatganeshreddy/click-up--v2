import { Router } from 'express';
import { supabaseAdmin } from '../lib/supabase.js';

const router = Router();

// Get all pages for a doc
router.get('/doc/:docId', async (req, res) => {
  try {
    const { docId } = req.params;
    const { data, error } = await supabaseAdmin
      .from('doc_pages')
      .select('*')
      .eq('doc_id', docId)
      .order('position', { ascending: true });

    if (error) {
      // If table doesn't exist, return empty array
      if (error.message?.includes('schema cache') || error.code === 'PGRST204') {
        return res.json([]);
      }
      throw error;
    }
    res.json(data || []);
  } catch (error: any) {
    // If table doesn't exist, return empty array gracefully
    if (error?.message?.includes('schema cache') || error?.code === 'PGRST204' || error?.code === '42P01') {
      return res.json([]);
    }
    console.error('Get doc pages error:', error);
    res.status(500).json({ error: 'Failed to fetch doc pages' });
  }
});

// Get single page
router.get('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { data, error } = await supabaseAdmin
      .from('doc_pages')
      .select('*')
      .eq('id', id)
      .single();

    if (error) throw error;
    res.json(data);
  } catch (error) {
    console.error('Get doc page error:', error);
    res.status(500).json({ error: 'Failed to fetch doc page' });
  }
});

// Create a page
router.post('/', async (req, res) => {
  try {
    const { doc_id, title, content, icon, position, parent_page_id } = req.body;

    if (!doc_id) {
      return res.status(400).json({ error: 'doc_id is required' });
    }

    const { data, error } = await supabaseAdmin
      .from('doc_pages')
      .insert({
        doc_id,
        title: title || 'Untitled',
        content: content || '',
        icon: icon || '',
        position: position || 0,
        parent_page_id: parent_page_id || null
      })
      .select()
      .single();

    if (error) throw error;
    res.json(data);
  } catch (error) {
    console.error('Create doc page error:', error);
    res.status(500).json({ error: 'Failed to create doc page' });
  }
});

// Update a page
router.put('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { title, content, icon, position } = req.body;

    const updateData: any = {};
    if (title !== undefined) updateData.title = title;
    if (content !== undefined) updateData.content = content;
    if (icon !== undefined) updateData.icon = icon;
    if (position !== undefined) updateData.position = position;
    updateData.updated_at = new Date().toISOString();

    const { data, error } = await supabaseAdmin
      .from('doc_pages')
      .update(updateData)
      .eq('id', id)
      .select()
      .single();

    if (error) throw error;
    res.json(data);
  } catch (error) {
    console.error('Update doc page error:', error);
    res.status(500).json({ error: 'Failed to update doc page' });
  }
});

// Delete a page
router.delete('/:id', async (req, res) => {
  try {
    const { id } = req.params;

    const { error } = await supabaseAdmin
      .from('doc_pages')
      .delete()
      .eq('id', id);

    if (error) throw error;
    res.json({ message: 'Page deleted successfully' });
  } catch (error) {
    console.error('Delete doc page error:', error);
    res.status(500).json({ error: 'Failed to delete doc page' });
  }
});

export default router;
