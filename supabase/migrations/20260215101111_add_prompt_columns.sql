-- Adicionar coluna para o Prompt P2 (Estruturação Viral) na tabela de prompts do canal
-- Isso corrige o problema onde o prompt de estruturação não era salvo
ALTER TABLE channel_prompts 
ADD COLUMN IF NOT EXISTS structure_prompt_text TEXT DEFAULT '';

-- Adicionar coluna para rastrear qual prompt foi usado no Job
-- Permite saber qual versão do prompt gerou um determinado vídeo
ALTER TABLE jobs 
ADD COLUMN IF NOT EXISTS applied_prompt_id UUID REFERENCES channel_prompts(id);

-- Comentário para documentação
COMMENT ON COLUMN channel_prompts.structure_prompt_text IS 'Prompt P2: Estruturação Viral (Título, Descrição, Tags)';
COMMENT ON COLUMN jobs.applied_prompt_id IS 'Referência ao prompt (channel_prompts) utilizado neste job';
