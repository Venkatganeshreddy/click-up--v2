-- Migration: Enhance docs table and add doc_pages table
-- Run this in Supabase SQL editor AFTER add-docs-forms-tables.sql

-- Add additional columns to docs table
ALTER TABLE docs ADD COLUMN IF NOT EXISTS cover_image TEXT;
ALTER TABLE docs ADD COLUMN IF NOT EXISTS icon TEXT DEFAULT '';
ALTER TABLE docs ADD COLUMN IF NOT EXISTS is_wiki BOOLEAN DEFAULT false;
ALTER TABLE docs ADD COLUMN IF NOT EXISTS is_archived BOOLEAN DEFAULT false;
ALTER TABLE docs ADD COLUMN IF NOT EXISTS is_favorited BOOLEAN DEFAULT false;

-- Create doc_pages table (sub-pages within a doc)
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

CREATE POLICY "Allow all access to doc_pages" ON doc_pages
  FOR ALL USING (true) WITH CHECK (true);

CREATE OR REPLACE FUNCTION update_doc_pages_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER doc_pages_updated_at
  BEFORE UPDATE ON doc_pages
  FOR EACH ROW
  EXECUTE FUNCTION update_doc_pages_updated_at();
