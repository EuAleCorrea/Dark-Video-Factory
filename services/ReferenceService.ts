import { ReferenceVideo, EngineConfig } from '../types';
import { searchChannelVideos, transcribeVideo } from '../lib/youtubeMock';
import { supabase } from '../lib/supabase';

/**
 * SERVICE: ReferenceService
 * Responsável por buscar vídeos de referência e extrair transcrições.
 */
export class ReferenceService {
    /**
     * Passo 0a: Busca o vídeo mais relevante/recente de um canal modelo.
     */
    static async fetchTopReferenceVideo(channelQuery: string, config: EngineConfig): Promise<ReferenceVideo | null> {
        console.log(`[Reference] Buscando vídeos para: ${channelQuery}`);

        // Usa a chave do YouTube se disponível
        const videos = await searchChannelVideos(channelQuery, config.apiKeys.youtube);

        if (!videos || videos.length === 0) {
            return null;
        }

        // Por padrão, pega o primeiro (mais recente ou relevante retornado pela busca)
        // No futuro podemos aplicar uma lógica de "mais viral" baseada em views
        return videos[0];
    }

    /**
     * Passo 0b: Transcreve o vídeo usando Apify.
     */
    static async transcribeReference(videoId: string, config: EngineConfig): Promise<string> {
        console.log(`[Reference] Transcrevendo vídeo: ${videoId}`);

        // A chave da Apify é obrigatória para este passo real
        const apifyKey = config.apiKeys.apify;

        if (!apifyKey) {
            throw new Error("API Key da Apify não configurada para transcrição real.");
        }

        return await transcribeVideo(videoId, apifyKey);
    }

    /**
     * Atalho para atualizar o Log no Supabase
     */
    static async log(jobId: string, message: string, level: 'INFO' | 'WARN' | 'ERROR' | 'SUCCESS' = 'INFO') {
        const entry = {
            timestamp: new Date().toISOString(),
            level,
            message
        };

        // Usamos Rpc ou Select/Update para dar append no array de logs
        // Para simplificar aqui, vamos apenas logar no console, mas o orchestrador deve persistir
        console.log(`[Job ${jobId}] ${level}: ${message}`);
    }
}
