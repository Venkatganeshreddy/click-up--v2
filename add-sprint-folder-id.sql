-- Add folder_id to sprints so sprints can belong to regular folders
ALTER TABLE sprints ADD COLUMN IF NOT EXISTS folder_id UUID REFERENCES folders(id) ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS idx_sprints_folder_id ON sprints(folder_id);
