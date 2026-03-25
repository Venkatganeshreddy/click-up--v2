-- SQL Migration: Form Responses Table
-- Run this in Supabase SQL Editor

-- Create form_responses table if not exists
CREATE TABLE IF NOT EXISTS form_responses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  form_id UUID NOT NULL REFERENCES forms(id) ON DELETE CASCADE,
  name VARCHAR(500) NOT NULL DEFAULT 'Form Response',
  response_data JSONB NOT NULL DEFAULT '{}',
  status VARCHAR(100) DEFAULT 'to_do',
  status_id UUID REFERENCES task_statuses(id) ON DELETE SET NULL,
  assignee_id UUID REFERENCES members(id) ON DELETE SET NULL,
  due_date TIMESTAMPTZ,
  priority VARCHAR(50) DEFAULT 'normal',
  tags TEXT[] DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_form_responses_form_id ON form_responses(form_id);
CREATE INDEX IF NOT EXISTS idx_form_responses_status ON form_responses(status);
CREATE INDEX IF NOT EXISTS idx_form_responses_assignee_id ON form_responses(assignee_id);
CREATE INDEX IF NOT EXISTS idx_form_responses_created_at ON form_responses(created_at);

-- Enable RLS
ALTER TABLE form_responses ENABLE ROW LEVEL SECURITY;

-- Create permissive policy (allow all operations for now)
DROP POLICY IF EXISTS "Allow all form_responses operations" ON form_responses;
CREATE POLICY "Allow all form_responses operations" ON form_responses
  FOR ALL USING (true) WITH CHECK (true);

-- Create trigger for updated_at
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

-- Update forms table to track response count (trigger)
CREATE OR REPLACE FUNCTION update_form_responses_count()
RETURNS TRIGGER AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    UPDATE forms SET responses_count = responses_count + 1, updated_at = NOW() WHERE id = NEW.form_id;
  ELSIF TG_OP = 'DELETE' THEN
    UPDATE forms SET responses_count = GREATEST(0, responses_count - 1), updated_at = NOW() WHERE id = OLD.form_id;
  END IF;
  RETURN NULL;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS form_responses_count_trigger ON form_responses;
CREATE TRIGGER form_responses_count_trigger
  AFTER INSERT OR DELETE ON form_responses
  FOR EACH ROW
  EXECUTE FUNCTION update_form_responses_count();

-- Verify the table exists
SELECT 'form_responses table ready' as status;
