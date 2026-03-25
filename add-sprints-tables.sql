-- Sprint Folders table
CREATE TABLE IF NOT EXISTS sprint_folders (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    name VARCHAR(255) NOT NULL DEFAULT 'Sprints',
    space_id UUID REFERENCES spaces(id) ON DELETE CASCADE,
    default_duration INTEGER DEFAULT 14, -- days
    owner_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Sprints table
CREATE TABLE IF NOT EXISTS sprints (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    sprint_folder_id UUID REFERENCES sprint_folders(id) ON DELETE CASCADE,
    space_id UUID REFERENCES spaces(id) ON DELETE CASCADE,
    start_date DATE NOT NULL,
    end_date DATE NOT NULL,
    position INTEGER DEFAULT 0,
    owner_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Add sprint fields to lists (tasks) table
ALTER TABLE lists ADD COLUMN IF NOT EXISTS sprint_id UUID REFERENCES sprints(id) ON DELETE SET NULL;
ALTER TABLE lists ADD COLUMN IF NOT EXISTS sprint_points DECIMAL(10,2);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_sprint_folders_space_id ON sprint_folders(space_id);
CREATE INDEX IF NOT EXISTS idx_sprints_sprint_folder_id ON sprints(sprint_folder_id);
CREATE INDEX IF NOT EXISTS idx_sprints_space_id ON sprints(space_id);
CREATE INDEX IF NOT EXISTS idx_lists_sprint_id ON lists(sprint_id);

-- Enable RLS
ALTER TABLE sprint_folders ENABLE ROW LEVEL SECURITY;
ALTER TABLE sprints ENABLE ROW LEVEL SECURITY;

-- RLS Policies (permissive for development)
CREATE POLICY "Allow all on sprint_folders" ON sprint_folders FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all on sprints" ON sprints FOR ALL USING (true) WITH CHECK (true);

-- Update timestamp triggers
CREATE OR REPLACE FUNCTION update_sprint_folders_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_sprint_folders_updated_at
    BEFORE UPDATE ON sprint_folders
    FOR EACH ROW
    EXECUTE PROCEDURE update_sprint_folders_updated_at();

CREATE OR REPLACE FUNCTION update_sprints_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_sprints_updated_at
    BEFORE UPDATE ON sprints
    FOR EACH ROW
    EXECUTE PROCEDURE update_sprints_updated_at();
