-- =============================================
-- FIX: Task Status Strict Isolation
-- =============================================
-- This migration adds sprint_id to task_statuses
-- and ensures proper isolation between scopes
-- =============================================

-- Add sprint_id column if it doesn't exist
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'task_statuses' AND column_name = 'sprint_id'
    ) THEN
        ALTER TABLE task_statuses ADD COLUMN sprint_id UUID REFERENCES sprints(id) ON DELETE CASCADE;
    END IF;
END $$;

-- Create index for sprint_id lookups
CREATE INDEX IF NOT EXISTS idx_task_statuses_sprint ON task_statuses(sprint_id);

-- Remove the inherit_from_parent column if it exists (no longer needed with strict isolation)
-- We keep the column but it won't be used anymore
-- ALTER TABLE task_statuses DROP COLUMN IF EXISTS inherit_from_parent;

-- =============================================
-- DONE! Sprint statuses are now supported
-- =============================================
