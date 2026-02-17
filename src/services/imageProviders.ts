/**
 * IMAGE PROVIDERS — Arquitetura Escalável
 * 
 * Strategy Pattern + Registry para geração de imagens com múltiplos providers.
 * Para adicionar um novo modelo:
 *   1. Criar uma classe que implemente IImageProvider
 *   2. Adicionar entrada ao array IMAGE_MODELS
 *   3. Registrar no switch de getImageProvider()
 */

import { GoogleGenAI } from "@google/genai";
import { generateImageRunware } from "./runwareService";
import { withGeminiKeyRotation } from "../lib/geminiKeyManager";

// =============================================
// INTERFACES
// =============================================

export interface ImageGenerationResult {
    urls: string[];
}

export interface IImageProvider {
    generate(
        prompt: string,
        width: number,
        height: number,
        count: number,
        apiKey: string,
        onLog?: (msg: string) => void
    ): Promise<ImageGenerationResult>;
}

export interface ImageModel {
    id: string;
    label: string;
    provider: string;
    apiKeyField: 'flux' | 'gemini' | 'openai' | 'openrouter';
    badge: string;
    description: string;
}

// =============================================
// REGISTRY — Modelos Disponíveis
// =============================================

export const IMAGE_MODELS: ImageModel[] = [
    {
        id: 'FLUX.1',
        label: 'FLUX.1 Schnell',
        provider: 'runware',
        apiKeyField: 'flux',
        badge: 'RunWare',
        description: 'Geração ultrarrápida (4 steps) via RunWare API',
    },
    {
        id: 'Nano Banana',
        label: 'Nano Banana',
        provider: 'nanoBanana',
        apiKeyField: 'gemini',
        badge: 'Gemini',
        description: 'Geração nativa via Google Gemini (gemini-2.5-flash-image)',
    },
];

// =============================================
// PROVIDERS
// =============================================

/**
 * RunWare Provider — FLUX.1 Schnell
 * Delega para o serviço existente runwareService.ts
 */
class RunwareProvider implements IImageProvider {
    async generate(
        prompt: string,
        width: number,
        height: number,
        count: number,
        apiKey: string,
        onLog?: (msg: string) => void
    ): Promise<ImageGenerationResult> {
        onLog?.('🚀 Conectando ao RunWare...');
        const urls = await generateImageRunware(prompt, width, height, count, apiKey);
        onLog?.(`✅ ${urls.length} imagem(ns) recebida(s) do RunWare`);
        return { urls };
    }
}

/**
 * Nano Banana Provider — Google Gemini Image Generation
 * Usa gemini-2.5-flash-image com rotação de chaves Gemini.
 * Retorna imagens como data:URI (base64).
 */
class NanoBananaProvider implements IImageProvider {
    async generate(
        prompt: string,
        width: number,
        height: number,
        count: number,
        apiKey: string,
        onLog?: (msg: string) => void
    ): Promise<ImageGenerationResult> {
        // Determina aspect ratio a partir das dimensões
        let aspectRatio: string = "1:1";
        if (width > height) {
            aspectRatio = "16:9";
        } else if (height > width) {
            aspectRatio = "9:16";
        }

        const urls: string[] = [];

        onLog?.(`🔎 Iniciando geração: ${count} imagem(ns), aspect ratio ${aspectRatio}`);

        // Gemini gera 1 imagem por request, então iteramos para múltiplas
        for (let i = 0; i < count; i++) {
            const url = await withGeminiKeyRotation(apiKey, async (singleKey, keyIndex, totalKeys) => {
                const ai = new GoogleGenAI({ apiKey: singleKey });

                onLog?.(`🔑 Tentando chave ${keyIndex + 1}/${totalKeys}...`);
                console.log(`[NanoBanana] 🎨 Gerando imagem ${i + 1}/${count} — chave ${keyIndex + 1}/${totalKeys} (${aspectRatio})...`);

                try {
                    const modelName = 'gemini-2.0-flash-exp';
                    onLog?.(`📡 Modelo: ${modelName}`);
                    onLog?.(`🔑 Chave: ${singleKey.substring(0, 8)}...${singleKey.substring(singleKey.length - 4)}`);

                    const response = await ai.models.generateContent({
                        model: modelName,
                        contents: prompt,
                        config: {
                            responseModalities: ['TEXT', 'IMAGE'],
                            imageConfig: {
                                aspectRatio: aspectRatio,
                            },
                        },
                    });

                    onLog?.(`📥 Resposta recebida — status OK`);

                    // Extrai a imagem inline da resposta
                    const parts = response.candidates?.[0]?.content?.parts;
                    if (!parts) {
                        onLog?.(`⚠️ Resposta sem parts: ${JSON.stringify(response.candidates?.[0]?.content || 'null').substring(0, 300)}`);
                        throw new Error(`Resposta sem parts do Gemini (iteração ${i + 1})`);
                    }

                    onLog?.(`📦 Parts recebidas: ${parts.length} (tipos: ${parts.map((p: any) => p.inlineData ? 'IMAGE' : p.text ? 'TEXT' : 'UNKNOWN').join(', ')})`);

                    const imagePart = parts.find((p: any) => p.inlineData);
                    if (!imagePart?.inlineData) {
                        const textPart = parts.find((p: any) => p.text);
                        const reason = textPart?.text || 'Sem imagem na resposta';
                        onLog?.(`❌ Gemini retornou texto mas sem imagem: ${reason.substring(0, 200)}`);
                        throw new Error(`Gemini não retornou imagem: ${reason}`);
                    }

                    const dataUri = `data:${imagePart.inlineData.mimeType};base64,${imagePart.inlineData.data}`;
                    onLog?.(`✅ Imagem ${i + 1}/${count} gerada com sucesso (${imagePart.inlineData.mimeType})`);
                    console.log(`[NanoBanana] ✅ Imagem ${i + 1}/${count} gerada com sucesso`);
                    return dataUri;
                } catch (err: any) {
                    // ===== DIAGNÓSTICO DETALHADO =====
                    const raw = err?.message || String(err);
                    const statusCode = err?.status || err?.statusCode || err?.code || 'N/A';
                    const errorType = err?.constructor?.name || typeof err;

                    console.error(`[NanoBanana] ❌ ERRO COMPLETO:`, err);
                    console.error(`[NanoBanana] ❌ Tipo: ${errorType}, Status: ${statusCode}`);
                    console.error(`[NanoBanana] ❌ Message: ${raw}`);

                    onLog?.(`❌ ─── ERRO DETALHADO ───`);
                    onLog?.(`   Tipo: ${errorType}`);
                    onLog?.(`   Status/Code: ${statusCode}`);
                    onLog?.(`   Mensagem: ${raw.substring(0, 300)}`);

                    // Detecta erros específicos
                    if (raw.includes('Failed to fetch') || raw.includes('NetworkError') || raw.includes('ERR_NETWORK')) {
                        onLog?.(`🌐 DIAGNÓSTICO: Erro de REDE — a requisição NÃO saiu do app. Possível bloqueio de CORS/CSP ou sem internet.`);
                        throw new Error(`Erro de rede: a requisição não chegou ao Gemini. Verifique sua conexão.`);
                    }
                    if (raw.includes('429') || raw.includes('RESOURCE_EXHAUSTED') || raw.includes('quota')) {
                        onLog?.(`⚠️ Chave ${keyIndex + 1}/${totalKeys}: quota esgotada, tentando próxima...`);
                        throw new Error(`Quota Gemini esgotada (429). Tentando próxima chave...`);
                    }
                    if (raw.includes('401') || raw.includes('UNAUTHENTICATED')) {
                        onLog?.(`🔒 DIAGNÓSTICO: Chave INVÁLIDA ou expirada!`);
                        throw new Error(`Chave Gemini inválida (401). Verifique nas Configurações.`);
                    }
                    if (raw.includes('403') || raw.includes('PERMISSION_DENIED')) {
                        onLog?.(`🔒 DIAGNÓSTICO: Chave sem PERMISSÃO para este modelo. Verifique se a API está habilitada no Console.`);
                        throw new Error(`Sem permissão (403). Habilite a Generative Language API no Google Cloud Console.`);
                    }
                    if (raw.includes('404') || raw.includes('NOT_FOUND')) {
                        onLog?.(`🔍 DIAGNÓSTICO: Modelo NÃO ENCONTRADO. O nome do modelo pode estar incorreto.`);
                        throw new Error(`Modelo não encontrado (404). Verifique o nome do modelo.`);
                    }
                    if (raw.includes('400') || raw.includes('INVALID_ARGUMENT')) {
                        onLog?.(`❌ Prompt inválido ou bloqueado pelo Gemini`);
                        throw new Error(`Prompt inválido ou bloqueado pelo Gemini: ${raw.substring(0, 200)}`);
                    }

                    onLog?.(`❓ Erro não categorizado: ${raw.substring(0, 200)}`);
                    throw err;
                }
            });

            urls.push(url);
        }

        return { urls };
    }
}

// =============================================
// FACTORY
// =============================================

const providers: Record<string, IImageProvider> = {
    runware: new RunwareProvider(),
    nanoBanana: new NanoBananaProvider(),
};

/**
 * Retorna o provider correto para o modelId especificado.
 * @throws Error se o modelo não for encontrado no registry
 */
export function getImageProvider(modelId: string): IImageProvider {
    const model = IMAGE_MODELS.find(m => m.id === modelId);
    if (!model) {
        throw new Error(`Modelo de imagem "${modelId}" não encontrado no registry.`);
    }

    const provider = providers[model.provider];
    if (!provider) {
        throw new Error(`Provider "${model.provider}" não implementado para o modelo "${modelId}".`);
    }

    return provider;
}

/**
 * Retorna o modelo do registry pelo ID.
 */
export function getImageModel(modelId: string): ImageModel | undefined {
    return IMAGE_MODELS.find(m => m.id === modelId);
}
