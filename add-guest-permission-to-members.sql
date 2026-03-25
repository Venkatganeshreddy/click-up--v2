-- Add guest workspace permission on members
ALTER TABLE members
  ADD COLUMN IF NOT EXISTS guest_permission VARCHAR(50)
  CHECK (guest_permission IN ('full_edit', 'edit', 'view_only'));

-- Backfill existing guests as view-only if unset
UPDATE members
SET guest_permission = 'view_only'
WHERE role = 'guest' AND guest_permission IS NULL;
