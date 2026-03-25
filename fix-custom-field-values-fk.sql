-- =============================================
-- FIX: Custom Field Values Foreign Key Constraint
-- =============================================
-- The task_id column was incorrectly referencing lists(id)
-- It should allow both tasks and form_responses IDs
-- =============================================

-- Drop the incorrect foreign key constraint
ALTER TABLE custom_field_values
DROP CONSTRAINT IF EXISTS custom_field_values_task_id_fkey;

-- The task_id column will now accept any UUID
-- This allows custom field values to be set for:
-- 1. Tasks (from tasks table)
-- 2. Form Responses (from form_responses table)

-- Note: We're intentionally NOT adding a new foreign key constraint
-- because the task_id can reference either tasks or form_responses table

-- =============================================
-- DONE! Custom field values can now be set for form responses
-- =============================================
