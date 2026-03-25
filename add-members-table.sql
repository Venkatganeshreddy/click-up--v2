-- =============================================
-- MEMBERS TABLE - For Team Member Invitations
-- =============================================
-- Run this SQL in your Supabase SQL Editor
-- Go to: https://supabase.com/dashboard > Your Project > SQL Editor
-- =============================================

-- Drop if exists (for clean re-run)
DROP TABLE IF EXISTS members CASCADE;

-- Create members table
CREATE TABLE members (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    email VARCHAR(255) NOT NULL,
    name VARCHAR(255) NOT NULL,
    role VARCHAR(50) DEFAULT 'member' CHECK (role IN ('admin', 'member', 'limited_member', 'guest')),
    guest_permission VARCHAR(50) CHECK (guest_permission IN ('full_edit', 'edit', 'view_only')),
    status VARCHAR(50) DEFAULT 'pending' CHECK (status IN ('pending', 'active')),

    -- Workspace/Space association (optional)
    workspace_id UUID,
    space_id UUID REFERENCES spaces(id) ON DELETE SET NULL,

    -- Password storage (for admin reference)
    default_password VARCHAR(255),
    current_password VARCHAR(255),
    password_changed BOOLEAN DEFAULT FALSE,
    password_changed_at TIMESTAMP WITH TIME ZONE,

    -- Invitation fields
    invite_token VARCHAR(255),
    invite_expires_at TIMESTAMP WITH TIME ZONE,
    invited_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),

    -- When user accepts the invite
    joined_at TIMESTAMP WITH TIME ZONE,
    user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,

    -- Timestamps
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),

    -- Unique constraint on email to prevent duplicate invites
    UNIQUE(email)
);

-- Enable RLS for members
ALTER TABLE members ENABLE ROW LEVEL SECURITY;

-- Allow ALL operations for everyone (development mode)
DROP POLICY IF EXISTS "Allow all for members" ON members;
CREATE POLICY "Allow all for members" ON members FOR ALL USING (true) WITH CHECK (true);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_members_email ON members(email);
CREATE INDEX IF NOT EXISTS idx_members_status ON members(status);
CREATE INDEX IF NOT EXISTS idx_members_invite_token ON members(invite_token);
CREATE INDEX IF NOT EXISTS idx_members_workspace_id ON members(workspace_id);

-- Add trigger for updated_at
DROP TRIGGER IF EXISTS update_members_updated_at ON members;
CREATE TRIGGER update_members_updated_at
    BEFORE UPDATE ON members
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- =============================================
-- DONE! Members table is ready.
-- =============================================
-- Columns:
-- - id: Unique identifier
-- - email: Email address of invited member
-- - name: Name of the member
-- - role: admin, member, limited_member, or guest
-- - status: pending (invited) or active (joined)
-- - invite_token: Token for accepting invitation
-- - invite_expires_at: When the invitation expires
-- - invited_at: When the invitation was sent
-- - joined_at: When the user accepted the invitation
-- =============================================
