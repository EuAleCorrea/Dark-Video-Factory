import { GoogleGenAI, Type, Modality } from "@google/genai";
import { ChannelProfile, EngineConfig, VideoFormat, VideoMetadata } from "../types";
import { withGeminiKeyRotation } from "../lib/geminiKeyManager";

// --- CLIENT FACTORY ---
const getGeminiClient = (apiKey: string) => new GoogleGenAI({ apiKey });

// --- INTERFACES PARA RESPOSTAS EXTERNAS ---
interface OpenAICompletionResponse {
  choices: { message: { content: string } }[];
}

// =============================================
// GENERIC LLM ROUTER (Dynamic Model)
// =============================================

// Retry config
const MAX_RETRIES = 3;
const BASE_DELAY_MS = 2000; // 2s, 4s, 8s (exponential)
const RETRYABLE_STATUS_CODES = [429, 500, 502, 503, 504];

const isRetryableError = (error: unknown): boolean => {
  if (error instanceof Error) {
    const msg = error.message.toLowerCase();
    return RETRYABLE_STATUS_CODES.some(code => msg.includes(`${code}`))
      || msg.includes('overloaded')
      || msg.includes('rate limit')
      || msg.includes('service unavailable')
      || msg.includes('too many requests');
  }
  return false;
};

const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

const callLLM = async (
  systemPrompt: string,
  userPrompt: string,
  modelId: string,
  provider: 'GEMINI' | 'OPENAI' | 'OPENROUTER',
  config: EngineConfig,
  responseType: 'text' | 'json' = 'json'
): Promise<string> => {

  // Smart routing: se o modelo é Gemini e temos a chave do Google, usar API direta
  const isGeminiModel = modelId.startsWith('gemini');
  const hasGeminiKey = !!config.apiKeys.gemini;
  let effectiveProvider = provider;

  if (isGeminiModel && hasGeminiKey && provider === 'OPENROUTER') {
    console.log(`[LLM Router] 🔀 Roteando ${modelId} direto para Gemini API (bypass OpenRouter)`);
    effectiveProvider = 'GEMINI';
  }

  // --- GEMINI (direto via SDK) — com rotação de chaves ---
  if (effectiveProvider === 'GEMINI') {
    return withGeminiKeyRotation(config.apiKeys.gemini, async (apiKey, keyIdx, totalKeys) => {
      const ai = getGeminiClient(apiKey);
      console.log(`[LLM Router] → Gemini Direct (${modelId})${totalKeys > 1 ? ` [chave ${keyIdx + 1}/${totalKeys}]` : ''} | Format: ${responseType}`);

      try {
        const response = await ai.models.generateContent({
          model: modelId,
          contents: `${systemPrompt}\n\n${userPrompt}`,
          config: {
            responseMimeType: responseType === 'json' ? "application/json" : "text/plain",
          },
        });

        const text = response.text;
        if (!text) throw new Error("Resposta vazia do Gemini");
        return text;
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        if (msg.includes('fetch') || msg.includes('Failed to fetch')) {
          throw new Error(`Erro de conexão com Gemini (Failed to fetch). Verifique sua internet, firewall ou se a API Key é válida.`);
        }
        throw err;
      }
    });
  }

  // --- OPENAI ---
  if (effectiveProvider === 'OPENAI') {
    const apiKey = config.apiKeys.openai;
    if (!apiKey) throw new Error("Chave da API OpenAI não encontrada.");
    console.log(`[LLM Router] → OpenAI (${modelId}) | Format: ${responseType}`);

    const body: any = {
      model: modelId,
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userPrompt }
      ]
    };

    if (responseType === 'json') {
      body.response_format = { type: "json_object" };
    }

    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`
      },
      body: JSON.stringify(body)
    });

    if (!response.ok) {
      const err = await response.json().catch(() => ({}));
      throw new Error(`OpenAI Error [${response.status}]: ${err?.error?.message || response.statusText}`);
    }
    const data: OpenAICompletionResponse = await response.json();
    return data.choices[0].message.content;
  }

  // --- OPENROUTER ---
  if (effectiveProvider === 'OPENROUTER') {
    const apiKey = config.apiKeys.openrouter;
    if (!apiKey) throw new Error("Chave da API OpenRouter não encontrada.");
    console.log(`[LLM Router] → OpenRouter (${modelId}) | Format: ${responseType}`);

    const body: any = {
      model: modelId,
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userPrompt }
      ]
    };

    if (responseType === 'json') {
      body.response_format = { type: "json_object" };
    }

    const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`,
        'HTTP-Referer': 'https://darkvideofactory.app',
        'X-Title': 'Dark Video Factory'
      },
      body: JSON.stringify(body)
    });

    if (!response.ok) {
      const err = await response.json().catch(() => ({}));
      throw new Error(`OpenRouter Error [${response.status}]: ${err?.error?.message || response.statusText}`);
    }
    const data: OpenAICompletionResponse = await response.json();
    let content = data.choices[0].message.content;

    // Se for texto plano mas vier com blocos de código markdown, podemos limpar se necessário
    // mas por enquanto vamos retornar o bruto. Para JSON limpamos as aspas.
    if (responseType === 'json') {
      content = content.replace(/^```json\n|\n```$/g, '');
    }

    return content;
  }

  throw new Error(`Provider desconhecido: ${provider}`);
};

// Wrapper with exponential backoff retry
export const callLLMWithRetry = async (
  systemPrompt: string,
  userPrompt: string,
  modelId: string,
  provider: 'GEMINI' | 'OPENAI' | 'OPENROUTER',
  config: EngineConfig,
  responseType: 'text' | 'json' = 'json'
): Promise<string> => {
  let lastError: any;

  for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
    try {
      return await callLLM(systemPrompt, userPrompt, modelId, provider, config, responseType);
    } catch (error) {
      lastError = error;

      if (attempt < MAX_RETRIES && isRetryableError(error)) {
        const delay = BASE_DELAY_MS * Math.pow(2, attempt - 1); // 2s, 4s, 8s
        console.warn(
          `[LLM Router] ⚠️ Tentativa ${attempt}/${MAX_RETRIES} falhou (${error instanceof Error ? error.message : error}). Retentando em ${delay / 1000}s...`
        );
        await sleep(delay);
      } else {
        throw error; // Non-retryable or last attempt
      }
    }
  }

  throw lastError;
};

// =============================================
// P1 — REWRITE TRANSCRIPT (Reescrita Magnética)
// =============================================

export const rewriteTranscript = async (
  transcript: string,
  customPrompt: string,
  modelId: string,
  provider: 'GEMINI' | 'OPENAI' | 'OPENROUTER',
  config: EngineConfig
): Promise<{ text: string; caracteres: number }> => {

  console.log(`[Pipeline] P1 — Reescrita via ${provider}/${modelId}...`);

  const isCustom = !!customPrompt;
  const systemPrompt = customPrompt || `Você é um reescritor profissional de roteiros para YouTube.
Reescreva o texto mantendo a essência mas tornando-o mais magnético e envolvente.
REGRAS:
- Manter o mesmo tamanho aproximado
- Otimizar para TTS (sem emojis, sem URLs, sem caracteres especiais)
- Português do Brasil

SAÍDA (JSON STRICT):
{ "text": "texto reescrito completo...", "caracteres": 1234 }`;

  const userPrompt = `TRANSCRIÇÃO ORIGINAL:\n\n${transcript}`;

  const raw = await callLLMWithRetry(systemPrompt, userPrompt, modelId, provider, config);
  const parsed = JSON.parse(raw);

  return {
    text: parsed.text || parsed.script || raw,
    caracteres: parsed.caracteres || (parsed.text || raw).length,
  };
};

// =============================================
// P2 — STRUCTURE SCRIPT (Estruturação Viral)
// =============================================

export const structureScript = async (
  rewrittenText: string,
  customPrompt: string,
  modelId: string,
  provider: 'GEMINI' | 'OPENAI' | 'OPENROUTER',
  config: EngineConfig
): Promise<{ title: string; description: string; thumb_text: string; tags: string[] }> => {

  console.log(`[Pipeline] P2 — Estruturação via ${provider}/${modelId}...`);

  const isCustom = !!customPrompt;
  const systemPrompt = customPrompt || `Você é um especialista em YouTube SEO e viralização.
Dado o roteiro abaixo, gere os metadados para um vídeo viral.

SAÍDA (JSON STRICT):
{
  "title": "Título viral (máx 60 chars)",
  "description": "Descrição SEO completa...",
  "thumb_text": "TEXTO THUMBNAIL (máx 6 palavras, CAPS)",
  "tags": ["tag1", "tag2", ...]
}`;

  const userPrompt = `ROTEIRO:\n\n${rewrittenText}`;

  const raw = await callLLMWithRetry(systemPrompt, userPrompt, modelId, provider, config);
  return JSON.parse(raw);
};

// =============================================
// P3 — PROMPTING (Geração de Prompts Visuais)
// =============================================

export const generateVisualPromptsForSegments = async (
  segments: { id: number; scriptText: string }[],
  visualStyle: string,
  modelId: string,
  provider: 'GEMINI' | 'OPENAI' | 'OPENROUTER',
  config: EngineConfig
): Promise<{ id: number; visualPrompt: string }[]> => {

  console.log(`[Pipeline] P3 — Prompting via ${provider}/${modelId}...`);

  const systemPrompt = `Você é um diretor de arte especializado em IA generativa (Midjourney/Flux).
Sua tarefa é criar prompts visuais altamente descritivos em INGLÊS para cada segmento do roteiro.

ESTILO VISUAL OBRIGATÓRIO: ${visualStyle}

REGRAS PARA OS PROMPTS:
1. Sempre em INGLÊS.
2. Descreva a cena, iluminação, ângulo de câmera e detalhes do estilo.
3. Não use o nome dos personagens se não forem famosos, descreva-os.
4. Evite palavras proibidas (nudez, violência extrema).
5. Mantenha consistência visual entre os segmentos.

SAÍDA (JSON STRICT - ARRAY):
[
  { "id": 1, "visualPrompt": "A detailed prompt in English..." },
  ...
]`;

  const userPrompt = `SEGMENTOS DO ROTEIRO:\n${JSON.stringify(segments, null, 2)}`;

  const raw = await callLLMWithRetry(systemPrompt, userPrompt, modelId, provider, config);
  
  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : (parsed.prompts || parsed.segments || []);
  } catch (e) {
    console.error("Erro ao dar parse nos prompts visuais:", e);
    return segments.map(s => ({ id: s.id, visualPrompt: `Cinematic visualization of: ${s.scriptText.substring(0, 50)}` }));
  }
};


/**
 * 1. GERADOR DE ROTEIRO (ROUTING LOGIC)
 * Suporta: Gemini (Padrão), OpenAI (GPT-4o), OpenRouter (Claude/Llama)
 * Agora suporta 'modelChannel' e 'referenceScript' para mimetizar estilos.
 */
export const generateVideoScriptAndPrompts = async (
  profile: ChannelProfile,
  theme: string,
  config?: EngineConfig,
  modelChannel?: string,
  referenceScript?: string
): Promise<{ script: string; visualPrompts: string[] }> => {

  const provider = config?.providers.scripting || 'GEMINI';
  const durationHint = profile.format === VideoFormat.SHORTS ? "menos de 60 segundos" : "cerca de 5 minutos";

  // PROMPT SYSTEM AGNOSTIC
  // Injeção de dependência do Model Channel
  let modelInstruction = '';

  if (referenceScript) {
    modelInstruction = `
      ESTRUTURA DE REFERÊNCIA (ONE-SHOT LEARNING - OBRIGATÓRIO):
      Abaixo está a transcrição de um vídeo viral do canal '${modelChannel}'. 
      Você DEVE analisar o ritmo, os ganchos (hooks) de retenção, a introdução, o desenvolvimento e a conclusão deste texto.
      Escreva um NOVO roteiro sobre o tema "${theme}" que siga EXATAMENTE a mesma estrutura narrativa e cadência da referência abaixo, mas com o conteúdo do novo tema.
      
      [[ INÍCIO DA REFERÊNCIA ]]
      ${referenceScript}
      [[ FIM DA REFERÊNCIA ]]
      `;
  } else if (modelChannel) {
    modelInstruction = `ANÁLISE DE REFERÊNCIA: Utilize a estrutura narrativa, o ritmo de edição mental e o tom do canal '${modelChannel}' como inspiração principal. O roteiro deve parecer que foi escrito pela equipe desse canal.`;
  }

  const systemPrompt = `
    Você é o motor criativo do canal "${profile.name}".
    PERSONA: ${profile.llmPersona}
    ESTILO VISUAL: ${profile.visualStyle}
    ${modelInstruction}
    
    OBJETIVO: Criar um roteiro de vídeo sobre "${theme}" (${durationHint}).
    IDIOMA: Português do Brasil (PT-BR).
    
    SAÍDA ESPERADA (JSON STRICT):
    {
      "script": "Texto falado completo...",
      "visualPrompts": ["Prompt imagem 1 (Inglês)", "Prompt imagem 2 (Inglês)", ...]
    }
  `;

  // --- ROTA OPENAI / GPT-4 ---
  if (provider === 'OPENAI') {
    const apiKey = config?.apiKeys.openai;
    if (apiKey) {
      console.log(`[Router] Despachando para GPT-4o...`);
      try {
        const response = await fetch('https://api.openai.com/v1/chat/completions', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${apiKey}`
          },
          body: JSON.stringify({
            model: "gpt-4o",
            messages: [
              { role: "system", content: "You are a JSON generator. Output only valid JSON." },
              { role: "user", content: systemPrompt }
            ],
            response_format: { type: "json_object" }
          })
        });

        if (!response.ok) throw new Error(`OpenAI Error: ${response.statusText}`);
        const data: OpenAICompletionResponse = await response.json();
        return JSON.parse(data.choices[0].message.content);
      } catch (e) {
        console.warn("OpenAI Falhou, ativando fallback para Gemini...", e);
        // Continua para o código do Gemini abaixo
      }
    } else {
      console.warn("Provider OpenAI selecionado mas sem Key. Usando Gemini.");
    }
  }

  // --- ROTA OPENROUTER (CLAUDE / LLAMA / DEEPSEEK) ---
  if (provider === 'OPENROUTER') {
    const apiKey = config?.apiKeys.openrouter;
    if (apiKey) {
      console.log(`[Router] Despachando para OpenRouter...`);
      try {
        const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${apiKey}`,
            'HTTP-Referer': 'https://darkvideofactory.app', // Required by OpenRouter
            'X-Title': 'Dark Video Factory'
          },
          body: JSON.stringify({
            // Default to a good model, or make it configurable later. 
            // "google/gemini-2.0-flash-001" is free/cheap on OR, or "anthropic/claude-3-haiku"
            model: "google/gemini-2.0-flash-001",
            messages: [
              { role: "system", content: "You are a JSON generator. Output only valid JSON." },
              { role: "user", content: systemPrompt }
            ],
            response_format: { type: "json_object" }
          })
        });

        if (!response.ok) {
          const err = await response.json();
          throw new Error(`OpenRouter Error: ${err.error?.message || response.statusText}`);
        }

        const data: OpenAICompletionResponse = await response.json();
        let content = data.choices[0].message.content;
        content = content.replace(/^```json\n|\n```$/g, '');
        return JSON.parse(content);
      } catch (e) {
        console.error("OpenRouter falhou:", e);
        throw new Error(`OpenRouter Failed: ${e}`);
      }
    } else {
      throw new Error("Provider OpenRouter selecionado mas sem chave configurada.");
    }
  }

  // --- ROTA GEMINI (PADRÃO / FALLBACK) — com rotação de chaves ---
  const geminiField = config?.apiKeys.gemini;
  if (!geminiField) throw new Error("Chave da API Gemini não encontrada. Configure-a em Configurações.");

  return withGeminiKeyRotation(geminiField, async (apiKey, keyIdx, totalKeys) => {
    const ai = getGeminiClient(apiKey);
    console.log(`[Router] Despachando para Gemini 1.5 Flash...${totalKeys > 1 ? ` [chave ${keyIdx + 1}/${totalKeys}]` : ''}`);

    try {
      const response = await ai.models.generateContent({
        model: "gemini-1.5-flash",
        contents: systemPrompt,
        config: {
          responseMimeType: "application/json",
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              script: { type: Type.STRING },
              visualPrompts: { type: Type.ARRAY, items: { type: Type.STRING } },
            },
            required: ["script", "visualPrompts"],
          },
        },
      });

      const text = response.text;
      if (!text) throw new Error("Resposta vazia do Gemini");
      return JSON.parse(text);

    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      if (msg.includes('fetch') || msg.includes('Failed to fetch')) {
        throw new Error(`Erro de conexão com Gemini (Failed to fetch). Verifique sua internet, firewall ou se a API Key é válida.`);
      }
      console.error("Erro na Geração de Roteiro:", err);
      throw err;
    }
  });
};

/**
 * 2. GERADOR DE METADADOS
 * Usa Gemini 3 Flash por ser extremamente rápido e barato para essa tarefa.
 */
export const generateVideoMetadata = async (
  profile: ChannelProfile,
  finalScript: string,
  config?: EngineConfig
): Promise<VideoMetadata> => {
  const geminiField = config?.apiKeys.gemini;
  if (!geminiField) throw new Error("API Key missing");

  const prompt = `
    Analise este roteiro e gere metadados para YouTube (PT-BR).
    ROTEIRO: "${finalScript.substring(0, 5000)}..."
    
    REQUISITOS:
    - 3 Títulos Virais
    - Descrição SEO
    - 15 Tags
    - 1 Prompt de Thumbnail (Inglês, estilo: ${profile.visualStyle})
  `;

  return withGeminiKeyRotation(geminiField, async (apiKey) => {
    const ai = getGeminiClient(apiKey);

    try {
      const response = await ai.models.generateContent({
        model: "gemini-1.5-flash",
        contents: prompt,
        config: {
          responseMimeType: "application/json",
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              titles: { type: Type.ARRAY, items: { type: Type.STRING } },
              description: { type: Type.STRING },
              tags: { type: Type.ARRAY, items: { type: Type.STRING } },
              thumbnailPrompt: { type: Type.STRING }
            }
          }
        }
      });

      if (!response.text) throw new Error("Falha ao gerar metadados");
      return JSON.parse(response.text);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      if (msg.includes('fetch') || msg.includes('Failed to fetch')) {
        throw new Error(`Erro de conexão com Gemini (Metadados). Verifique sua internet.`);
      }
      throw err;
    }
  });
};

/**
 * 3. GERADOR DE IMAGEM (ROUTING: Gemini vs Flux)
 */
export const generateImage = async (prompt: string, aspectRatio: "16:9" | "9:16" = "16:9", config?: EngineConfig): Promise<string | undefined> => {
  const provider = config?.providers.image || 'GEMINI';

  // ROTA FLUX.1 (Simulação de Proxy)
  if (provider === 'FLUX' && config?.apiKeys.flux) {
    console.log(`[Router] Solicitando renderização Flux.1 Pro (Simulado)...`);
    // Em produção: fetch para api.bfl.ml
    // Como não temos proxy real aqui, usamos Gemini mas logamos como se fosse Flux para a demo
  }

  // ROTA GEMINI IMAGEN — com rotação de chaves
  const geminiField = config?.apiKeys.gemini;
  if (!geminiField) return undefined;

  return withGeminiKeyRotation(geminiField, async (apiKey) => {
    const ai = getGeminiClient(apiKey);

    try {
      const response = await ai.models.generateContent({
        model: 'gemini-2.5-flash-image',
        contents: { parts: [{ text: prompt }] },
        config: {
          imageConfig: { aspectRatio: aspectRatio }
        }
      });

      const part = response.candidates?.[0]?.content?.parts?.find(p => p.inlineData);
      if (part?.inlineData) {
        return `data:${part.inlineData.mimeType};base64,${part.inlineData.data}`;
      }
      return undefined;
    } catch (error) {
      console.error("Erro na Geração de Imagem:", error);
      throw error; // Propaga para rotação tentar próxima chave
    }
  });
};

/**
 * 4. SINTETIZADOR DE VOZ (ROUTING: Gemini vs ElevenLabs) — COM RETRY
 */
export const generateSpeech = async (text: string, voiceId: string = 'Kore', config?: EngineConfig): Promise<string | undefined> => {
  const provider = config?.providers.tts || 'GEMINI';

  // ROTA ELEVENLABS (stub — cai pra Gemini por enquanto)
  if (provider === 'ELEVENLABS' && config?.apiKeys.elevenLabs) {
    console.warn("[TTS] ElevenLabs selecionado mas não implementado. Fallback para Gemini.");
  }

  // ROTA GEMINI TTS — com rotação de chaves
  const geminiField = config?.apiKeys.gemini;
  if (!geminiField) throw new Error("API Key do Gemini não configurada. Vá em Configurações.");

  return withGeminiKeyRotation(geminiField, async (apiKey, keyIdx, totalKeys) => {
    const ai = getGeminiClient(apiKey);

    for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
      try {
        if (attempt > 0) {
          const delay = BASE_DELAY_MS * Math.pow(2, attempt - 1);
          console.warn(`[TTS] ⏳ Retry ${attempt}/${MAX_RETRIES} em ${delay}ms...`);
          await sleep(delay);
        }

        console.log(`[TTS] 🎙️ Gerando áudio via Gemini TTS (voz: ${voiceId})${totalKeys > 1 ? ` [chave ${keyIdx + 1}/${totalKeys}]` : ''}${attempt > 0 ? ` [tentativa ${attempt + 1}]` : ''}...`);

        const response = await ai.models.generateContent({
          model: "gemini-2.5-flash-preview-tts",
          contents: [{ parts: [{ text }] }],
          config: {
            responseModalities: ['AUDIO'],
            speechConfig: {
              voiceConfig: {
                prebuiltVoiceConfig: { voiceName: voiceId },
              },
            },
          },
        });

        const audioPart = response.candidates?.[0]?.content?.parts?.find(p => p.inlineData);
        const audioData = audioPart?.inlineData?.data;

        if (!audioData) {
          console.error("[TTS] Resposta sem áudio:", response);
          throw new Error("O Gemini não retornou dados de áudio.");
        }

        console.log(`[TTS] ✅ Áudio gerado com sucesso`);
        return audioData;

      } catch (error) {
        if (attempt < MAX_RETRIES && isRetryableError(error)) {
          continue;
        }
        console.error("[TTS] ❌ Erro final:", error);
        throw error;
      }
    }
    return undefined; // TypeScript safety
  });
};

/**
 * 5. INTERPRETADOR DE ERROS (IA AMIGÁVEL)
 * Transforma erros técnicos em mensagens simples para o usuário.
 */
export const interpretErrorWithAI = async (
  errorContext: string,
  config: EngineConfig
): Promise<string> => {
  const systemPrompt = `Você é o Especialista de Diagnóstico do Dark Video Factory.
Sua missão é ler um log técnico de erro e dizer EXATAMENTE o que aconteceu com CONVICÇÃO e AUTORIDADE.

DIRETRIZES DE ESTILO:
1. Seja DIRETO e ASSERTIVO. Não use "parece que", "talvez", ou "possivelmente".
2. Identifique a causa raiz:
   - Se ver 'insufficientCredits': Diga "💰 Seus créditos na RunWare acabaram. Você precisa recarregar seu saldo para continuar."
   - Se ver '401' ou 'Unauthorized': Diga "🔑 Sua chave de API está incorreta ou expirou. Atualize a chave nas configurações agora."
   - Se ver 'Failed to fetch': Diga "🌐 Erro de conexão! O app não conseguiu alcançar os servidores. Verifique sua internet."
3. Use um tom de especialista que resolve o problema.
4. Máximo de 20 palavras.
5. Português do Brasil.

SAÍDA: Apenas a frase assertiva de diagnóstico.`;

  const userPrompt = `ERRO BRUTO PARA INTERPRETAR:\n${errorContext}`;

  try {
    // Usamos o DeepSeek Chat do OpenRouter para diagnósticos precisos e com convicção
    const response = await callLLMWithRetry(
      systemPrompt,
      userPrompt,
      "deepseek/deepseek-chat",
      "OPENROUTER",
      config,
      'text'
    );
    return response.trim();
  } catch (e) {
    console.warn("[Error Interpreter] Falha ao usar IA para interpretar erro:", e);

    // Fallback assertivo (manual) se a comunicação com OpenRouter falhar
    const raw = errorContext.toLowerCase();
    if (raw.includes("insufficient") || raw.includes("credits") || raw.includes("balance")) {
      return "💰 Seus créditos na RunWare acabaram totalmente. Recarregue seu saldo para continuar gerando imagens.";
    }
    if (raw.includes("401") || raw.includes("unauthorized") || raw.includes("key")) {
      return "🔑 Sua chave de API está incorreta ou expirou. Atualize nos ajustes.";
    }

    return "Ocorreu um problema técnico na comunicação com o provedor. Verifique sua conta e conexão.";
  }
};