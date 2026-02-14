-- ============================================================
-- engine_secrets: Armazena chaves de API com criptografia AES-256
-- ============================================================

-- 1. Habilitar pgcrypto (se ainda não estiver)
CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- 2. Definir a passphrase de criptografia como parâmetro do banco
-- IMPORTANTE: Altere 'DarkFactory_S3cret_P@ssphrase_2024!' para uma senha forte e única
DO $$
BEGIN
  PERFORM set_config('app.encryption_key', 'DarkFactory_S3cret_P@ssphrase_2024!', false);
EXCEPTION WHEN OTHERS THEN
  RAISE NOTICE 'Config parameter already set';
END $$;

-- 3. Criar tabela de secrets
CREATE TABLE IF NOT EXISTS engine_secrets (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  key_name TEXT NOT NULL UNIQUE,
  encrypted_value BYTEA NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 4. Índice para busca rápida por nome da chave
CREATE INDEX IF NOT EXISTS idx_engine_secrets_key_name ON engine_secrets(key_name);

-- 5. Trigger para atualizar updated_at
CREATE OR REPLACE FUNCTION update_engine_secrets_timestamp()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_engine_secrets_updated ON engine_secrets;
CREATE TRIGGER trigger_engine_secrets_updated
  BEFORE UPDATE ON engine_secrets
  FOR EACH ROW
  EXECUTE FUNCTION update_engine_secrets_timestamp();

-- 6. RPC: Salvar secret (criptografa antes de armazenar)
CREATE OR REPLACE FUNCTION upsert_secret(p_key_name TEXT, p_value TEXT, p_passphrase TEXT)
RETURNS void AS $$
BEGIN
  INSERT INTO engine_secrets (key_name, encrypted_value)
  VALUES (p_key_name, pgp_sym_encrypt(p_value, p_passphrase))
  ON CONFLICT (key_name) DO UPDATE
  SET encrypted_value = pgp_sym_encrypt(p_value, p_passphrase),
      updated_at = NOW();
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 7. RPC: Ler secret (descriptografa na leitura)
CREATE OR REPLACE FUNCTION read_secret(p_key_name TEXT, p_passphrase TEXT)
RETURNS TEXT AS $$
DECLARE
  result TEXT;
BEGIN
  SELECT pgp_sym_decrypt(encrypted_value, p_passphrase)
  INTO result
  FROM engine_secrets
  WHERE key_name = p_key_name;
  RETURN result;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 8. RPC: Ler todos os secrets (descriptografa em lote)
CREATE OR REPLACE FUNCTION read_all_secrets(p_passphrase TEXT)
RETURNS TABLE(key_name TEXT, secret_value TEXT) AS $$
BEGIN
  RETURN QUERY
  SELECT es.key_name, pgp_sym_decrypt(es.encrypted_value, p_passphrase)::TEXT
  FROM engine_secrets es;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 9. RPC: Deletar secret
CREATE OR REPLACE FUNCTION delete_secret(p_key_name TEXT)
RETURNS void AS $$
BEGIN
  DELETE FROM engine_secrets WHERE key_name = p_key_name;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 10. Habilitar RLS
ALTER TABLE engine_secrets ENABLE ROW LEVEL SECURITY;

-- 11. Política permissiva (ajustar conforme necessidade de auth)
CREATE POLICY "Allow all operations on engine_secrets"
  ON engine_secrets FOR ALL
  USING (true)
  WITH CHECK (true);
