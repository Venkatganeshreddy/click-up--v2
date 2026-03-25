-- Migration: Add docs and forms tables
-- Run this in Supabase SQL editor

-- ============================================
-- DOCS TABLE
-- ============================================
CREATE TABLE IF NOT EXISTS docs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(255) NOT NULL,
  content TEXT DEFAULT '',
  space_id UUID NOT NULL REFERENCES spaces(id) ON DELETE CASCADE,
  folder_id UUID REFERENCES folders(id) ON DELETE SET NULL,
  owner_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  sharing VARCHAR(20) DEFAULT 'workspace' CHECK (sharing IN ('public', 'private', 'workspace')),
  shared_with JSONB DEFAULT '[]'::jsonb,
  link_role VARCHAR(20) DEFAULT 'viewer' CHECK (link_role IN ('viewer', 'commenter', 'editor')),
  tags TEXT[] DEFAULT '{}',
  last_viewed_at TIMESTAMPTZ DEFAULT NOW(),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_docs_space_id ON docs(space_id);
CREATE INDEX IF NOT EXISTS idx_docs_folder_id ON docs(folder_id);
CREATE INDEX IF NOT EXISTS idx_docs_owner_id ON docs(owner_id);

ALTER TABLE docs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow all access to docs" ON docs
  FOR ALL USING (true) WITH CHECK (true);

CREATE OR REPLACE FUNCTION update_docs_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER docs_updated_at
  BEFORE UPDATE ON docs
  FOR EACH ROW
  EXECUTE FUNCTION update_docs_updated_at();

ALTER TABLE docs ADD COLUMN IF NOT EXISTS shared_with JSONB DEFAULT '[]'::jsonb;
ALTER TABLE docs ADD COLUMN IF NOT EXISTS link_role VARCHAR(20) DEFAULT 'viewer' CHECK (link_role IN ('viewer', 'commenter', 'editor'));

-- ============================================
-- FORMS TABLE
-- ============================================
CREATE TABLE IF NOT EXISTS forms (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(255) NOT NULL,
  description TEXT,
  space_id UUID NOT NULL REFERENCES spaces(id) ON DELETE CASCADE,
  folder_id UUID REFERENCES folders(id) ON DELETE SET NULL,
  owner_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  status VARCHAR(20) DEFAULT 'active' CHECK (status IN ('active', 'inactive')),
  fields JSONB DEFAULT '[]',
  responses_count INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_forms_space_id ON forms(space_id);
CREATE INDEX IF NOT EXISTS idx_forms_folder_id ON forms(folder_id);
CREATE INDEX IF NOT EXISTS idx_forms_owner_id ON forms(owner_id);

ALTER TABLE forms ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow all access to forms" ON forms
  FOR ALL USING (true) WITH CHECK (true);

CREATE OR REPLACE FUNCTION update_forms_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER forms_updated_at
  BEFORE UPDATE ON forms
  FOR EACH ROW
  EXECUTE FUNCTION update_forms_updated_at();
