-- Add view_settings JSONB column to sprints and task_lists tables
-- This stores per-list/sprint column order, visibility, and other view preferences

ALTER TABLE sprints ADD COLUMN IF NOT EXISTS view_settings JSONB DEFAULT '{}';
ALTER TABLE task_lists ADD COLUMN IF NOT EXISTS view_settings JSONB DEFAULT '{}';
