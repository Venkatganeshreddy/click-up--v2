-- =============================================
-- FIX FOLDERS TABLE - ADD UPDATED_AT COLUMN
-- =============================================
-- Run this SQL in your Supabase SQL Editor
-- This fixes the "record new has no field updated_at" error
-- =============================================

-- Add updated_at column to folders table
ALTER TABLE folders ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW();

-- Drop existing trigger if any (to recreate it properly)
DROP TRIGGER IF EXISTS update_folders_updated_at ON folders;

-- Create or replace the update function (if it doesn't exist)
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create the trigger for folders
CREATE TRIGGER update_folders_updated_at
    BEFORE UPDATE ON folders
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- =============================================
-- DONE! Folders table now has updated_at column
-- =============================================
