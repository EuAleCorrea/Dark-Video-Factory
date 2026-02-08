-- TABELA DE JOBS (Orquestração Central)
CREATE TABLE IF NOT EXISTS public.jobs (
    id UUID PRIMARY KEY,
    channel_id TEXT NOT NULL,
    model_channel TEXT,
    reference_script TEXT,
    theme TEXT NOT NULL,
    status TEXT NOT NULL,
    current_step TEXT NOT NULL,
    progress INTEGER DEFAULT 0,
    logs JSONB DEFAULT '[]'::jsonb,
    files JSONB DEFAULT '[]'::jsonb,
    result JSONB DEFAULT '{}'::jsonb,
    metadata JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Habilitar Realtime para a tabela jobs
ALTER PUBLICATION supabase_realtime ADD TABLE public.jobs;

-- POLÍTICAS DE SEGURANÇA (RLS)
-- Por enquanto, permitimos tudo para facilitar o teste local
ALTER TABLE public.jobs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Permitir tudo para anon" ON public.jobs FOR ALL USING (true) WITH CHECK (true);
