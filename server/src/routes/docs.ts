import { Router } from 'express';
import { supabaseAdmin } from '../lib/supabase.js';

const router = Router();

// Track whether enhanced columns exist (cached after first check)
let hasEnhancedColumns: boolean | null = null;

async function checkEnhancedColumns(): Promise<boolean> {
  if (hasEnhancedColumns !== null) return hasEnhancedColumns;
  try {
    // Try to select an enhanced column - if it fails, columns don't exist
    const { error } = await supabaseAdmin
      .from('docs')
      .select('cover_image, shared_with, link_role')
      .limit(0);
    hasEnhancedColumns = !error;
  } catch {
    hasEnhancedColumns = false;
  }
  return hasEnhancedColumns;
}

// Normalize doc data to always include enhanced fields (with defaults if missing)
function normalizeDoc(doc: any): any {
  return {
    cover_image: null,
    icon: '',
    is_wiki: false,
    is_archived: false,
    is_favorited: false,
    shared_with: [],
    link_role: 'viewer',
    ...doc
  };
}

function normalizeDocs(docs: any[]): any[] {
  return docs.map(normalizeDoc);
}

// Get all docs
router.get('/', async (_req, res) => {
  try {
    const { data, error } = await supabaseAdmin
      .from('docs')
      .select('*')
      .order('updated_at', { ascending: false });

    if (error) throw error;
    res.json(normalizeDocs(data || []));
  } catch (error) {
    console.error('Get docs error:', error);
    res.status(500).json({ error: 'Failed to fetch docs' });
  }
});

// Get docs by space (not in any folder)
router.get('/space/:spaceId', async (req, res) => {
  try {
    const { spaceId } = req.params;
    const { data, error } = await supabaseAdmin
      .from('docs')
      .select('*')
      .eq('space_id', spaceId)
      .is('folder_id', null)
      .order('updated_at', { ascending: false });

    if (error) throw error;
    res.json(normalizeDocs(data || []));
  } catch (error) {
    console.error('Get space docs error:', error);
    res.status(500).json({ error: 'Failed to fetch space docs' });
  }
});

// Get docs by folder
router.get('/folder/:folderId', async (req, res) => {
  try {
    const { folderId } = req.params;
    const { data, error } = await supabaseAdmin
      .from('docs')
      .select('*')
      .eq('folder_id', folderId)
      .order('updated_at', { ascending: false });

    if (error) throw error;
    res.json(normalizeDocs(data || []));
  } catch (error) {
    console.error('Get folder docs error:', error);
    res.status(500).json({ error: 'Failed to fetch folder docs' });
  }
});

// Get public doc (for sharing - only returns docs with sharing='public')
router.get('/public/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { data, error } = await supabaseAdmin
      .from('docs')
      .select('*')
      .eq('id', id)
      .single();

    if (error) throw error;

    // Only allow access to public docs
    if (data.sharing !== 'public') {
      return res.status(403).json({ error: 'This document is not publicly shared' });
    }

    // Look up owner name
    let ownerName: string | null = null;
    if (data.owner_id) {
      const { data: memberData } = await supabaseAdmin
        .from('members')
        .select('name')
        .eq('id', data.owner_id)
        .single();
      ownerName = memberData?.name || null;
    }

    res.json({ ...normalizeDoc(data), owner_name: ownerName });
  } catch (error) {
    console.error('Get public doc error:', error);
    res.status(500).json({ error: 'Failed to fetch doc' });
  }
});

// Get single doc
router.get('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { data, error } = await supabaseAdmin
      .from('docs')
      .select('*')
      .eq('id', id)
      .single();

    if (error) throw error;

    let ownerName: string | null = null;
    if (data.owner_id) {
      const { data: memberData } = await supabaseAdmin
        .from('members')
        .select('name')
        .eq('id', data.owner_id)
        .single();
      ownerName = memberData?.name || null;
    }

    res.json({ ...normalizeDoc(data), owner_name: ownerName });
  } catch (error) {
    console.error('Get doc error:', error);
    res.status(500).json({ error: 'Failed to fetch doc' });
  }
});

// Create a doc
router.post('/', async (req, res) => {
  try {
    const { name, content, space_id, folder_id, owner_id, sharing, tags, cover_image, icon, is_wiki, shared_with, link_role } = req.body;

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

    const enhanced = await checkEnhancedColumns();

    // Base insert data (columns that always exist)
    const insertData: any = {
      name,
      content: content || '',
      space_id: actualSpaceId,
      folder_id: folder_id || null,
      owner_id: owner_id || null,
      sharing: sharing || 'workspace',
      tags: tags || [],
      shared_with: shared_with || [],
      link_role: link_role || 'viewer'
    };

    // Add enhanced columns only if they exist in the database
    if (enhanced) {
      insertData.cover_image = cover_image || null;
      insertData.icon = icon || '';
      insertData.is_wiki = is_wiki || false;
    }

    const { data, error } = await supabaseAdmin
      .from('docs')
      .insert(insertData)
      .select()
      .single();

    if (error) {
      // If error is about a missing column, reset cache and retry with base columns
      if (error.message?.includes('column') && error.message?.includes('schema cache')) {
        hasEnhancedColumns = false;
        const { data: retryData, error: retryError } = await supabaseAdmin
          .from('docs')
          .insert({
            name,
            content: content || '',
            space_id: actualSpaceId,
            folder_id: folder_id || null,
            owner_id: owner_id || null,
            sharing: sharing || 'workspace',
            tags: tags || []
          })
          .select()
          .single();

        if (retryError) throw retryError;
        return res.json(normalizeDoc(retryData));
      }
      throw error;
    }

    res.json(normalizeDoc(data));
  } catch (error) {
    console.error('Create doc error:', error);
    res.status(500).json({ error: 'Failed to create doc' });
  }
});

// Update a doc
router.put('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { name, content, sharing, tags, space_id, folder_id, cover_image, icon, is_wiki, is_archived, is_favorited, last_viewed_at, shared_with, link_role } = req.body;

    const enhanced = await checkEnhancedColumns();

    const updateData: any = {};
    if (name !== undefined) updateData.name = name;
    if (content !== undefined) updateData.content = content;
    if (sharing !== undefined) updateData.sharing = sharing;
    if (tags !== undefined) updateData.tags = tags;
    if (space_id !== undefined) updateData.space_id = space_id;
    if (folder_id !== undefined) updateData.folder_id = folder_id;
    if (shared_with !== undefined) updateData.shared_with = shared_with;
    if (link_role !== undefined) updateData.link_role = link_role;

    // Only include enhanced columns if they exist
    if (enhanced) {
      if (cover_image !== undefined) updateData.cover_image = cover_image;
      if (icon !== undefined) updateData.icon = icon;
      if (is_wiki !== undefined) updateData.is_wiki = is_wiki;
      if (is_archived !== undefined) updateData.is_archived = is_archived;
      if (is_favorited !== undefined) updateData.is_favorited = is_favorited;
      if (last_viewed_at !== undefined) updateData.last_viewed_at = last_viewed_at;
    }
    updateData.updated_at = new Date().toISOString();

    const { data, error } = await supabaseAdmin
      .from('docs')
      .update(updateData)
      .eq('id', id)
      .select()
      .single();

    if (error) {
      // If column not found, retry without enhanced columns
      if (error.message?.includes('column') && error.message?.includes('schema cache')) {
        hasEnhancedColumns = false;
        const baseUpdate: any = {};
        if (name !== undefined) baseUpdate.name = name;
        if (content !== undefined) baseUpdate.content = content;
        if (sharing !== undefined) baseUpdate.sharing = sharing;
        if (tags !== undefined) baseUpdate.tags = tags;
        if (space_id !== undefined) baseUpdate.space_id = space_id;
        if (folder_id !== undefined) baseUpdate.folder_id = folder_id;
        if (shared_with !== undefined) baseUpdate.shared_with = shared_with;
        if (link_role !== undefined) baseUpdate.link_role = link_role;
        baseUpdate.updated_at = new Date().toISOString();

        const { data: retryData, error: retryError } = await supabaseAdmin
          .from('docs')
          .update(baseUpdate)
          .eq('id', id)
          .select()
          .single();

        if (retryError) throw retryError;
        return res.json(normalizeDoc(retryData));
      }
      throw error;
    }

    res.json(normalizeDoc(data));
  } catch (error) {
    console.error('Update doc error:', error);
    res.status(500).json({ error: 'Failed to update doc' });
  }
});

// Delete a doc
router.delete('/:id', async (req, res) => {
  try {
    const { id } = req.params;

    const { error } = await supabaseAdmin
      .from('docs')
      .delete()
      .eq('id', id);

    if (error) throw error;
    res.json({ message: 'Doc deleted successfully' });
  } catch (error) {
    console.error('Delete doc error:', error);
    res.status(500).json({ error: 'Failed to delete doc' });
  }
});

// Migration endpoint - run the enhanced columns migration
router.post('/migrate', async (_req, res) => {
  try {
    // Try adding each column individually - Supabase admin doesn't support raw SQL,
    // so we test by attempting to select the column
    const columnsToCheck = ['cover_image', 'icon', 'is_wiki', 'is_archived', 'is_favorited'];
    const missing: string[] = [];

    for (const col of columnsToCheck) {
      const { error } = await supabaseAdmin
        .from('docs')
        .select(col)
        .limit(0);
      if (error) missing.push(col);
    }

    if (missing.length === 0) {
      // Also check doc_pages table
      const { error: pagesError } = await supabaseAdmin
        .from('doc_pages')
        .select('id')
        .limit(0);

      if (pagesError) {
        return res.json({
          status: 'partial',
          message: 'Docs table has all columns, but doc_pages table is missing. Please run the full migration SQL in Supabase Dashboard.',
          missing_columns: [],
          missing_tables: ['doc_pages']
        });
      }

      // Reset cache
      hasEnhancedColumns = true;
      return res.json({ status: 'ok', message: 'All columns and tables exist. No migration needed.' });
    }

    res.json({
      status: 'migration_needed',
      message: 'Enhanced columns are missing from the docs table. Please run the migration SQL in your Supabase Dashboard SQL Editor.',
      missing_columns: missing,
      sql: `-- Run this SQL in your Supabase Dashboard SQL Editor:
ALTER TABLE docs ADD COLUMN IF NOT EXISTS cover_image TEXT;
ALTER TABLE docs ADD COLUMN IF NOT EXISTS icon TEXT DEFAULT '';
ALTER TABLE docs ADD COLUMN IF NOT EXISTS is_wiki BOOLEAN DEFAULT false;
ALTER TABLE docs ADD COLUMN IF NOT EXISTS is_archived BOOLEAN DEFAULT false;
ALTER TABLE docs ADD COLUMN IF NOT EXISTS is_favorited BOOLEAN DEFAULT false;

CREATE TABLE IF NOT EXISTS doc_pages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  doc_id UUID NOT NULL REFERENCES docs(id) ON DELETE CASCADE,
  title VARCHAR(255) NOT NULL DEFAULT 'Untitled',
  content TEXT DEFAULT '',
  icon TEXT DEFAULT '',
  position INTEGER DEFAULT 0,
  parent_page_id UUID REFERENCES doc_pages(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_doc_pages_doc_id ON doc_pages(doc_id);
CREATE INDEX IF NOT EXISTS idx_doc_pages_parent ON doc_pages(parent_page_id);

ALTER TABLE doc_pages ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'doc_pages' AND policyname = 'Allow all access to doc_pages') THEN
    CREATE POLICY "Allow all access to doc_pages" ON doc_pages FOR ALL USING (true) WITH CHECK (true);
  END IF;
END $$;

CREATE OR REPLACE FUNCTION update_doc_pages_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS doc_pages_updated_at ON doc_pages;
CREATE TRIGGER doc_pages_updated_at
  BEFORE UPDATE ON doc_pages
  FOR EACH ROW
  EXECUTE FUNCTION update_doc_pages_updated_at();`
    });
  } catch (error) {
    console.error('Migration check error:', error);
    res.status(500).json({ error: 'Failed to check migration status' });
  }
});

// Reset column cache (call after running migration)
router.post('/reset-cache', (_req, res) => {
  hasEnhancedColumns = null;
  res.json({ status: 'ok', message: 'Column cache reset. Next request will re-check.' });
});

export default router;
