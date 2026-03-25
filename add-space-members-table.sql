-- =============================================
-- SPACE MEMBERS TABLE - For assigning members to spaces
-- =============================================
-- Run this SQL in your Supabase SQL Editor
-- =============================================

-- Create space_members table
CREATE TABLE IF NOT EXISTS space_members (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    space_id UUID NOT NULL REFERENCES spaces(id) ON DELETE CASCADE,
    member_id UUID NOT NULL REFERENCES members(id) ON DELETE CASCADE,

    -- Permission levels: full_edit, edit, comment, view_only
    permission VARCHAR(50) DEFAULT 'edit' CHECK (permission IN ('full_edit', 'edit', 'comment', 'view_only')),

    -- Who added this member
    added_by UUID REFERENCES members(id) ON DELETE SET NULL,

    -- Timestamps
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),

    -- Unique constraint - one member per space
    UNIQUE(space_id, member_id)
);

-- Enable RLS
ALTER TABLE space_members ENABLE ROW LEVEL SECURITY;

-- Allow ALL operations (development mode)
DROP POLICY IF EXISTS "Allow all for space_members" ON space_members;
CREATE POLICY "Allow all for space_members" ON space_members FOR ALL USING (true) WITH CHECK (true);

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_space_members_space_id ON space_members(space_id);
CREATE INDEX IF NOT EXISTS idx_space_members_member_id ON space_members(member_id);

-- Add trigger for updated_at
DROP TRIGGER IF EXISTS update_space_members_updated_at ON space_members;
CREATE TRIGGER update_space_members_updated_at
    BEFORE UPDATE ON space_members
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- =============================================
-- DONE! Space members table is ready.
-- =============================================
-- Permission levels:
-- - full_edit: Can create/edit/delete, manage Space settings
-- - edit: Can create/edit, can't manage settings or delete
-- - comment: Can only comment on items
-- - view_only: Read-only access
-- =============================================
