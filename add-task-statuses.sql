-- Task Statuses System with Inheritance
-- Space statuses are inherited by folders and lists unless overridden

-- Task statuses table
CREATE TABLE IF NOT EXISTS task_statuses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(100) NOT NULL,
  color VARCHAR(20) DEFAULT '#6b7280',
  status_group VARCHAR(20) DEFAULT 'active' CHECK (status_group IN ('active', 'done', 'closed')),
  position INTEGER DEFAULT 0,

  -- Scope: statuses can belong to space, folder, or list
  -- Only one of these should be set (space-level is default)
  space_id UUID REFERENCES spaces(id) ON DELETE CASCADE,
  folder_id UUID REFERENCES folders(id) ON DELETE CASCADE,
  list_id UUID,  -- Can't reference task_lists because it's named 'lists' in schema

  -- Inheritance flag - if true at folder/list level, inherit from parent
  inherit_from_parent BOOLEAN DEFAULT true,

  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes for faster lookups
CREATE INDEX IF NOT EXISTS idx_task_statuses_space ON task_statuses(space_id);
CREATE INDEX IF NOT EXISTS idx_task_statuses_folder ON task_statuses(folder_id);
CREATE INDEX IF NOT EXISTS idx_task_statuses_list ON task_statuses(list_id);
CREATE INDEX IF NOT EXISTS idx_task_statuses_group ON task_statuses(status_group);

-- Enable RLS
ALTER TABLE task_statuses ENABLE ROW LEVEL SECURITY;

-- Permissive policy for all operations
CREATE POLICY task_statuses_all ON task_statuses FOR ALL USING (true) WITH CHECK (true);

-- Updated_at trigger
CREATE OR REPLACE FUNCTION update_task_statuses_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS task_statuses_updated_at ON task_statuses;
CREATE TRIGGER task_statuses_updated_at
  BEFORE UPDATE ON task_statuses
  FOR EACH ROW EXECUTE FUNCTION update_task_statuses_updated_at();

-- Insert default statuses for existing spaces (if none exist)
-- This is done via a function to avoid duplicates
CREATE OR REPLACE FUNCTION create_default_space_statuses(p_space_id UUID)
RETURNS void AS $$
BEGIN
  -- Only create if no statuses exist for this space
  IF NOT EXISTS (SELECT 1 FROM task_statuses WHERE space_id = p_space_id) THEN
    INSERT INTO task_statuses (name, color, status_group, position, space_id, inherit_from_parent)
    VALUES
      ('BACKLOG', '#6b7280', 'active', 0, p_space_id, false),
      ('TO DO', '#3b82f6', 'active', 1, p_space_id, false),
      ('IN PROGRESS', '#f59e0b', 'active', 2, p_space_id, false),
      ('REVIEW', '#8b5cf6', 'active', 3, p_space_id, false),
      ('COMPLETED', '#22c55e', 'closed', 4, p_space_id, false);
  END IF;
END;
$$ LANGUAGE plpgsql;

-- Status settings table (for inheritance configuration)
CREATE TABLE IF NOT EXISTS status_settings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Scope (only one should be set)
  space_id UUID REFERENCES spaces(id) ON DELETE CASCADE,
  folder_id UUID REFERENCES folders(id) ON DELETE CASCADE,
  list_id UUID,

  -- Settings
  use_custom_statuses BOOLEAN DEFAULT false,
  status_template VARCHAR(50), -- 'custom', 'simple', 'scrum', 'kanban', etc.

  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),

  -- Ensure only one setting per entity
  CONSTRAINT unique_space_settings UNIQUE (space_id),
  CONSTRAINT unique_folder_settings UNIQUE (folder_id),
  CONSTRAINT unique_list_settings UNIQUE (list_id)
);

-- Enable RLS for status_settings
ALTER TABLE status_settings ENABLE ROW LEVEL SECURITY;
CREATE POLICY status_settings_all ON status_settings FOR ALL USING (true) WITH CHECK (true);

-- Fix cascade delete issues by ensuring proper foreign keys
-- First, let's make sure folders cascade properly
DO $$
BEGIN
  -- Drop existing foreign key if it exists and recreate with CASCADE
  IF EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE constraint_name = 'lists_folder_id_fkey'
    AND table_name = 'lists'
  ) THEN
    ALTER TABLE lists DROP CONSTRAINT lists_folder_id_fkey;
    ALTER TABLE lists ADD CONSTRAINT lists_folder_id_fkey
      FOREIGN KEY (folder_id) REFERENCES folders(id) ON DELETE CASCADE;
  END IF;

  -- Ensure forms cascade on space/folder delete
  IF EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE constraint_name = 'forms_space_id_fkey'
    AND table_name = 'forms'
  ) THEN
    ALTER TABLE forms DROP CONSTRAINT forms_space_id_fkey;
    ALTER TABLE forms ADD CONSTRAINT forms_space_id_fkey
      FOREIGN KEY (space_id) REFERENCES spaces(id) ON DELETE CASCADE;
  END IF;

  IF EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE constraint_name = 'forms_folder_id_fkey'
    AND table_name = 'forms'
  ) THEN
    ALTER TABLE forms DROP CONSTRAINT forms_folder_id_fkey;
    ALTER TABLE forms ADD CONSTRAINT forms_folder_id_fkey
      FOREIGN KEY (folder_id) REFERENCES folders(id) ON DELETE SET NULL;
  END IF;

  -- Ensure folders cascade on space delete
  IF EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE constraint_name = 'folders_space_id_fkey'
    AND table_name = 'folders'
  ) THEN
    ALTER TABLE folders DROP CONSTRAINT folders_space_id_fkey;
    ALTER TABLE folders ADD CONSTRAINT folders_space_id_fkey
      FOREIGN KEY (space_id) REFERENCES spaces(id) ON DELETE CASCADE;
  END IF;
EXCEPTION
  WHEN OTHERS THEN
    RAISE NOTICE 'Foreign key update skipped: %', SQLERRM;
END;
$$;

-- Add status-related columns to forms if not exist
DO $$
BEGIN
  -- Add custom_statuses column to forms for form-specific statuses
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'forms' AND column_name = 'custom_statuses'
  ) THEN
    ALTER TABLE forms ADD COLUMN custom_statuses JSONB DEFAULT NULL;
  END IF;

  -- Add status_settings column to forms
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'forms' AND column_name = 'status_settings'
  ) THEN
    ALTER TABLE forms ADD COLUMN status_settings JSONB DEFAULT '{"inherit_from_space": true}'::jsonb;
  END IF;
EXCEPTION
  WHEN OTHERS THEN
    RAISE NOTICE 'Column add skipped: %', SQLERRM;
END;
$$;

-- Add default_status column to form_responses to track status properly
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'form_responses' AND column_name = 'status_id'
  ) THEN
    ALTER TABLE form_responses ADD COLUMN status_id UUID;
  END IF;
EXCEPTION
  WHEN OTHERS THEN
    RAISE NOTICE 'Column add skipped: %', SQLERRM;
END;
$$;
