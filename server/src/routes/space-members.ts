import { Router } from 'express';
import { supabaseAdmin } from '../lib/supabase.js';

const router = Router();

// Permission levels
const PERMISSIONS = ['full_edit', 'edit', 'comment', 'view_only'] as const;
type Permission = typeof PERMISSIONS[number];

// Get all members of a space
router.get('/space/:spaceId', async (req, res) => {
  try {
    const { spaceId } = req.params;

    const { data, error } = await supabaseAdmin
      .from('space_members')
      .select(`
        *,
        member:members!space_members_member_id_fkey(id, email, name, role)
      `)
      .eq('space_id', spaceId);

    if (error) throw error;
    res.json(data || []);
  } catch (error) {
    console.error('Get space members error:', error);
    res.status(500).json({ error: 'Failed to fetch space members' });
  }
});

// Get all spaces a member has access to
router.get('/member/:memberId', async (req, res) => {
  try {
    const { memberId } = req.params;
    console.log('Getting spaces for member:', memberId);

    const { data, error } = await supabaseAdmin
      .from('space_members')
      .select(`
        *,
        space:spaces(id, name, color, description)
      `)
      .eq('member_id', memberId);

    if (error) {
      console.error('Supabase error:', error);
      throw error;
    }
    console.log('Found spaces for member:', data);
    res.json(data || []);
  } catch (error) {
    console.error('Get member spaces error:', error);
    res.status(500).json({ error: 'Failed to fetch member spaces' });
  }
});

// Add member to space
router.post('/', async (req, res) => {
  try {
    const { space_id, member_id, permission = 'edit', added_by } = req.body;

    if (!space_id || !member_id) {
      return res.status(400).json({ error: 'space_id and member_id are required' });
    }

    if (!PERMISSIONS.includes(permission)) {
      return res.status(400).json({ error: 'Invalid permission level' });
    }

    // Check if already exists
    const { data: existing } = await supabaseAdmin
      .from('space_members')
      .select('id')
      .eq('space_id', space_id)
      .eq('member_id', member_id)
      .single();

    if (existing) {
      return res.status(400).json({ error: 'Member is already in this space' });
    }

    const { data, error } = await supabaseAdmin
      .from('space_members')
      .insert({
        space_id,
        member_id,
        permission,
        added_by
      })
      .select('*')
      .single();

    if (error) throw error;
    res.json(data);
  } catch (error) {
    console.error('Add space member error:', error);
    res.status(500).json({ error: 'Failed to add member to space' });
  }
});

// Add multiple members to space at once
router.post('/bulk', async (req, res) => {
  try {
    const { space_id, members, added_by } = req.body;
    console.log('Bulk add request:', { space_id, members, added_by });

    if (!space_id || !members || !Array.isArray(members)) {
      return res.status(400).json({ error: 'space_id and members array are required' });
    }

    const insertData = members.map((m: { member_id: string; permission?: Permission }) => ({
      space_id,
      member_id: m.member_id,
      permission: m.permission || 'edit',
      added_by
    }));
    console.log('Insert data:', insertData);

    const { data, error } = await supabaseAdmin
      .from('space_members')
      .upsert(insertData, { onConflict: 'space_id,member_id' })
      .select('*');

    if (error) {
      console.error('Supabase error:', error);
      throw error;
    }
    console.log('Bulk add success:', data);
    res.json(data || []);
  } catch (error) {
    console.error('Bulk add space members error:', error);
    res.status(500).json({ error: 'Failed to add members to space' });
  }
});

// Update member permission in space
router.put('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { permission } = req.body;

    if (!PERMISSIONS.includes(permission)) {
      return res.status(400).json({ error: 'Invalid permission level' });
    }

    const { data, error } = await supabaseAdmin
      .from('space_members')
      .update({ permission })
      .eq('id', id)
      .select(`
        *,
        member:members!space_members_member_id_fkey(id, email, name, role)
      `)
      .single();

    if (error) throw error;
    res.json(data);
  } catch (error) {
    console.error('Update space member error:', error);
    res.status(500).json({ error: 'Failed to update member permission' });
  }
});

// Remove member from space
router.delete('/:id', async (req, res) => {
  try {
    const { id } = req.params;

    const { error } = await supabaseAdmin
      .from('space_members')
      .delete()
      .eq('id', id);

    if (error) throw error;
    res.json({ message: 'Member removed from space' });
  } catch (error) {
    console.error('Remove space member error:', error);
    res.status(500).json({ error: 'Failed to remove member from space' });
  }
});

// Remove member from space by space_id and member_id
router.delete('/space/:spaceId/member/:memberId', async (req, res) => {
  try {
    const { spaceId, memberId } = req.params;

    const { error } = await supabaseAdmin
      .from('space_members')
      .delete()
      .eq('space_id', spaceId)
      .eq('member_id', memberId);

    if (error) throw error;
    res.json({ message: 'Member removed from space' });
  } catch (error) {
    console.error('Remove space member error:', error);
    res.status(500).json({ error: 'Failed to remove member from space' });
  }
});

export default router;
