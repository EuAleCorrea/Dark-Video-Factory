-- 1. Criação da tabela video_projects (se não existir)
CREATE TABLE IF NOT EXISTS video_projects (
    id UUID PRIMARY KEY,
    channel_id UUID, -- removi FK direto para profiles para maior flexibilidade se o perfil for deletado, mas ideal seria ON DELETE SET NULL
    title TEXT NOT NULL,
    current_stage TEXT NOT NULL DEFAULT 'REFERENCE',
    status TEXT NOT NULL DEFAULT 'waiting',
    stage_data JSONB DEFAULT '{}'::jsonb,
    error_message TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    CONSTRAINT fk_channel FOREIGN KEY(channel_id) REFERENCES profiles(id) ON DELETE SET NULL
);

-- 2. Habilitar RLS
ALTER TABLE video_projects ENABLE ROW LEVEL SECURITY;

-- 3. Remover políticas antigas para evitar conflitos
DROP POLICY IF EXISTS "Public Access Video Projects" ON video_projects;

-- 4. Criar política de acesso total (igual fizemos para profiles/prompts)
CREATE POLICY "Public Access Video Projects" ON video_projects
FOR ALL
USING (true)
WITH CHECK (true);

-- Comentários para documentação
COMMENT ON TABLE video_projects IS 'Tabela principal de projetos de vídeo (Kanban)';
COMMENT ON COLUMN video_projects.stage_data IS 'Armazena dados específicos de cada estágio (Reference, Script, Audio, etc) em JSON';
