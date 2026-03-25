-- Add description column to form_responses table
ALTER TABLE form_responses ADD COLUMN IF NOT EXISTS description TEXT;
