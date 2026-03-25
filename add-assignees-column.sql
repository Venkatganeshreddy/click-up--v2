-- =============================================
-- ADD ASSIGNEES COLUMN FOR MULTIPLE ASSIGNEES
-- =============================================
-- Run this SQL in your Supabase SQL Editor
-- This adds support for multiple assignees on tasks
-- =============================================

-- Add assignees column (TEXT array) to lists table
ALTER TABLE lists ADD COLUMN IF NOT EXISTS assignees TEXT[];

-- Create index for performance on assignees queries
CREATE INDEX IF NOT EXISTS idx_lists_assignees ON lists USING GIN(assignees);

-- =============================================
-- DONE! Tasks now support multiple assignees
-- The assignees column stores an array of names
-- =============================================
