import { EngineConfig } from '../types';
import { callLLMWithRetry } from './geminiService';

/**
 * PexelsService.ts
 * Serviço para busca de imagens e vídeos usando a API do Pexels.
 * Documentação: https://www.pexels.com/api/documentation/
 */

export interface PexelsPhoto {
    id: number;
    width: number;
    height: number;
    url: string;
    photographer: string;
    src: {
        original: string;
        large2x: string;
        large: string;
        medium: string;
        small: string;
        portrait: string;
        landscape: string;
        tiny: string;
    };
    alt: string;
}

export interface PexelsVideo {
    id: number;
    width: number;
    height: number;
    url: string;
    image: string;
    duration: number;
    user: {
        id: number;
        name: string;
        url: string;
    };
    video_files: {
        id: number;
        quality: string;
        file_type: string;
        width: number;
        height: number;
        link: string;
    }[];
}

export interface PexelsSearchResponse<T> {
    total_results?: number;
    page: number;
    per_page: number;
    photos?: T[];
    videos?: T[];
}

export class PexelsService {
    private static BASE_URL = 'https://api.pexels.com';

    /**
     * Dicionário básico PT→EN para fallback de tradução
     * Usado quando o LLM não está disponível
     */
    private static PT_EN_DICT: Record<string, string> = {
        'cachoeira': 'waterfall',
        'gelada': 'frozen',
        'gelado': 'frozen',
        'frio': 'cold',
        'fria': 'cold',
        'quente': 'hot',
        'natureza': 'nature',
        'montanha': 'mountain',
        'praia': 'beach',
        'mar': 'sea',
        'oceano': 'ocean',
        'floresta': 'forest',
        'rio': 'river',
        'lago': 'lake',
        'neve': 'snow',
        'gelo': 'ice',
        'sol': 'sun',
        'lua': 'moon',
        'estrela': 'star',
        'chuva': 'rain',
        'nuvem': 'cloud',
        'nuvens': 'clouds',
        'cidade': 'city',
        'noite': 'night',
        'dia': 'day',
        'pessoas': 'people',
        'pessoa': 'person',
        'mulher': 'woman',
        'homem': 'man',
        'criança': 'child',
        'animal': 'animal',
        'gato': 'cat',
        'cachorro': 'dog',
        'pássaro': 'bird',
        'flor': 'flower',
        'flores': 'flowers',
        'árvore': 'tree',
        'céu': 'sky',
        'pôr do sol': 'sunset',
        'nascer do sol': 'sunrise',
        'comida': 'food',
        'café': 'coffee',
        'carro': 'car',
        'tecnologia': 'technology',
        'escritório': 'office',
        'trabalho': 'work',
        'casa': 'house',
        'arquitetura': 'architecture',
        'abstrato': 'abstract',
        'escuro': 'dark',
        'claro': 'bright',
        'bonito': 'beautiful',
        'bonita': 'beautiful',
        'grande': 'big',
        'pequeno': 'small',
        'água': 'water',
        'fogo': 'fire',
        'terra': 'earth',
        'ar': 'air',
        'vento': 'wind',
        'tempestade': 'storm',
        'relâmpago': 'lightning',
        'arco-íris': 'rainbow',
        'deserto': 'desert',
        'selva': 'jungle',
        'campo': 'field',
        'jardim': 'garden',
        'estrada': 'road',
        'ponte': 'bridge',
        'castelo': 'castle',
        'igreja': 'church',
        'música': 'music',
        'dança': 'dance',
        'festa': 'party',
        'amor': 'love',
        'feliz': 'happy',
        'triste': 'sad',
    };

    /**
     * Tradução de fallback usando dicionário PT→EN
     * Substitui cada palavra conhecida pela tradução em inglês
     */
    private static fallbackTranslate(query: string): string {
        const words = query.toLowerCase().trim().split(/\s+/);
        const translated = words.map(word => {
            // Remove acentos para lookup
            const normalized = word.normalize('NFD').replace(/[\u0300-\u036f]/g, '');
            // Procura no dicionário (com e sem acento)
            return this.PT_EN_DICT[word] || this.PT_EN_DICT[normalized] || word;
        });

        const result = translated.join(' ');

        // Se pelo menos uma palavra foi traduzida, retorna o resultado
        if (result !== query.toLowerCase().trim()) {
            console.log(`[PexelsService] 📖 Tradução fallback: "${query}" -> "${result}"`);
            return result;
        }

        return query;
    }

    /**
     * Traduz uma consulta para inglês otimizado para stock footage usando Gemini
     * Com fallback de dicionário PT→EN caso o LLM falhe
     */
    static async translateQuery(query: string, config: EngineConfig): Promise<string> {
        if (!query.trim()) return query;

        const systemPrompt = `Você é um tradutor especializado em stock footage para a API do Pexels.
Sua missão é converter consultas do usuário para INGLÊS que retorne os MELHORES resultados visuais.

REGRAS CRÍTICAS:
1. NUNCA use a palavra "Gelada" sozinha se o contexto for de temperatura. "Cachoeira gelada" DEVE ser "frozen waterfall" ou "cold waterfall".
2. Remova ambiguidades linguísticas que levem a animais em vez de paisagens.
3. Se o termo for "gelada", "gelado" ou "frio", use "cold", "frozen", "icy" ou "snowy".
4. Retorne APENAS o termo traduzido em inglês. Sem explicações. Máximo 4 palavras.`;

        const userPrompt = `Traduzir para busca de imagem/vídeo: "${query}"`;

        try {
            const modelId = config.scriptingModel || 'gemini-1.5-flash';
            const provider = config.scriptingProvider || 'GEMINI';

            const translated = await callLLMWithRetry(
                systemPrompt,
                userPrompt,
                modelId,
                provider,
                config,
                'text'
            );

            const result = translated.trim().replace(/"/g, '');
            console.log(`[PexelsService] 🌐 Tradução LLM: "${query}" -> "${result}"`);
            return result;
        } catch (error) {
            console.warn('[PexelsService] ⚠️ LLM indisponível, usando tradução fallback:', error);
            // FALLBACK: usa dicionário básico PT→EN
            return this.fallbackTranslate(query);
        }
    }

    /**
     * Busca fotos no Pexels
     * Usa locale=en-US para forçar interpretação em inglês
     */
    static async searchPhotos(
        query: string,
        apiKey: string,
        perPage: number = 20,
        page: number = 1
    ): Promise<PexelsSearchResponse<PexelsPhoto>> {
        if (!apiKey) throw new Error('Pexels API Key não configurada.');

        const url = `${this.BASE_URL}/v1/search?query=${encodeURIComponent(query)}&per_page=${perPage}&page=${page}&locale=en-US`;

        try {
            const response = await fetch(url, {
                headers: {
                    'Authorization': apiKey
                }
            });

            if (!response.ok) {
                const errorData = await response.json().catch(() => ({}));
                throw new Error(`Erro na API Pexels (${response.status}): ${errorData.error || response.statusText}`);
            }

            return await response.json();
        } catch (error) {
            console.error('[PexelsService] Erro ao buscar fotos:', error);
            throw error;
        }
    }

    /**
     * Busca vídeos no Pexels
     * Usa locale=en-US para forçar interpretação em inglês
     */
    static async searchVideos(
        query: string,
        apiKey: string,
        perPage: number = 20,
        page: number = 1
    ): Promise<PexelsSearchResponse<PexelsVideo>> {
        if (!apiKey) throw new Error('Pexels API Key não configurada.');

        const url = `${this.BASE_URL}/videos/search?query=${encodeURIComponent(query)}&per_page=${perPage}&page=${page}&locale=en-US`;

        try {
            const response = await fetch(url, {
                headers: {
                    'Authorization': apiKey
                }
            });

            if (!response.ok) {
                const errorData = await response.json().catch(() => ({}));
                throw new Error(`Erro na API Pexels (${response.status}): ${errorData.error || response.statusText}`);
            }

            return await response.json();
        } catch (error) {
            console.error('[PexelsService] Erro ao buscar vídeos:', error);
            throw error;
        }
    }

    /**
     * Gera um termo de busca otimizado para stock footage a partir do texto de um segmento.
     * Usa IA para extrair a essência visual do trecho e retorna 2-4 palavras-chave em inglês.
     * Fallback: extrai substantivos e traduz para inglês.
     */
    static async generateSearchFromText(scriptText: string, config: EngineConfig): Promise<string> {
        if (!scriptText.trim()) return '';

        const systemPrompt = `You are an expert visual director for YouTube dark/storytelling channels.
Your job: given a narration script segment in Portuguese, output 2-5 ENGLISH search keywords that will find the PERFECT stock footage on Pexels.

CRITICAL RULES:
- Output ONLY the English search keywords. Nothing else. No explanations, no quotes, no numbering.
- Think: "What B-roll footage would a YouTube video editor overlay on this narration?"
- For abstract/philosophical text, think of CINEMATIC METAPHORS that visually represent the concept.
- For emotional text, think of MOODY atmospheric footage.
- Keywords must be concrete and visual (things a camera can capture).
- Prefer cinematic shots: silhouettes, close-ups, wide angles, dramatic lighting.

EXAMPLES:
Script: "A maioria dos homens caminha pelo mundo completamente cega para as forças que realmente regem as interações humanas"
Keywords: crowd walking city silhouette

Script: "Quando uma mulher olha para você e desvia o olhar rapidamente, isso não é timidez"
Keywords: woman eye contact close up

Script: "O dinheiro não compra felicidade, mas a pobreza destrói tudo"
Keywords: luxury vs poverty contrast dark

Script: "Existe um segredo que os ricos nunca contam aos pobres"
Keywords: wealthy businessman dark office

Script: "A solidão é o preço da liberdade"
Keywords: man alone cliff sunset silhouette

Script: "Seu cérebro foi programado para falhar"
Keywords: brain neural network dark

Script: "As leis do poder são invisíveis, mas governam cada interação"
Keywords: chess pieces dramatic shadow

Script: "Ela diz que não quer nada sério, mas age de forma completamente diferente"
Keywords: couple tension romantic dark`;

        const userPrompt = scriptText.substring(0, 500);

        try {
            const modelId = config.scriptingModel || 'gemini-2.0-flash-lite';
            const provider = config.providers.scripting || 'GEMINI';

            const result = await callLLMWithRetry(systemPrompt, userPrompt, modelId, provider, config, 'text');
            // Limpa qualquer formatação extra que o LLM pode adicionar
            const cleaned = result
                .replace(/^(keywords?:?\s*)/i, '')
                .replace(/['"*#\n\r]/g, '')
                .replace(/\s+/g, ' ')
                .trim();

            if (cleaned && cleaned.length > 2 && cleaned.length < 120) {
                console.log(`[PexelsService] 🎬 Busca gerada por IA: "${scriptText.substring(0, 50)}..." → "${cleaned}"`);
                return cleaned;
            }
            console.warn(`[PexelsService] ⚠️ Resposta do LLM descartada (tamanho ${cleaned.length}): "${cleaned}"`);
        } catch (error) {
            console.warn('[PexelsService] Falha ao gerar busca por IA, usando fallback:', error);
        }

        // Fallback: extrair substantivos e traduzir via translateQuery
        console.log('[PexelsService] 📖 Usando fallback de tradução...');
        const stopWords = new Set(['a', 'o', 'os', 'as', 'um', 'uma', 'uns', 'umas', 'de', 'do', 'da', 'dos', 'das', 'em', 'no', 'na', 'nos', 'nas', 'por', 'para', 'com', 'que', 'e', 'é', 'se', 'não', 'mais', 'mas', 'como', 'pelo', 'pela', 'ao', 'aos', 'às', 'ele', 'ela', 'eles', 'elas', 'seu', 'sua', 'seus', 'suas', 'esse', 'essa', 'esses', 'essas', 'este', 'esta', 'estes', 'estas', 'isso', 'isto', 'aquilo', 'muito', 'quando', 'onde', 'quem', 'qual', 'porque', 'então', 'já', 'ainda', 'também', 'entre', 'sobre', 'até', 'após', 'antes', 'durante', 'ser', 'ter', 'estar', 'vir', 'fazer', 'poder', 'dizer', 'ver', 'dar', 'saber', 'querer', 'dever', 'haver', 'vai', 'vão', 'foi', 'são', 'era', 'tem', 'tinha', 'completamente', 'realmente', 'acreditam', 'veem', 'regem', 'caminha', 'maioria', 'forças', 'interações', 'humanas', 'superfície', 'realidade', 'final']);
        const words = scriptText.toLowerCase().replace(/[.,!?;:""'']/g, '').split(/\s+/).filter(w => w.length > 3 && !stopWords.has(w));
        const keywords = words.slice(0, 3).join(' ');

        // Tenta traduzir o fallback para inglês
        try {
            const translated = await this.translateQuery(keywords, config);
            console.log(`[PexelsService] 📖 Busca fallback traduzida: "${keywords}" → "${translated}"`);
            return translated;
        } catch {
            const dictTranslated = this.fallbackTranslate(keywords);
            console.log(`[PexelsService] 📖 Busca fallback dicionário: "${keywords}" → "${dictTranslated}"`);
            return dictTranslated;
        }
    }
}
