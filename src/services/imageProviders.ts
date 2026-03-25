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
import { withGeminiKeyRotation, maskGeminiKey } from "../lib/geminiKeyManager";

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
    apiKeyField: 'flux' | 'gemini' | 'openai' | 'openrouter' | 'together';
    providerGroup: string;
    badge: string;
    description: string;
}

// =============================================
// REGISTRY — Modelos Disponíveis
// =============================================

export const IMAGE_MODELS: ImageModel[] = [
    // ─── RunWare ───
    {
        id: 'FLUX',
        label: 'FLUX.1 Schnell',
        provider: 'runware',
        apiKeyField: 'flux',
        providerGroup: 'RunWare',
        badge: 'RunWare',
        description: 'Geração ultrarrápida (4 steps) via RunWare API',
    },
    {
        id: 'NANO_BANANA',
        label: 'Nano Banana (Gemini 2.5)',
        provider: 'nanoBananaRunware',
        apiKeyField: 'flux',
        providerGroup: 'RunWare',
        badge: 'RunWare',
        description: 'Google Gemini 2.5 Flash Image via RunWare (google:4@2)',
    },
    {
        id: 'IDEOGRAM',
        label: 'Ideogram',
        provider: 'ideogramRunware',
        apiKeyField: 'flux',
        providerGroup: 'RunWare',
        badge: 'RunWare',
        description: 'Ideogram via RunWare — excelente em tipografia e texto em imagens',
    },
    // ─── Together.ai ───
    {
        id: 'TOGETHER',
        label: 'FLUX.1 Schnell (Together)',
        provider: 'together',
        apiKeyField: 'together',
        providerGroup: 'Together.ai',
        badge: 'Together',
        description: 'FLUX.1 Schnell via Together.ai — rápido e acessível',
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
 * Dimensões suportadas pelo Nano Banana (google:4@2) no RunWare.
 * Mapeia aspect ratio → dimensões no formato 1K.
 */
const NANO_BANANA_DIMENSIONS: Record<string, { w: number; h: number }> = {
    '1:1': { w: 1024, h: 1024 },
    '16:9': { w: 1376, h: 768 },
    '9:16': { w: 768, h: 1376 },
    '3:2': { w: 1264, h: 848 },
    '2:3': { w: 848, h: 1264 },
    '4:3': { w: 1200, h: 896 },
    '3:4': { w: 896, h: 1200 },
    '5:4': { w: 1152, h: 928 },
    '4:5': { w: 928, h: 1152 },
    '21:9': { w: 1584, h: 672 },
};

function snapToNanoBananaDimensions(width: number, height: number): { w: number; h: number } {
    const ratio = width / height;
    if (Math.abs(ratio - 1) < 0.1) return NANO_BANANA_DIMENSIONS['1:1'];
    if (ratio > 1.7) return NANO_BANANA_DIMENSIONS['16:9'];
    if (ratio < 0.6) return NANO_BANANA_DIMENSIONS['9:16'];
    if (ratio > 1.4) return NANO_BANANA_DIMENSIONS['3:2'];
    if (ratio < 0.75) return NANO_BANANA_DIMENSIONS['2:3'];
    if (ratio > 1.2) return NANO_BANANA_DIMENSIONS['4:3'];
    if (ratio < 0.85) return NANO_BANANA_DIMENSIONS['3:4'];
    return NANO_BANANA_DIMENSIONS['1:1'];
}

/**
 * Nano Banana via RunWare — Google Gemini 2.5 Flash Image
 * Usa RunWare como proxy para acessar o modelo google:4@2 (Nano Banana Pro).
 */
class NanoBananaRunwareProvider implements IImageProvider {
    async generate(
        prompt: string,
        width: number,
        height: number,
        count: number,
        apiKey: string,
        onLog?: (msg: string) => void
    ): Promise<ImageGenerationResult> {
        const dim = snapToNanoBananaDimensions(width, height);
        onLog?.('🍌 Conectando ao RunWare (Nano Banana Pro)...');
        onLog?.(`📡 Modelo: google:4@2 | Dimensões: ${dim.w}x${dim.h}`);
        const urls = await generateImageRunware(prompt, dim.w, dim.h, count, apiKey, {
            modelId: 'google:4@2',
        });
        onLog?.(`✅ ${urls.length} imagem(ns) gerada(s) via RunWare (Nano Banana)`);
        return { urls };
    }
}

/**
 * Dimensões suportadas pelo Ideogram (ideogram:4@1) no RunWare.
 */
const IDEOGRAM_DIMENSIONS: Record<string, { w: number; h: number }> = {
    '1:1': { w: 1024, h: 1024 },
    '16:9': { w: 1344, h: 768 },
    '9:16': { w: 768, h: 1344 },
    '3:2': { w: 1248, h: 832 },
    '2:3': { w: 832, h: 1248 },
    '4:3': { w: 1152, h: 864 },
    '3:4': { w: 864, h: 1152 },
    '5:4': { w: 1120, h: 896 },
    '4:5': { w: 896, h: 1120 },
    '2:1': { w: 1408, h: 704 },
    '1:2': { w: 704, h: 1408 },
};

function snapToIdeogramDimensions(width: number, height: number): { w: number; h: number } {
    const ratio = width / height;
    if (Math.abs(ratio - 1) < 0.1) return IDEOGRAM_DIMENSIONS['1:1'];
    if (ratio >= 1.9) return IDEOGRAM_DIMENSIONS['2:1'];
    if (ratio > 1.7) return IDEOGRAM_DIMENSIONS['16:9'];
    if (ratio > 1.4) return IDEOGRAM_DIMENSIONS['3:2'];
    if (ratio > 1.2) return IDEOGRAM_DIMENSIONS['4:3'];
    if (ratio > 1.05) return IDEOGRAM_DIMENSIONS['5:4'];
    if (ratio < 0.53) return IDEOGRAM_DIMENSIONS['1:2'];
    if (ratio < 0.6) return IDEOGRAM_DIMENSIONS['9:16'];
    if (ratio < 0.72) return IDEOGRAM_DIMENSIONS['2:3'];
    if (ratio < 0.85) return IDEOGRAM_DIMENSIONS['3:4'];
    if (ratio < 0.95) return IDEOGRAM_DIMENSIONS['4:5'];
    return IDEOGRAM_DIMENSIONS['1:1'];
}

/**
 * Ideogram via RunWare — ideogram:4@1
 * Usa RunWare como proxy para acessar o Ideogram com providerSettings.
 */
class IdeogramRunwareProvider implements IImageProvider {
    async generate(
        prompt: string,
        width: number,
        height: number,
        count: number,
        apiKey: string,
        onLog?: (msg: string) => void
    ): Promise<ImageGenerationResult> {
        const dim = snapToIdeogramDimensions(width, height);
        onLog?.('🎨 Conectando ao RunWare (Ideogram)...');
        onLog?.(`📡 Modelo: ideogram:4@1 | Dimensões: ${dim.w}x${dim.h}`);
        const urls = await generateImageRunware(prompt, dim.w, dim.h, count, apiKey, {
            modelId: 'ideogram:4@1',
            providerSettings: {
                ideogram: {
                    renderingSpeed: 'DEFAULT',
                    magicPrompt: 'AUTO',
                    styleType: 'AUTO',
                },
            },
        });
        onLog?.(`✅ ${urls.length} imagem(ns) gerada(s) via RunWare (Ideogram)`);
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
                    const modelName = 'gemini-2.5-flash-image';
                    onLog?.(`📡 Modelo: ${modelName}`);
                    onLog?.(`🔑 Chave: ${maskGeminiKey(singleKey)}`);

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

/**
 * Together.ai Provider — FLUX.1 Schnell
 * Usa fetch direto na API REST do Together.ai.
 * Retorna imagens como data:URI (base64).
 */
class TogetherProvider implements IImageProvider {
    async generate(
        prompt: string,
        width: number,
        height: number,
        count: number,
        apiKey: string,
        onLog?: (msg: string) => void
    ): Promise<ImageGenerationResult> {
        const cleanKey = apiKey.trim();
        const maskedKey = cleanKey.length > 8 ? cleanKey.substring(0, 5) + '...' + cleanKey.substring(cleanKey.length - 3) : '***';

        // Together.ai FLUX exige dimensões ≤ 1440 e múltiplos de 32
        const roundTo32 = (v: number) => Math.round(Math.min(v, 1440) / 32) * 32;
        const safeWidth = roundTo32(width);
        const safeHeight = roundTo32(height);

        onLog?.('🚀 Conectando ao Together.ai...');
        onLog?.(`📡 Modelo: black-forest-labs/FLUX.1-schnell`);
        onLog?.(`🔑 Chave: ${maskedKey}`);
        onLog?.(`📐 Dimensões: ${safeWidth}x${safeHeight} (original: ${width}x${height}) | Variações: ${count}`);

        const response = await fetch('https://api.together.xyz/v1/images/generations', {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${cleanKey}`,
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                prompt,
                model: 'black-forest-labs/FLUX.1-schnell',
                width: safeWidth,
                height: safeHeight,
                n: count,
                steps: 4,
                response_format: 'b64_json',
            }),
        });

        if (!response.ok) {
            const errorBody = await response.text();
            const statusCode = response.status;

            onLog?.(`❌ ─── ERRO TOGETHER.AI ───`);
            onLog?.(`   Status: ${statusCode}`);
            onLog?.(`   Resposta: ${errorBody.substring(0, 300)}`);

            if (statusCode === 401) {
                throw new Error('Chave Together.ai inválida (401). Verifique nas Configurações.');
            }
            if (statusCode === 429) {
                throw new Error('Rate limit Together.ai atingido (429). Tente novamente em instantes.');
            }
            if (statusCode === 400) {
                throw new Error(`Requisição inválida (400): ${errorBody.substring(0, 200)}`);
            }
            throw new Error(`Together.ai retornou erro ${statusCode}: ${errorBody.substring(0, 200)}`);
        }

        const data = await response.json();

        if (!data.data || !Array.isArray(data.data)) {
            onLog?.(`⚠️ Resposta inesperada: ${JSON.stringify(data).substring(0, 300)}`);
            throw new Error('Together.ai retornou resposta sem campo data[]');
        }

        const urls = data.data.map((item: any) => {
            if (item.b64_json) {
                return `data:image/png;base64,${item.b64_json}`;
            }
            if (item.url) {
                return item.url;
            }
            throw new Error('Together.ai retornou item sem b64_json nem url');
        });

        onLog?.(`✅ ${urls.length} imagem(ns) gerada(s) via Together.ai`);
        return { urls };
    }
}

// =============================================
// FACTORY
// =============================================

const providers: Record<string, IImageProvider> = {
    runware: new RunwareProvider(),
    nanoBanana: new NanoBananaProvider(),
    nanoBananaRunware: new NanoBananaRunwareProvider(),
    ideogramRunware: new IdeogramRunwareProvider(),
    together: new TogetherProvider(),
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

/**
 * Agrupa modelos por providerGroup para exibição na UI com <optgroup>.
 */
export function getImageModelsByGroup(): Record<string, ImageModel[]> {
    return IMAGE_MODELS.reduce((groups, model) => {
        const group = model.providerGroup;
        if (!groups[group]) groups[group] = [];
        groups[group].push(model);
        return groups;
    }, {} as Record<string, ImageModel[]>);
}
