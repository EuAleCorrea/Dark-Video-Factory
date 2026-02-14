-- Dark Video Factory — Pipeline Kanban
-- Migration: Create video_projects table

CREATE TABLE IF NOT EXISTS video_projects (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  channel_id TEXT NOT NULL,
  title TEXT NOT NULL DEFAULT 'Sem Título',
  current_stage TEXT NOT NULL DEFAULT 'reference',
  status TEXT NOT NULL DEFAULT 'waiting',
  stage_data JSONB NOT NULL DEFAULT '{}',
  error_message TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Indexes for common queries
CREATE INDEX IF NOT EXISTS idx_video_projects_channel ON video_projects(channel_id);
CREATE INDEX IF NOT EXISTS idx_video_projects_stage ON video_projects(current_stage);
CREATE INDEX IF NOT EXISTS idx_video_projects_status ON video_projects(status);

-- RLS
ALTER TABLE video_projects ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow all for authenticated" ON video_projects
  FOR ALL
  USING (true)
  WITH CHECK (true);

-- Trigger to auto-update updated_at
CREATE OR REPLACE FUNCTION update_modified_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER set_updated_at
  BEFORE UPDATE ON video_projects
  FOR EACH ROW
  EXECUTE FUNCTION update_modified_column();
