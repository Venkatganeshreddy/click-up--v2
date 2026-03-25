-- Enhanced Forms Tables Migration
-- Run this in your Supabase SQL Editor

-- Add new columns to forms table if they don't exist
ALTER TABLE forms ADD COLUMN IF NOT EXISTS template_type VARCHAR(50) DEFAULT 'custom';
ALTER TABLE forms ADD COLUMN IF NOT EXISTS list_id UUID REFERENCES task_lists(id) ON DELETE SET NULL;
ALTER TABLE forms ADD COLUMN IF NOT EXISTS settings JSONB DEFAULT '{}';
ALTER TABLE forms ADD COLUMN IF NOT EXISTS is_published BOOLEAN DEFAULT false;
ALTER TABLE forms ADD COLUMN IF NOT EXISTS cover_color VARCHAR(20) DEFAULT '#6366f1';
ALTER TABLE forms ADD COLUMN IF NOT EXISTS last_viewed_at TIMESTAMPTZ DEFAULT NOW();

-- Create form_responses table for storing form submissions
CREATE TABLE IF NOT EXISTS form_responses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  form_id UUID NOT NULL REFERENCES forms(id) ON DELETE CASCADE,
  name VARCHAR(255) NOT NULL DEFAULT 'Form Response',
  response_data JSONB DEFAULT '{}',
  status VARCHAR(50) DEFAULT 'backlog',
  assignee_id UUID,
  due_date TIMESTAMPTZ,
  priority VARCHAR(20) DEFAULT 'normal',
  tags TEXT[] DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes for form_responses
CREATE INDEX IF NOT EXISTS idx_form_responses_form_id ON form_responses(form_id);
CREATE INDEX IF NOT EXISTS idx_form_responses_status ON form_responses(status);
CREATE INDEX IF NOT EXISTS idx_form_responses_assignee ON form_responses(assignee_id);

-- Enable RLS on form_responses
ALTER TABLE form_responses ENABLE ROW LEVEL SECURITY;

-- Create policy for form_responses
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'form_responses' AND policyname = 'Allow all access to form_responses') THEN
    CREATE POLICY "Allow all access to form_responses" ON form_responses FOR ALL USING (true) WITH CHECK (true);
  END IF;
END $$;

-- Trigger to update responses_count on forms
CREATE OR REPLACE FUNCTION update_form_responses_count()
RETURNS TRIGGER AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    UPDATE forms SET responses_count = responses_count + 1 WHERE id = NEW.form_id;
  ELSIF TG_OP = 'DELETE' THEN
    UPDATE forms SET responses_count = GREATEST(0, responses_count - 1) WHERE id = OLD.form_id;
  END IF;
  RETURN NULL;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS form_responses_count_trigger ON form_responses;
CREATE TRIGGER form_responses_count_trigger
  AFTER INSERT OR DELETE ON form_responses
  FOR EACH ROW
  EXECUTE FUNCTION update_form_responses_count();

-- Update trigger for form_responses updated_at
CREATE OR REPLACE FUNCTION update_form_responses_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS form_responses_updated_at ON form_responses;
CREATE TRIGGER form_responses_updated_at
  BEFORE UPDATE ON form_responses
  FOR EACH ROW
  EXECUTE FUNCTION update_form_responses_updated_at();
