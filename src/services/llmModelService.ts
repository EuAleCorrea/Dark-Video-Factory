import { EngineConfig } from '../types';

export interface LLMModelOption {
    id: string;
    name: string;
    provider: 'GEMINI' | 'OPENAI' | 'OPENROUTER';
    isFree: boolean;
    contextLength?: number;
}

// Static models for Gemini and OpenAI
const STATIC_MODELS: LLMModelOption[] = [
    // Gemini
    { id: 'gemini-3-flash-preview', name: 'Gemini 1.5 Flash (Preview)', provider: 'GEMINI', isFree: true, contextLength: 1000000 },
    { id: 'gemini-2.5-flash-preview-05-20', name: 'Gemini 1.5 Flash (0520)', provider: 'GEMINI', isFree: true, contextLength: 1000000 },
    { id: 'gemini-2.5-pro-preview-06-05', name: 'Gemini 1.5 Pro (0605)', provider: 'GEMINI', isFree: false, contextLength: 1000000 },

    // OpenAI
    { id: 'gpt-4o', name: 'GPT-4o (Omni)', provider: 'OPENAI', isFree: false, contextLength: 128000 },
    { id: 'gpt-4o-mini', name: 'GPT-4o Mini', provider: 'OPENAI', isFree: false, contextLength: 128000 },
    { id: 'gpt-4-turbo', name: 'GPT-4 Turbo', provider: 'OPENAI', isFree: false, contextLength: 128000 },
    { id: 'gpt-4', name: 'GPT-4 Standard', provider: 'OPENAI', isFree: false, contextLength: 8192 },
    { id: 'gpt-3.5-turbo', name: 'GPT-3.5 Turbo', provider: 'OPENAI', isFree: false, contextLength: 16385 },
    { id: 'o1-preview', name: 'OpenAI o1 Preview', provider: 'OPENAI', isFree: false, contextLength: 128000 },
    { id: 'o1-mini', name: 'OpenAI o1 Mini', provider: 'OPENAI', isFree: false, contextLength: 128000 },
    { id: 'o3-mini', name: 'OpenAI o3 Mini', provider: 'OPENAI', isFree: false, contextLength: 200000 },
];

// OpenRouter cache
let openRouterCache: LLMModelOption[] | null = null;
let openRouterCacheTime = 0;
const CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes

interface OpenRouterModelResponse {
    data: {
        id: string;
        name: string;
        context_length?: number;
        pricing?: {
            prompt: string;
            completion: string;
        };
    }[];
}

const fetchOpenRouterFreeModels = async (apiKey?: string): Promise<LLMModelOption[]> => {
    const now = Date.now();
    if (openRouterCache && now - openRouterCacheTime < CACHE_TTL_MS) {
        return openRouterCache;
    }

    try {
        const headers: Record<string, string> = {
            'Content-Type': 'application/json',
        };
        if (apiKey) {
            headers['Authorization'] = `Bearer ${apiKey}`;
        }

        const response = await fetch('https://openrouter.ai/api/v1/models', { headers });
        if (!response.ok) {
            console.warn('[LLMModelService] Failed to fetch OpenRouter models:', response.statusText);
            return openRouterCache || [];
        }

        const json: OpenRouterModelResponse = await response.json();

        const freeModels: LLMModelOption[] = json.data
            .filter(m => {
                const promptCost = parseFloat(m.pricing?.prompt || '1');
                return promptCost === 0;
            })
            .map(m => ({
                id: m.id,
                name: m.name,
                provider: 'OPENROUTER' as const,
                isFree: true,
                contextLength: m.context_length,
            }))
            .sort((a, b) => a.name.localeCompare(b.name));

        openRouterCache = freeModels;
        openRouterCacheTime = now;
        console.log(`[LLMModelService] Cached ${freeModels.length} free OpenRouter models.`);
        return freeModels;
    } catch (err) {
        console.error('[LLMModelService] Error fetching OpenRouter models:', err);
        return openRouterCache || [];
    }
};

export const getAvailableModels = async (config?: EngineConfig): Promise<LLMModelOption[]> => {
    const models = [...STATIC_MODELS];

    // Only include OpenAI models if key is configured
    const hasOpenAIKey = !!config?.apiKeys.openai;
    const hasOpenRouterKey = !!config?.apiKeys.openrouter;

    const filtered = models.filter(m => {
        if (m.provider === 'OPENAI' && !hasOpenAIKey) return false;
        return true;
    });

    // Always try to fetch OpenRouter free models (no key needed for listing)
    const openRouterModels = await fetchOpenRouterFreeModels(
        hasOpenRouterKey ? config?.apiKeys.openrouter : undefined
    );
    filtered.push(...openRouterModels);

    return filtered;
};

// Clear cache (useful for testing or manual refresh)
export const clearModelCache = () => {
    openRouterCache = null;
    openRouterCacheTime = 0;
};
