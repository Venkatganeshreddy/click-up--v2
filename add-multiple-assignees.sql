-- Add multiple assignees support to form_responses
-- Run this in Supabase SQL Editor

-- Add assignee_ids column (array of UUIDs)
ALTER TABLE form_responses
ADD COLUMN IF NOT EXISTS assignee_ids UUID[] DEFAULT '{}';

-- Create index for better query performance on assignee_ids
CREATE INDEX IF NOT EXISTS idx_form_responses_assignee_ids
ON form_responses USING GIN (assignee_ids);

-- Migrate existing single assignee to assignee_ids array
UPDATE form_responses
SET assignee_ids = ARRAY[assignee_id]
WHERE assignee_id IS NOT NULL
  AND (assignee_ids IS NULL OR assignee_ids = '{}');

-- Verify the column was added
SELECT column_name, data_type, column_default
FROM information_schema.columns
WHERE table_name = 'form_responses'
  AND column_name = 'assignee_ids';
