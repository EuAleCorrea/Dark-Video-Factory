-- 1. Habilitar RLS para garantir que as políticas se apliquem
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE channel_prompts ENABLE ROW LEVEL SECURITY;
ALTER TABLE jobs ENABLE ROW LEVEL SECURITY;

-- 2. Remover políticas antigas para evitar duplicidade ou conflitos
DROP POLICY IF EXISTS "Public Access Prompts" ON channel_prompts;
DROP POLICY IF EXISTS "Public Access Jobs" ON jobs;
DROP POLICY IF EXISTS "Public Access Profiles" ON profiles;

-- 3. Criar políticas irrestritas (FULL ACCESS) para facilitar uso local/single-user
-- Isso libera inserts/selects/updates/deletes para quem tiver a URL+ANON KEY correta.
CREATE POLICY "Public Access Prompts" ON channel_prompts
FOR ALL
USING (true)
WITH CHECK (true);

CREATE POLICY "Public Access Jobs" ON jobs
FOR ALL
USING (true)
WITH CHECK (true);

CREATE POLICY "Public Access Profiles" ON profiles
FOR ALL
USING (true)
WITH CHECK (true);
