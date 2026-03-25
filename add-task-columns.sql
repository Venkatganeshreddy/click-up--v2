-- =============================================
-- ADD TASK COLUMNS TO LISTS TABLE
-- Run this in Supabase SQL Editor
-- =============================================

-- Add missing columns to lists table (if they don't exist)
DO $$
BEGIN
    -- Add status column
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'lists' AND column_name = 'status') THEN
        ALTER TABLE lists ADD COLUMN status VARCHAR(50) DEFAULT 'To Do';
    END IF;

    -- Add priority column
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'lists' AND column_name = 'priority') THEN
        ALTER TABLE lists ADD COLUMN priority VARCHAR(20) DEFAULT 'MEDIUM';
    END IF;

    -- Add due_date column
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'lists' AND column_name = 'due_date') THEN
        ALTER TABLE lists ADD COLUMN due_date DATE;
    END IF;

    -- Add start_date column
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'lists' AND column_name = 'start_date') THEN
        ALTER TABLE lists ADD COLUMN start_date DATE;
    END IF;

    -- Add position column
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'lists' AND column_name = 'position') THEN
        ALTER TABLE lists ADD COLUMN position INTEGER DEFAULT 0;
    END IF;

    -- Add assignee_id column
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'lists' AND column_name = 'assignee_id') THEN
        ALTER TABLE lists ADD COLUMN assignee_id UUID REFERENCES auth.users(id) ON DELETE SET NULL;
    END IF;

    -- Add assignee_name column
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'lists' AND column_name = 'assignee_name') THEN
        ALTER TABLE lists ADD COLUMN assignee_name VARCHAR(255);
    END IF;

    -- Add estimated_hours column
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'lists' AND column_name = 'estimated_hours') THEN
        ALTER TABLE lists ADD COLUMN estimated_hours DECIMAL(10,2);
    END IF;

    -- Add tags column
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'lists' AND column_name = 'tags') THEN
        ALTER TABLE lists ADD COLUMN tags TEXT[];
    END IF;

    -- Add is_completed column
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'lists' AND column_name = 'is_completed') THEN
        ALTER TABLE lists ADD COLUMN is_completed BOOLEAN DEFAULT FALSE;
    END IF;

    -- Add completed_date column
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'lists' AND column_name = 'completed_date') THEN
        ALTER TABLE lists ADD COLUMN completed_date TIMESTAMP WITH TIME ZONE;
    END IF;

    -- Add task_type column
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'lists' AND column_name = 'task_type') THEN
        ALTER TABLE lists ADD COLUMN task_type VARCHAR(50) DEFAULT 'Task';
    END IF;

    -- Add tracked_time column (in minutes)
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'lists' AND column_name = 'tracked_time') THEN
        ALTER TABLE lists ADD COLUMN tracked_time INTEGER DEFAULT 0;
    END IF;

    -- Add checklists column (JSONB for storing checklist data)
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'lists' AND column_name = 'checklists') THEN
        ALTER TABLE lists ADD COLUMN checklists JSONB DEFAULT '[]'::jsonb;
    END IF;

END $$;

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_lists_status ON lists(status);
CREATE INDEX IF NOT EXISTS idx_lists_priority ON lists(priority);
CREATE INDEX IF NOT EXISTS idx_lists_due_date ON lists(due_date);
CREATE INDEX IF NOT EXISTS idx_lists_assignee_id ON lists(assignee_id);

-- Verify columns were added
SELECT column_name, data_type
FROM information_schema.columns
WHERE table_name = 'lists'
ORDER BY ordinal_position;
