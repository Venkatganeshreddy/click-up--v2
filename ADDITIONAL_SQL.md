# Additional SQL for ClickUp Clone

Run this SQL in your Supabase SQL Editor to add the new tables for Workspace/Space/Folder/List management.

```sql
-- Spaces table (like ClickUp Spaces)
CREATE TABLE IF NOT EXISTS spaces (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  description TEXT,
  color TEXT DEFAULT '#6366f1',
  icon TEXT DEFAULT 'folder',
  owner_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Folders table (organize lists within spaces)
CREATE TABLE IF NOT EXISTS folders (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  space_id UUID REFERENCES spaces(id) ON DELETE CASCADE,
  owner_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Lists table (containers for tasks)
CREATE TABLE IF NOT EXISTS lists (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  space_id UUID REFERENCES spaces(id) ON DELETE CASCADE,
  folder_id UUID REFERENCES folders(id) ON DELETE SET NULL,
  statuses JSONB DEFAULT '[{"name": "To Do", "color": "#94a3b8", "order": 0}, {"name": "In Progress", "color": "#3b82f6", "order": 1}, {"name": "Review", "color": "#f59e0b", "order": 2}, {"name": "Done", "color": "#22c55e", "order": 3}]'::jsonb,
  owner_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Update tasks table to reference lists (optional - if you want tasks in lists)
ALTER TABLE tasks ADD COLUMN IF NOT EXISTS list_id UUID REFERENCES lists(id) ON DELETE CASCADE;

-- Enable RLS
ALTER TABLE spaces ENABLE ROW LEVEL SECURITY;
ALTER TABLE folders ENABLE ROW LEVEL SECURITY;
ALTER TABLE lists ENABLE ROW LEVEL SECURITY;

-- Policies for spaces
CREATE POLICY "Users can CRUD own spaces" ON spaces
  FOR ALL USING (auth.uid() = owner_id);

-- Policies for folders
CREATE POLICY "Users can CRUD folders in own spaces" ON folders
  FOR ALL USING (
    space_id IN (SELECT id FROM spaces WHERE owner_id = auth.uid())
  );

-- Policies for lists
CREATE POLICY "Users can CRUD lists in own spaces" ON lists
  FOR ALL USING (
    space_id IN (SELECT id FROM spaces WHERE owner_id = auth.uid())
  );

-- Comments table (for task comments)
CREATE TABLE IF NOT EXISTS comments (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  content TEXT NOT NULL,
  task_id UUID REFERENCES tasks(id) ON DELETE CASCADE,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE comments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can CRUD comments on accessible tasks" ON comments
  FOR ALL USING (
    task_id IN (
      SELECT t.id FROM tasks t
      JOIN projects p ON t.project_id = p.id
      WHERE p.owner_id = auth.uid()
    )
  );

-- Team members table (for workspace collaboration)
CREATE TABLE IF NOT EXISTS team_members (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  invited_email TEXT,
  role TEXT DEFAULT 'member' CHECK (role IN ('owner', 'admin', 'member')),
  workspace_owner_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'accepted', 'rejected')),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE team_members ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage their team" ON team_members
  FOR ALL USING (auth.uid() = workspace_owner_id OR auth.uid() = user_id);

-- Activities table (for activity feed)
CREATE TABLE IF NOT EXISTS activities (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  action TEXT NOT NULL,
  entity_type TEXT NOT NULL,
  entity_id UUID NOT NULL,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  details JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE activities ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view activities for accessible entities" ON activities
  FOR SELECT USING (
    entity_type = 'project' AND entity_id IN (SELECT id FROM projects WHERE owner_id = auth.uid())
    OR
    entity_type = 'task' AND entity_id IN (
      SELECT t.id FROM tasks t
      JOIN projects p ON t.project_id = p.id
      WHERE p.owner_id = auth.uid()
    )
  );

CREATE POLICY "Users can create activities for accessible entities" ON activities
  FOR INSERT WITH CHECK (
    entity_type = 'project' AND entity_id IN (SELECT id FROM projects WHERE owner_id = auth.uid())
    OR
    entity_type = 'task' AND entity_id IN (
      SELECT t.id FROM tasks t
      JOIN projects p ON t.project_id = p.id
      WHERE p.owner_id = auth.uid()
    )
  );

-- Add tags column to tasks table if it doesn't exist
ALTER TABLE tasks ADD COLUMN IF NOT EXISTS tags TEXT[] DEFAULT '{}';

-- Add sprints table for sprint management
CREATE TABLE IF NOT EXISTS sprints (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  goal TEXT,
  start_date TIMESTAMPTZ,
  end_date TIMESTAMPTZ,
  status TEXT DEFAULT 'PLANNING' CHECK (status IN ('PLANNING', 'ACTIVE', 'COMPLETED')),
  owner_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE sprints ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can CRUD own sprints" ON sprints
  FOR ALL USING (auth.uid() = owner_id);

-- Add sprint_id to tasks table
ALTER TABLE tasks ADD COLUMN IF NOT EXISTS sprint_id UUID REFERENCES sprints(id) ON DELETE SET NULL;
```
