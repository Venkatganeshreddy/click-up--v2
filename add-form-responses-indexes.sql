-- Add indexes to form_responses table for faster queries

-- Index on form_id for filtering responses by form (most common query)
CREATE INDEX IF NOT EXISTS idx_form_responses_form_id ON form_responses(form_id);

-- Composite index for form_id + created_at for sorted queries
CREATE INDEX IF NOT EXISTS idx_form_responses_form_created ON form_responses(form_id, created_at DESC);

-- Index on status for filtering/grouping by status
CREATE INDEX IF NOT EXISTS idx_form_responses_status ON form_responses(status);

-- Index on assignee_id for filtering by assignee
CREATE INDEX IF NOT EXISTS idx_form_responses_assignee ON form_responses(assignee_id);

-- Add index on forms table for faster form lookups
CREATE INDEX IF NOT EXISTS idx_forms_space_id ON forms(space_id);
CREATE INDEX IF NOT EXISTS idx_forms_folder_id ON forms(folder_id);

-- Analyze tables to update query planner statistics
ANALYZE form_responses;
ANALYZE forms;
