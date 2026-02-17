/**
 * GEMINI KEY MANAGER
 * Gerencia múltiplas chaves de API do Google Gemini com rotação automática.
 * Segue o mesmo padrão do apifyClient.ts.
 */

/**
 * Extrai múltiplas chaves do campo (separadas por vírgula, ponto-e-vírgula ou nova linha).
 */
export const parseGeminiKeys = (keyField: string): string[] => {
    return keyField
        .split(/[,;\n]+/)
        .map(k => k.trim())
        .filter(k => k.length > 0);
};

/**
 * Mascara uma chave para exibição segura. Ex: "AIzaSyBx...abc" → "AIzaS...abc"
 */
export const maskGeminiKey = (key: string): string => {
    if (key.length <= 8) return '***';
    return `${key.substring(0, 5)}...${key.substring(key.length - 3)}`;
};

/**
 * Verifica se um erro é retryable (quota/rate limit) — justifica tentar a próxima chave.
 */
export const isGeminiRetryableError = (errorMsg: string): boolean => {
    const retryablePatterns = [
        '429',
        'RESOURCE_EXHAUSTED',
        'quota',
        'rate limit',
        'too many requests',
        '403',
        'PERMISSION_DENIED',
        'API key not valid',
        'API_KEY_INVALID',
    ];
    const lower = errorMsg.toLowerCase();
    return retryablePatterns.some(p => lower.includes(p.toLowerCase()));
};

/**
 * Wrapper genérico de rotação de chaves Gemini.
 * Tenta executar `fn` com cada chave em sequência.
 * Se a chave falhar com erro retryable, tenta a próxima.
 * Se for erro não-retryable ou última chave, lança o erro.
 */
export async function withGeminiKeyRotation<T>(
    geminiKeyField: string,
    fn: (apiKey: string, keyIndex: number, totalKeys: number) => Promise<T>
): Promise<T> {
    const keys = parseGeminiKeys(geminiKeyField);

    if (keys.length === 0) {
        throw new Error("Nenhuma chave Gemini configurada. Vá em Configurações.");
    }

    // Se só tem 1 chave, executa direto sem overhead de rotação
    if (keys.length === 1) {
        return fn(keys[0], 0, 1);
    }

    const errors: string[] = [];

    for (let i = 0; i < keys.length; i++) {
        const masked = maskGeminiKey(keys[i]);
        try {
            console.log(`[Gemini] 🔑 Usando chave ${i + 1}/${keys.length} (${masked})`);
            return await fn(keys[i], i, keys.length);
        } catch (err) {
            const msg = err instanceof Error ? err.message : String(err);
            errors.push(`Chave ${i + 1} (${masked}): ${msg}`);

            if (isGeminiRetryableError(msg) && i < keys.length - 1) {
                console.warn(`[Gemini] ⏭️ Chave ${i + 1} falhou (${masked}), tentando próxima...`);
                continue;
            }

            // Erro não-retryable ou última chave → lança
            throw err;
        }
    }

    // Se chegou aqui, todas falharam com erros retryable
    throw new Error(
        `🚫 Todas as ${keys.length} chaves Gemini falharam!\n` +
        errors.join('\n')
    );
}
