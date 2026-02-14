-- Create video_projects table
create table if not exists public.video_projects (
  id uuid primary key default gen_random_uuid(),
  channel_id text not null,
  title text not null,
  current_stage text not null, -- enum: 'reference', 'script', 'audio', etc.
  status text not null,        -- enum: 'waiting', 'processing', 'ready', 'error'
  stage_data jsonb default '{}'::jsonb,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- Enable RLS
alter table public.video_projects enable row level security;

-- Create policy to allow all actions for authenticated users (or anon for this desktop app context if strict auth isn't enforced yet)
-- For this desktop app, we are using service_role or user auth. Assuming simple access for now as per previous instructions.
create policy "Allow all access" on public.video_projects
  for all using (true) with check (true);

-- Create indexes for performance
create index if not exists idx_video_projects_channel_id on public.video_projects(channel_id);
create index if not exists idx_video_projects_status on public.video_projects(status);
