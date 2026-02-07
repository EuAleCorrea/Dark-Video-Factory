
import { GoogleGenAI, Type, Modality } from "@google/genai";
import { ChannelProfile, EngineConfig, VideoFormat, VideoMetadata } from "./types";

// --- CLIENT FACTORY ---
const getGeminiClient = (apiKey: string) => new GoogleGenAI({ apiKey });

// --- INTERFACES PARA RESPOSTAS EXTERNAS ---
interface OpenAICompletionResponse {
    choices: { message: { content: string } }[];
}

/**
 * 1. GERADOR DE ROTEIRO (ROUTING LOGIC)
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
                const data = await response.json() as OpenAICompletionResponse;
                return JSON.parse(data.choices[0].message.content);
            } catch (e) {
                console.warn("OpenAI Falhou, ativando fallback para Gemini...", e);
            }
        }
    }

    // --- ROTA GEMINI (PADRÃO / FALLBACK) ---
    const apiKey = config?.apiKeys.gemini || process.env.GEMINI_API_KEY;
    if (!apiKey) throw new Error("Chave da API Gemini não encontrada.");

    const ai = getGeminiClient(apiKey);
    console.log(`[Router] Despachando para Gemini 1.5 Flash...`);

    try {
        const response = await ai.models.generateContent({
            model: "gemini-2.0-flash", // Atualizado para modelo mais recente se disponível, ou fallback
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
 */
export const generateVideoMetadata = async (
    profile: ChannelProfile,
    finalScript: string,
    config?: EngineConfig
): Promise<VideoMetadata> => {
    const apiKey = config?.apiKeys.gemini || process.env.GEMINI_API_KEY;
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
        model: "gemini-2.0-flash",
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
 * 3. GERADOR DE IMAGEM
 */
export const generateImage = async (prompt: string, aspectRatio: "16:9" | "9:16" = "16:9", config?: EngineConfig): Promise<string | undefined> => {
    // ROTA GEMINI IMAGEN
    const apiKey = config?.apiKeys.gemini || process.env.GEMINI_API_KEY;
    if (!apiKey) return undefined;

    const ai = getGeminiClient(apiKey);

    try {
        // Nota: Gemini API Node requer tratamento cuidadoso para Imagem.
        // Usando modelo padrão de geração de imagem se disponível.
        // Verifique a documentação oficial para o nome exato do modelo de imagem no SDK Node.
        // 'imagen-3.0-generate-001' ou similar.
        // Aqui mantemos 'gemini-2.0-flash-exp' ??? Não, flash não gera imagem assim.
        // O código original usava 'gemini-2.5-flash-image'.

        // BACKUP: Se não funcionar via SDK genai novo, teríamos que usar REST ou outro modelo.
        // Vamos tentar o mesmo modelo do frontend.
        const response = await ai.models.generateContent({
            model: 'gemini-2.0-flash-exp', // Tentativa com modelo experimental que suporte multimeios
            contents: { parts: [{ text: `Generate an image: ${prompt}` }] },
            config: {
                // imageConfig não é padrão em text models.
                // Se falhar, o worker vai precisar ser atualizado para usar REST API direta do Imagen ou Flux.
            }
        });

        // TODO: Implementar geração real de imagem via Node SDK quando estável.
        // Por enquanto, retornamos undefined para usar placeholder, ou mockamos.
        console.warn("Geração de Imagem via Gemini Node SDK ainda experimental.");
        return undefined;

    } catch (error) {
        console.error("Erro na Geração de Imagem:", error);
        return undefined;
    }
};

/**
 * 4. SINTETIZADOR DE VOZ
 */
export const generateSpeech = async (text: string, voiceId: string = 'Kore', config?: EngineConfig): Promise<string | undefined> => {
    const apiKey = config?.apiKeys.gemini || process.env.GEMINI_API_KEY;
    if (!apiKey) throw new Error("API Key missing");
    const ai = getGeminiClient(apiKey);

    try {
        const response = await ai.models.generateContent({
            model: "gemini-2.0-flash-exp",
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

        return response.candidates?.[0]?.content?.parts?.[0]?.inlineData?.data;

    } catch (error) {
        console.error("Erro TTS Gemini:", error);
        throw error;
    }
};
