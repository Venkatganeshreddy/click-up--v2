-- =============================================
-- ADD TASK LISTS TABLE AND LIST_ID COLUMN
-- =============================================
-- Run this SQL in your Supabase SQL Editor
-- This creates the new hierarchy: Space > Folder > List > Task
-- =============================================

-- =============================================
-- 1. CREATE TASK_LISTS TABLE (List containers for tasks)
-- =============================================
CREATE TABLE IF NOT EXISTS task_lists (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    description TEXT,
    color VARCHAR(50) DEFAULT '#6366f1',
    space_id UUID REFERENCES spaces(id) ON DELETE CASCADE,
    folder_id UUID REFERENCES folders(id) ON DELETE CASCADE,
    owner_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    position INTEGER DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Enable RLS for task_lists
ALTER TABLE task_lists ENABLE ROW LEVEL SECURITY;

-- Allow ALL operations for everyone (development mode)
DROP POLICY IF EXISTS "Allow all for task_lists" ON task_lists;
CREATE POLICY "Allow all for task_lists" ON task_lists FOR ALL USING (true) WITH CHECK (true);

-- =============================================
-- 2. ADD LIST_ID COLUMN TO LISTS TABLE (Tasks)
-- =============================================
ALTER TABLE lists ADD COLUMN IF NOT EXISTS list_id UUID REFERENCES task_lists(id) ON DELETE SET NULL;

-- =============================================
-- 3. ADD INDEXES FOR PERFORMANCE
-- =============================================
CREATE INDEX IF NOT EXISTS idx_task_lists_space_id ON task_lists(space_id);
CREATE INDEX IF NOT EXISTS idx_task_lists_folder_id ON task_lists(folder_id);
CREATE INDEX IF NOT EXISTS idx_lists_list_id ON lists(list_id);

-- =============================================
-- 4. ADD UPDATE TRIGGER FOR TASK_LISTS
-- =============================================
DROP TRIGGER IF EXISTS update_task_lists_updated_at ON task_lists;
CREATE TRIGGER update_task_lists_updated_at
    BEFORE UPDATE ON task_lists
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- =============================================
-- DONE! New hierarchy:
-- Space > Folder > List (task_lists) > Task (lists)
-- =============================================
