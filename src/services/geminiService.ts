import { GoogleGenAI, Type, Modality } from "@google/genai";
import { ChannelProfile, EngineConfig, VideoFormat, VideoMetadata } from "../types";

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
  config: EngineConfig
): Promise<string> => {

  // Smart routing: se o modelo é Gemini e temos a chave do Google, usar API direta
  const isGeminiModel = modelId.startsWith('gemini');
  const hasGeminiKey = !!config.apiKeys.gemini;
  let effectiveProvider = provider;

  if (isGeminiModel && hasGeminiKey && provider === 'OPENROUTER') {
    console.log(`[LLM Router] 🔀 Roteando ${modelId} direto para Gemini API (bypass OpenRouter)`);
    effectiveProvider = 'GEMINI';
  }

  // --- GEMINI (direto via SDK) ---
  if (effectiveProvider === 'GEMINI') {
    const apiKey = config.apiKeys.gemini;
    if (!apiKey) throw new Error("Chave da API Gemini não encontrada.");
    const ai = getGeminiClient(apiKey);
    console.log(`[LLM Router] → Gemini Direct (${modelId})`);

    const response = await ai.models.generateContent({
      model: modelId,
      contents: `${systemPrompt}\n\n${userPrompt}`,
      config: {
        responseMimeType: "application/json",
      },
    });

    const text = response.text;
    if (!text) throw new Error("Resposta vazia do Gemini");
    return text;
  }

  // --- OPENAI ---
  if (effectiveProvider === 'OPENAI') {
    const apiKey = config.apiKeys.openai;
    if (!apiKey) throw new Error("Chave da API OpenAI não encontrada.");
    console.log(`[LLM Router] → OpenAI (${modelId})`);

    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`
      },
      body: JSON.stringify({
        model: modelId,
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userPrompt }
        ],
        response_format: { type: "json_object" }
      })
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
    console.log(`[LLM Router] → OpenRouter (${modelId})`);

    const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`,
        'HTTP-Referer': 'https://darkvideofactory.app',
        'X-Title': 'Dark Video Factory'
      },
      body: JSON.stringify({
        model: modelId,
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userPrompt }
        ],
        response_format: { type: "json_object" }
      })
    });

    if (!response.ok) {
      const err = await response.json().catch(() => ({}));
      throw new Error(`OpenRouter Error [${response.status}]: ${err?.error?.message || response.statusText}`);
    }
    const data: OpenAICompletionResponse = await response.json();
    let content = data.choices[0].message.content;
    content = content.replace(/^```json\n|\n```$/g, '');
    return content;
  }

  throw new Error(`Provider desconhecido: ${provider}`);
};

// Wrapper with exponential backoff retry
const callLLMWithRetry = async (
  systemPrompt: string,
  userPrompt: string,
  modelId: string,
  provider: 'GEMINI' | 'OPENAI' | 'OPENROUTER',
  config: EngineConfig
): Promise<string> => {
  let lastError: unknown;

  for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
    try {
      return await callLLM(systemPrompt, userPrompt, modelId, provider, config);
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

  // --- ROTA GEMINI (PADRÃO / FALLBACK) ---
  const apiKey = config?.apiKeys.gemini;
  if (!apiKey) throw new Error("Chave da API Gemini não encontrada. Configure-a em Configurações.");

  const ai = getGeminiClient(apiKey);
  console.log(`[Router] Despachando para Gemini 1.5 Flash...`);

  try {
    const response = await ai.models.generateContent({
      model: "gemini-3-flash-preview",
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

  } catch (error) {
    console.error("Erro na Geração de Roteiro:", error);
    throw error;
  }
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
  const apiKey = config?.apiKeys.gemini;
  if (!apiKey) throw new Error("API Key missing");
  const ai = getGeminiClient(apiKey);

  const prompt = `
    Analise este roteiro e gere metadados para YouTube (PT-BR).
    ROTEIRO: "${finalScript.substring(0, 5000)}..."
    
    REQUISITOS:
    - 3 Títulos Virais
    - Descrição SEO
    - 15 Tags
    - 1 Prompt de Thumbnail (Inglês, estilo: ${profile.visualStyle})
  `;

  const response = await ai.models.generateContent({
    model: "gemini-3-flash-preview",
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

  // ROTA GEMINI IMAGEN
  const apiKey = config?.apiKeys.gemini;
  if (!apiKey) return undefined;

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
    return undefined;
  }
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

  // ROTA GEMINI TTS
  const apiKey = config?.apiKeys.gemini;
  if (!apiKey) throw new Error("API Key do Gemini não configurada. Vá em Configurações.");
  const ai = getGeminiClient(apiKey);

  for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
    try {
      if (attempt > 0) {
        const delay = BASE_DELAY_MS * Math.pow(2, attempt - 1);
        console.warn(`[TTS] ⏳ Retry ${attempt}/${MAX_RETRIES} em ${delay}ms...`);
        await sleep(delay);
      }

      console.log(`[TTS] 🎙️ Gerando áudio via Gemini TTS (voz: ${voiceId})${attempt > 0 ? ` [tentativa ${attempt + 1}]` : ''}...`);

      const response = await ai.models.generateContent({
        model: "gemini-2.5-flash-preview-tts",
        contents: { parts: [{ text }] },
        config: {
          responseModalities: [Modality.AUDIO],
          speechConfig: {
            voiceConfig: {
              prebuiltVoiceConfig: { voiceName: voiceId },
            },
          },
        },
      });

      const audioData = response.candidates?.[0]?.content?.parts?.[0]?.inlineData?.data;
      if (!audioData) throw new Error("Gemini TTS retornou resposta vazia.");

      console.log(`[TTS] ✅ Áudio gerado com sucesso (${(audioData.length / 1024).toFixed(0)} KB base64)`);
      return audioData;

    } catch (error) {
      if (attempt < MAX_RETRIES && isRetryableError(error)) {
        continue;
      }
      console.error("[TTS] ❌ Erro final:", error);
      throw error;
    }
  }
};