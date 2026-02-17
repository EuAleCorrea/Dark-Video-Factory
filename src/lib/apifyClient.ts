/**
 * APIFY CLIENT SERVICE
 * Responsável por orquestrar a extração de dados via Apify Actors.
 * Suporta múltiplas chaves com rotação automática (failover).
 */

const APIFY_BASE_URL = 'https://api.apify.com/v2';
const ACTOR_ID = 'starvibe~youtube-video-transcript';

interface ApifyRun {
    id: string;
    defaultDatasetId: string;
    status: 'READY' | 'RUNNING' | 'SUCCEEDED' | 'FAILED' | 'TIMED-OUT' | 'ABORTED';
}

export interface ApifyAccountInfo {
    username: string;
    plan: string;
    usageUsd: number;
    limitUsd: number;
    isLimitReached: boolean;
    token: string; // Token mascarado para identificação
}

/**
 * Extrai múltiplas chaves do campo de token (separadas por vírgula, ponto-e-vírgula ou nova linha).
 */
export const parseApifyTokens = (tokenField: string): string[] => {
    return tokenField
        .split(/[,;\n]+/)
        .map(t => t.trim())
        .filter(t => t.length > 0);
};

/**
 * Mascara um token para exibição segura. Ex: "apify_api_abc123xyz" → "apify...xyz"
 */
const maskToken = (token: string): string => {
    if (token.length <= 8) return '***';
    return `${token.substring(0, 5)}...${token.substring(token.length - 3)}`;
};

/**
 * Consulta informações da conta Apify (plano, uso, limites).
 * Endpoint: GET /v2/users/me
 */
export const getApifyAccountInfo = async (apiToken: string): Promise<ApifyAccountInfo> => {
    const masked = maskToken(apiToken);
    try {
        // 1. Perfil e Limites
        const userUrl = `${APIFY_BASE_URL}/users/me?token=${apiToken}`;
        const userRes = await fetch(userUrl);
        if (!userRes.ok) throw new Error('Falha ao obter perfil');
        const userData = (await userRes.json()).data;

        // 2. Uso Mensal (USD)
        const usageUrl = `${APIFY_BASE_URL}/users/me/usage/monthly?token=${apiToken}`;
        const usageRes = await fetch(usageUrl);
        let usageUsd = 0;

        if (usageRes.ok) {
            const usageData = (await usageRes.json()).data;
            usageUsd = usageData.totalUsageCreditsUsd || usageData.totalUsageCreditsUsdAfterVolumeDiscount || 0;
        }

        const plan = userData.plan?.id || userData.subscription?.plan?.id || 'free';
        // Limite mensal do plano (ex: $5 para free)
        const limitUsd = userData.plan?.monthlyUsageCreditsUsd || userData.limits?.monthlyUsageCreditsUsd || 5;

        // Determina se atingiu o limite (margem de segurança de $0.05)
        const isLimitReached = usageUsd >= (limitUsd - 0.05);

        console.log(`[Apify] Conta: @${userData.username} (${masked}) | Plano: ${plan} | Uso: $${usageUsd.toFixed(2)}/$${limitUsd} | Limite: ${isLimitReached ? '❌ ATINGIDO' : '✅ OK'}`);

        return {
            username: userData.username,
            plan,
            usageUsd,
            limitUsd,
            isLimitReached,
            token: masked,
        };
    } catch (error) {
        console.warn(`[Apify] Erro ao consultar conta (${masked}):`, error);
        return { username: 'unknown', plan: 'unknown', usageUsd: 0, limitUsd: 0, isLimitReached: false, token: masked };
    }
};

/**
 * Consulta o status de todas as chaves Apify cadastradas.
 * Útil para exibir no painel de Settings.
 */
export const checkAllApifyTokens = async (tokenField: string): Promise<ApifyAccountInfo[]> => {
    const tokens = parseApifyTokens(tokenField);
    if (tokens.length === 0) return [];
    return Promise.all(tokens.map(t => getApifyAccountInfo(t)));
};

/**
 * Encontra o primeiro token disponível (que não atingiu o limite).
 * Retorna o token e info da conta, ou null se todos estão esgotados.
 */
const findAvailableToken = async (tokens: string[]): Promise<{ token: string, info: ApifyAccountInfo }> => {
    const errors: string[] = [];

    for (let i = 0; i < tokens.length; i++) {
        const token = tokens[i];
        const masked = maskToken(token);
        console.log(`[Apify] 🔑 Verificando chave ${i + 1}/${tokens.length} (${masked})...`);

        const info = await getApifyAccountInfo(token);

        if (!info.isLimitReached) {
            console.log(`[Apify] ✅ Chave ${i + 1} disponível: @${info.username}`);
            return { token, info };
        }

        errors.push(`Chave ${i + 1} (@${info.username}): limite atingido ($${info.usageUsd}/$${info.limitUsd})`);
        console.warn(`[Apify] ⏭️ Chave ${i + 1} esgotada, tentando próxima...`);
    }

    throw new Error(
        `🚫 Todas as ${tokens.length} chaves Apify atingiram o limite!\n` +
        errors.join('\n') + '\n' +
        `O limite reseta à meia-noite UTC (21h Brasília). Adicione mais contas ou aguarde o reset.`
    );
};

/**
 * Tenta executar a transcrição com a primeira chave disponível.
 * Se falhar por quota, tenta a próxima automaticamente.
 * Aceita uma string com múltiplas chaves separadas por vírgula.
 */
export const fetchYoutubeTranscriptFromApify = async (videoId: string, apiTokenField: string): Promise<{ transcript: string, metadata: any }> => {
    const tokens = parseApifyTokens(apiTokenField);

    if (tokens.length === 0) {
        throw new Error('Nenhum token Apify configurado.');
    }

    console.log(`[Apify] 🔄 Rotativo: ${tokens.length} chave(s) disponíveis para vídeo: ${videoId}`);

    const errors: string[] = [];

    // Loop de Failover: Tenta cada chave sequencialmente
    for (let i = 0; i < tokens.length; i++) {
        const token = tokens[i];
        const masked = maskToken(token);

        try {
            // 1. Check Quota
            console.log(`[Apify] 🔍 [Tentativa ${i + 1}/${tokens.length}] Verificando conta da chave ${masked}...`);
            const accountInfo = await getApifyAccountInfo(token);
            const acctLabel = `@${accountInfo.username}`;

            if (accountInfo.isLimitReached) {
                const msg = `⚠️ Pulei ${acctLabel} (Limite Atingido: $${accountInfo.usageUsd}/$${accountInfo.limitUsd})`;
                console.warn(`[Apify] ${msg}`);
                errors.push(msg);
                continue; // Tenta próxima chave
            }

            // 2. Try Execution
            console.log(`[Apify] 🚀 [Tentativa ${i + 1}/${tokens.length}] Executando com ${acctLabel}...`);
            return await executeWithToken(videoId, token, accountInfo);

        } catch (error) {
            const errMsg = (error as Error).message;
            console.error(`[Apify] ❌ Falha na tentativa ${i + 1} (${masked}):`, errMsg);
            errors.push(`Erro na chave ${i + 1} (${masked}): ${errMsg}`);
            // Continua para a próxima chave no loop
        }
    }

    // Se chegou aqui, todas as chaves falharam
    const finalError = `🚫 FALHA GERAL: Todas as ${tokens.length} chaves falharam ou estão sem quota.\n\nDetalhes:\n${errors.join('\n')}`;
    throw new Error(finalError);
};

/**
 * Executa a transcrição com um token específico.
 */
async function executeWithToken(videoId: string, apiToken: string, accountInfo: ApifyAccountInfo): Promise<{ transcript: string, metadata: any }> {
    const masked = maskToken(apiToken);
    const acct = `@${accountInfo.username}`;
    console.log(`[Apify] 🎬 Usando ${acct} (${masked}) para video: ${videoId}`);

    // 1. Start the Actor
    const run = await triggerActor(videoId, apiToken);
    console.log(`[Apify] Run ID: ${run.id} (${acct}). Aguardando processamento...`);

    // 2. Poll for completion
    const finishedRun = await waitForRunCompletion(run.id, apiToken);

    if (finishedRun.status !== 'SUCCEEDED') {
        throw new Error(`Run falhou (${acct}): status ${finishedRun.status}`);
    }

    // 3. Fetch Dataset
    console.log(`[Apify] Job concluído (${acct}). Baixando dataset: ${finishedRun.defaultDatasetId}`);
    const items = await fetchDatasetItems(finishedRun.defaultDatasetId, apiToken);

    if (!items || items.length === 0) {
        throw new Error(`Nenhum item retornado no dataset (${acct}).`);
    }

    const result = items[0];

    // === DETECÇÃO DE ERRO EXPLÍCITO ===
    // Se o Apify retornar error:true, status 'error', ou mensagem de limite, lançamos erro
    // para que o loop de failover (no fetchYoutubeTranscriptFromApify) possa tentar a próxima chave.
    if (result.error === true || result.status === 'error' || (result.message && typeof result.message === 'string' && result.message.includes('limit'))) {
        const errMsg = result.message || `Erro retornado pelo ator (status: ${result.status})`;
        console.warn(`[Apify] ⚠️ Erro retornado pela API na conta ${acct}: ${errMsg}`);
        throw new Error(errMsg);
    }

    const resultKeys = Object.keys(result);

    // === DEBUG: Log detalhado dos valores reais ===
    const debugInfo: Record<string, any> = {};
    for (const key of ['transcript', 'transcript_text', 'text', 'transcript_segments', 'title', 'video_id', 'status', 'message', 'error']) {
        const val = result[key];
        if (val === undefined) debugInfo[key] = '⬜ UNDEFINED';
        else if (val === null) debugInfo[key] = '🔴 NULL';
        else if (typeof val === 'string') debugInfo[key] = val.length > 0 ? `✅ "${val.substring(0, 60)}..." (${val.length}ch)` : '🟡 "" (vazio)';
        else if (Array.isArray(val)) debugInfo[key] = `📦 Array[${val.length}]`;
        else debugInfo[key] = `🔵 ${typeof val}: ${JSON.stringify(val)}`;
    }
    console.log(`[Apify] 📋 Dataset (${acct}) - ${resultKeys.length} campos:`, debugInfo);

    // === PARSE: Tenta extrair transcrição de qualquer formato ===
    let transcript = '';
    let source = '';

    if (typeof result.transcript_text === 'string' && result.transcript_text.length > 0) {
        transcript = result.transcript_text;
        source = 'transcript_text';
    } else if (typeof result.transcript === 'string' && result.transcript.length > 0) {
        transcript = result.transcript;
        source = 'transcript';
    } else if (typeof result.text === 'string' && result.text.length > 0) {
        transcript = result.text;
        source = 'text';
    } else if (Array.isArray(result.transcript_segments) && result.transcript_segments.length > 0) {
        transcript = result.transcript_segments.map((seg: any) => typeof seg === 'string' ? seg : (seg.text || JSON.stringify(seg))).join(' ');
        source = 'transcript_segments';
    } else if (Array.isArray(result.transcript) && result.transcript.length > 0) {
        transcript = result.transcript.map((seg: any) => typeof seg === 'string' ? seg : (seg.text || JSON.stringify(seg))).join(' ');
        source = 'transcript[]';
    }

    transcript = transcript.trim();

    if (transcript) {
        console.log(`[Apify] ✅ Transcrição via ${acct} → campo '${source}' (${transcript.length} chars)`);
        // Normaliza metadata para camelCase (ator pode retornar snake_case)
        const metadata = {
            title: result.title || result.video_title,
            description: result.description,
            viewCount: result.viewCount || result.view_count,
            channelName: result.channelName || result.channel_name,
            duration: result.duration || result.duration_seconds,
            language: result.language || result.selected_language,
            likeCount: result.likeCount || result.like_count,
            commentCount: result.commentCount || result.comment_count,
            publishedAt: result.publishedAt || result.published_at,
            thumbnail: result.thumbnail || result.thumbnailUrl,
            subscriberCount: result.subscriberCount || result.subscriber_count,
            isAutoGenerated: result.is_auto_generated,
            availableLanguages: result.available_languages,
            _apifyAccount: accountInfo.username,
            _source: source,
            _rawKeys: resultKeys,
        };
        return {
            transcript,
            metadata,
        };
    }

    // === SEM TRANSCRIÇÃO: Retorna dados brutos como debug ===
    const rawDataPreview = JSON.stringify(result, null, 2).substring(0, 800);
    console.error(`[Apify] ❌ NENHUM campo de transcrição com conteúdo (${acct}). Dump:`, rawDataPreview);

    return {
        transcript: [
            `⚠️ [APIFY DEBUG - ${acct}] Transcrição vazia`,
            `Vídeo: ${result.title || result.video_id || videoId}`,
            `Status: ${result.status || 'N/A'} | Mensagem: ${result.message || 'N/A'}`,
            `Campos: ${resultKeys.join(', ')}`,
            ``,
            `--- Dados brutos (parcial) ---`,
            rawDataPreview
        ].join('\n'),
        metadata: { ...result, _apifyAccount: accountInfo.username, _debug: true }
    };
}

async function triggerActor(videoId: string, token: string): Promise<ApifyRun> {
    const url = `${APIFY_BASE_URL}/acts/${ACTOR_ID}/runs?token=${token}`;
    const videoUrl = `https://www.youtube.com/watch?v=${videoId}`;

    const response = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            youtube_url: videoUrl,
            language: 'pt',
            include_transcript_text: true
        })
    });

    if (!response.ok) {
        const err = await response.json();
        throw new Error(`Failed to start actor: ${err.error?.message || response.statusText}`);
    }

    const data = await response.json();
    return data.data;
}

async function waitForRunCompletion(runId: string, token: string): Promise<ApifyRun> {
    const url = `${APIFY_BASE_URL}/acts/${ACTOR_ID}/runs/${runId}?token=${token}`;

    const POLLING_INTERVAL = 3000;
    const MAX_ATTEMPTS = 20;
    let attempts = 0;

    while (attempts < MAX_ATTEMPTS) {
        attempts++;
        await new Promise(resolve => setTimeout(resolve, POLLING_INTERVAL));

        const response = await fetch(url);
        if (!response.ok) {
            console.warn(`[Apify] Polling error (Attempt ${attempts}): ${response.statusText}`);
            continue;
        }

        const data = await response.json();
        const run: ApifyRun = data.data;

        if (run.status === 'SUCCEEDED' || run.status === 'FAILED' || run.status === 'ABORTED' || run.status === 'TIMED-OUT') {
            return run;
        }

        console.log(`[Apify] Status: ${run.status} (Tentativa ${attempts}/${MAX_ATTEMPTS})`);
    }

    throw new Error("Apify Job Timeout: O scraper demorou mais de 60s para responder.");
}

async function fetchDatasetItems(datasetId: string, token: string): Promise<any[]> {
    const url = `${APIFY_BASE_URL}/datasets/${datasetId}/items?token=${token}`;
    const response = await fetch(url);
    if (!response.ok) throw new Error("Failed to fetch dataset items");
    return await response.json();
}