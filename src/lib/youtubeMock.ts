import { ReferenceVideo } from "../types";
import { fetchYoutubeTranscriptFromApify } from "./apifyClient";

/**
 * HYBRID YOUTUBE CLIENT
 * Se uma API Key for fornecida, faz chamadas reais à YouTube Data API v3.
 * Se não, retorna dados mockados para demonstração.
 */

const MOCK_VIDEOS: ReferenceVideo[] = [
    {
        id: 'vid_1',
        title: '7 Sinais Que Ele Perdeu o Interesse',
        thumbnailUrl: 'https://images.unsplash.com/photo-1621574539437-4b7b4816298f?ixlib=rb-4.0.3&auto=format&fit=crop&w=640&h=360&q=80',
        views: '1.2M',
        duration: '08:45',
        publishedAt: '2 dias atrás',
        transcript: "Você sente que ele está distante? Neste vídeo, vamos analisar os 7 sinais comportamentais sutis que indicam perda de interesse. O primeiro sinal é a mudança na frequência de mensagens..."
    },
    {
        id: 'vid_2',
        title: 'Como Ser Irresistível Sem Dizer Nada',
        thumbnailUrl: 'https://images.unsplash.com/photo-1494790108377-be9c29b29330?ixlib=rb-4.0.3&auto=format&fit=crop&w=640&h=360&q=80',
        views: '890K',
        duration: '10:20',
        publishedAt: '1 semana atrás',
        transcript: "A linguagem corporal fala mais alto que palavras. Hoje vou te ensinar técnicas de espelhamento e contato visual que aumentam sua atratividade instantaneamente. Começando pelo olhar..."
    },
    {
        id: 'vid_3',
        title: 'O Segredo da Energia Feminina Obscura',
        thumbnailUrl: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?ixlib=rb-4.0.3&auto=format&fit=crop&w=640&h=360&q=80',
        views: '2.4M',
        duration: '09:15',
        publishedAt: '2 semanas atrás',
        transcript: "Existe um poder magnético na calma e no mistério. A energia feminina obscura não é sobre maldade, é sobre autenticidade e limites claros. Vamos desconstruir esse arquétipo..."
    },
];

// --- REAL API HELPERS ---

const parseDuration = (ptDuration: string): string => {
    if (!ptDuration) return "00:00";
    // Converts PT1H2M10S to 01:02:10 or 05:30
    const match = ptDuration.match(/PT(\d+H)?(\d+M)?(\d+S)?/);
    if (!match) return "00:00";

    const h = (match[1] || '').replace('H', '');
    const m = (match[2] || '').replace('M', '');
    const s = (match[3] || '').replace('S', '');

    const parts = [h, m, s].map(p => p ? p.padStart(2, '0') : '').filter(p => p !== '');
    if (parts.length === 1) return `00:${parts[0]}`; // Just seconds
    return parts.join(':');
};

const formatViews = (views: string): string => {
    const num = parseInt(views);
    if (num >= 1000000) return (num / 1000000).toFixed(1) + 'M';
    if (num >= 1000) return (num / 1000).toFixed(1) + 'K';
    return num.toString();
};

const formatDate = (dateString: string): string => {
    const date = new Date(dateString);
    return date.toLocaleDateString('pt-BR');
};

/**
 * Searches for videos. Uses API Key if provided, else Mock.
 */
export const searchChannelVideos = async (channelQuery: string, apiKey?: string): Promise<ReferenceVideo[]> => {
    if (!apiKey) {
        // Fallback to Mock
        await new Promise(resolve => setTimeout(resolve, 800));
        return MOCK_VIDEOS;
    }

    try {
        console.log("Fetching Real Data from YouTube API...");

        // 1. Find Channel ID
        const searchUrl = `https://www.googleapis.com/youtube/v3/search?part=snippet&q=${encodeURIComponent(channelQuery)}&type=channel&key=${apiKey}`;
        const searchRes = await fetch(searchUrl);
        const searchData = await searchRes.json();

        if (!searchData.items || searchData.items.length === 0) {
            throw new Error("Canal não encontrado");
        }

        const channelId = searchData.items[0].id.channelId;

        // 2. Get Recent Videos
        const videosUrl = `https://www.googleapis.com/youtube/v3/search?part=snippet&channelId=${channelId}&order=date&maxResults=9&type=video&key=${apiKey}`;
        const videosRes = await fetch(videosUrl);
        const videosData = await videosRes.json();

        if (!videosData.items) return [];

        // 3. Get Video Details (Duration & Views require 'videos' endpoint, not 'search')
        const videoIds = videosData.items.map((v: any) => v.id.videoId).join(',');
        const detailsUrl = `https://www.googleapis.com/youtube/v3/videos?part=contentDetails,statistics&id=${videoIds}&key=${apiKey}`;
        const detailsRes = await fetch(detailsUrl);
        const detailsData = await detailsRes.json();

        // 4. Merge Data
        return videosData.items.map((item: any) => {
            const detail = detailsData.items.find((d: any) => d.id === item.id.videoId);
            return {
                id: item.id.videoId,
                title: item.snippet.title,
                thumbnailUrl: item.snippet.thumbnails.medium.url, // 320x180 usually
                publishedAt: formatDate(item.snippet.publishedAt),
                // Merge details if available
                views: detail ? formatViews(detail.statistics.viewCount) : 'N/A',
                duration: detail ? parseDuration(detail.contentDetails.duration) : '--:--',
                // Note: YouTube API does NOT provide transcripts/captions directly in search. 
                // We keep this null or use a placeholder for the orchestrator to simulate generation.
                transcript: undefined
            };
        });

    } catch (error) {
        console.error("YouTube API Error:", error);
        return [];
    }
};

/**
 * Obtém a transcrição do vídeo.
 * - Se `apifyKey` for fornecido: Dispara um Scraper no Apify (Real).
 * - Se não: Usa Mock ou Placeholder.
 */
export const transcribeVideo = async (videoId: string, apifyKey?: string): Promise<{ transcript: string, metadata: any }> => {

    // 1. Tenta usar Apify Scraper Real
    if (apifyKey) {
        try {
            return await fetchYoutubeTranscriptFromApify(videoId, apifyKey);
        } catch (error) {
            console.error("Falha no Apify, caindo para simulação...", error);
            // Fallback para simulação se o scraper falhar
            return {
                transcript: `[ERRO APIFY: ${(error as Error).message}] - SIMULAÇÃO ATIVADA.\n\nNeste vídeo simulado, abordaremos o tema de forma genérica para não travar o fluxo...`,
                metadata: { error: true, message: (error as Error).message }
            };
        }
    }

    // 2. Fallback Mock (Sem chave Apify)
    await new Promise(resolve => setTimeout(resolve, 1500));

    const mock = MOCK_VIDEOS.find(v => v.id === videoId);
    if (mock) return { transcript: mock.transcript || "", metadata: { title: mock.title, is_mock: true } };

    return {
        transcript: `[SIMULAÇÃO DE TRANSCRIÇÃO PARA O VÍDEO ${videoId}]\n\nNeste vídeo, vamos explorar os conceitos fundamentais do tema proposto. É importante observar que a estrutura narrativa segue um padrão de gancho inicial, desenvolvimento de três pontos chaves e uma conclusão com call-to-action. (Nota: Configure a chave da Apify para extração real).`,
        metadata: { is_mock: true, videoId }
    };
};