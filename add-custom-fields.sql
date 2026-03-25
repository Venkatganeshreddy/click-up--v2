-- =============================================
-- CUSTOM FIELDS FEATURE - DATABASE SCHEMA
-- =============================================
-- Run this SQL in your Supabase SQL Editor
-- This creates tables for custom fields functionality
-- =============================================

-- =============================================
-- 1. CUSTOM_FIELDS TABLE (Field Definitions)
-- =============================================
CREATE TABLE IF NOT EXISTS custom_fields (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    type VARCHAR(50) NOT NULL CHECK (type IN (
        -- Basic fields
        'dropdown', 'text', 'textarea', 'number', 'date', 'checkbox',
        -- Contact fields
        'email', 'url', 'phone', 'website',
        -- Advanced fields
        'currency', 'money', 'labels', 'people', 'files', 'location',
        -- Progress fields
        'progress_auto', 'progress_manual', 'progress_updates',
        -- Relationship fields
        'relationship', 'tasks',
        -- Rating fields
        'rating', 'voting',
        -- AI fields
        'ai_summary', 'ai_custom_text', 'ai_custom_dropdown',
        'translation', 'sentiment', 'categorize',
        -- Formula
        'formula'
    )),

    -- Field configuration (stored as JSONB for flexibility)
    -- For dropdown: { options: [{ id, name, color }], sorting: 'manual' | 'name_asc' | 'name_desc' }
    -- For number: { precision: 0-4, prefix: '$', suffix: '%' }
    -- For people: { show_workspace: true, show_guests: false, multiple: true, include_teams: false }
    -- For text: { default_value: '' }
    -- For rating: { emoji: 'star', count: 5 }
    -- For voting: { emoji: 'thumbsup', hide_voters: false }
    -- For money: { currency_type: 'USD', precision: 2 }
    -- For progress: { progress_source: 'subtasks', start_value: 0, end_value: 100 }
    type_config JSONB DEFAULT '{}',

    -- Location: where this field is available
    space_id UUID REFERENCES spaces(id) ON DELETE CASCADE,
    folder_id UUID REFERENCES folders(id) ON DELETE SET NULL,
    list_id UUID REFERENCES task_lists(id) ON DELETE SET NULL,

    -- Settings
    description TEXT,
    default_value TEXT,
    is_required BOOLEAN DEFAULT false,
    is_pinned BOOLEAN DEFAULT false,
    is_visible_to_guests BOOLEAN DEFAULT true,
    is_private BOOLEAN DEFAULT false,
    position INTEGER DEFAULT 0,

    -- Metadata
    created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Enable RLS
ALTER TABLE custom_fields ENABLE ROW LEVEL SECURITY;

-- Allow all for development
DROP POLICY IF EXISTS "Allow all for custom_fields" ON custom_fields;
CREATE POLICY "Allow all for custom_fields" ON custom_fields FOR ALL USING (true) WITH CHECK (true);

-- =============================================
-- 2. CUSTOM_FIELD_VALUES TABLE (Task Values)
-- =============================================
CREATE TABLE IF NOT EXISTS custom_field_values (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    task_id UUID NOT NULL REFERENCES lists(id) ON DELETE CASCADE,
    field_id UUID NOT NULL REFERENCES custom_fields(id) ON DELETE CASCADE,

    -- Value storage (different columns for different types)
    value_text TEXT,                    -- For text, email, url, phone
    value_number DECIMAL,               -- For number, currency
    value_boolean BOOLEAN,              -- For checkbox
    value_date TIMESTAMP WITH TIME ZONE, -- For date
    value_json JSONB,                   -- For dropdown (option id), people (array of ids), labels

    -- Metadata
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),

    -- Unique constraint: one value per field per task
    UNIQUE(task_id, field_id)
);

-- Enable RLS
ALTER TABLE custom_field_values ENABLE ROW LEVEL SECURITY;

-- Allow all for development
DROP POLICY IF EXISTS "Allow all for custom_field_values" ON custom_field_values;
CREATE POLICY "Allow all for custom_field_values" ON custom_field_values FOR ALL USING (true) WITH CHECK (true);

-- =============================================
-- 3. INDEXES FOR PERFORMANCE
-- =============================================
CREATE INDEX IF NOT EXISTS idx_custom_fields_space_id ON custom_fields(space_id);
CREATE INDEX IF NOT EXISTS idx_custom_fields_folder_id ON custom_fields(folder_id);
CREATE INDEX IF NOT EXISTS idx_custom_fields_list_id ON custom_fields(list_id);
CREATE INDEX IF NOT EXISTS idx_custom_fields_type ON custom_fields(type);
CREATE INDEX IF NOT EXISTS idx_custom_field_values_task_id ON custom_field_values(task_id);
CREATE INDEX IF NOT EXISTS idx_custom_field_values_field_id ON custom_field_values(field_id);

-- =============================================
-- 4. UPDATE TRIGGERS
-- =============================================
DROP TRIGGER IF EXISTS update_custom_fields_updated_at ON custom_fields;
CREATE TRIGGER update_custom_fields_updated_at
    BEFORE UPDATE ON custom_fields
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_custom_field_values_updated_at ON custom_field_values;
CREATE TRIGGER update_custom_field_values_updated_at
    BEFORE UPDATE ON custom_field_values
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- =============================================
-- 5. UPDATE CHECK CONSTRAINT (for existing databases)
-- =============================================
-- If you've already created the table with old field types, run this:
DO $$
BEGIN
    -- Drop old constraint if exists
    ALTER TABLE custom_fields DROP CONSTRAINT IF EXISTS custom_fields_type_check;

    -- Add new constraint with all field types
    ALTER TABLE custom_fields ADD CONSTRAINT custom_fields_type_check CHECK (type IN (
        'dropdown', 'text', 'textarea', 'number', 'date', 'checkbox',
        'email', 'url', 'phone', 'website',
        'currency', 'money', 'labels', 'people', 'files', 'location',
        'progress_auto', 'progress_manual', 'progress_updates',
        'relationship', 'tasks',
        'rating', 'voting',
        'ai_summary', 'ai_custom_text', 'ai_custom_dropdown',
        'translation', 'sentiment', 'categorize',
        'formula'
    ));
EXCEPTION WHEN OTHERS THEN
    -- Constraint may already be correct or table doesn't exist
    NULL;
END $$;

-- =============================================
-- DONE! Custom Fields schema is ready
-- =============================================
