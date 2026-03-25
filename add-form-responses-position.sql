-- Add position column to form_responses for drag-and-drop reordering
ALTER TABLE form_responses ADD COLUMN IF NOT EXISTS position INTEGER DEFAULT 0;

-- Backfill existing rows with sequential positions per form (ordered by created_at)
WITH ranked AS (
  SELECT id, ROW_NUMBER() OVER (PARTITION BY form_id ORDER BY created_at ASC) - 1 AS pos
  FROM form_responses
)
UPDATE form_responses
SET position = ranked.pos
FROM ranked
WHERE form_responses.id = ranked.id;
