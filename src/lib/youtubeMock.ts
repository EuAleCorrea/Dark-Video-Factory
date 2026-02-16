import { ReferenceVideo } from "../types";
import { fetchYoutubeTranscriptFromApify } from "./apifyClient";

/**
 * HYBRID YOUTUBE CLIENT
 * Se uma API Key for fornecida, faz chamadas reais à YouTube Data API v3.
 * Se não, retorna dados mockados para demonstração.
 */

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

export const searchChannelVideos = async (channelQuery: string, apiKey?: string): Promise<ReferenceVideo[]> => {
    if (!apiKey) {
        throw new Error("Chave da API do YouTube não configurada.");
    }

    try {
        console.log("Fetching Real Data from YouTube API...");

        // 1. Find Channel ID
        const searchUrl = `https://www.googleapis.com/youtube/v3/search?part=snippet&q=${encodeURIComponent(channelQuery)}&type=channel&key=${apiKey}`;
        const searchRes = await fetch(searchUrl);
        const searchData = await searchRes.json();

        if (searchData.error) {
            throw new Error(`YouTube API Error: ${searchData.error.message}`);
        }

        if (!searchData.items || searchData.items.length === 0) {
            console.warn("Canal não encontrado:", channelQuery);
            throw new Error(`Canal "${channelQuery}" não encontrado.`);
        }

        const channelId = searchData.items[0].id.channelId;
        const channelTitle = searchData.items[0].snippet.title; // Captura o nome real do canal
        console.log("Channel Found:", channelId, channelTitle);

        // 2. Get Recent Videos
        const videosUrl = `https://www.googleapis.com/youtube/v3/search?part=snippet&channelId=${channelId}&order=date&maxResults=9&type=video&key=${apiKey}`;
        const videosRes = await fetch(videosUrl);
        const videosData = await videosRes.json();

        if (videosData.error) {
            throw new Error(`YouTube API Error (Videos): ${videosData.error.message}`);
        }

        if (!videosData.items) return [];

        // 3. Get Video Details
        const videoIds = videosData.items.map((v: any) => v.id.videoId).join(',');
        const detailsUrl = `https://www.googleapis.com/youtube/v3/videos?part=contentDetails,statistics&id=${videoIds}&key=${apiKey}`;
        const detailsRes = await fetch(detailsUrl);
        const detailsData = await detailsRes.json();

        // 4. Merge Data & Filter (min 500 views para garantir que tem legendas)
        const MIN_VIEWS = 500;
        return videosData.items
            .map((item: any) => {
                const detail = (detailsData.items || []).find((d: any) => d.id === item.id.videoId);
                const rawViews = detail ? parseInt(detail.statistics.viewCount || '0') : 0;
                return {
                    id: item.id.videoId,
                    title: item.snippet.title,
                    channelName: channelTitle, // <--- Aqui o nome do canal agora é preservado
                    thumbnailUrl: item.snippet.thumbnails.medium.url,
                    publishedAt: formatDate(item.snippet.publishedAt),
                    views: detail ? formatViews(detail.statistics.viewCount) : 'N/A',
                    duration: detail ? parseDuration(detail.contentDetails.duration) : '--:--',
                    transcript: undefined,
                    _rawViews: rawViews
                };
            })
            .filter((v: any) => v._rawViews >= MIN_VIEWS)
            .map(({ _rawViews, ...v }: any) => v as ReferenceVideo);

    } catch (error) {
        console.error("YouTube API Search Failed:", error);
        throw error; // Propagate error to allows UI to show alert
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

    // Removed MOCK_VIDEOS check
    // const mock = MOCK_VIDEOS.find(v => v.id === videoId);
    // if (mock) return { transcript: mock.transcript || "", metadata: { title: mock.title, is_mock: true } };

    return {
        transcript: `[SIMULAÇÃO DE TRANSCRIÇÃO PARA O VÍDEO ${videoId}]\n\nNeste vídeo, vamos explorar os conceitos fundamentais do tema proposto. É importante observar que a estrutura narrativa segue um padrão de gancho inicial, desenvolvimento de três pontos chaves e uma conclusão com call-to-action. (Nota: Configure a chave da Apify para extração real).`,
        metadata: { is_mock: true, videoId }
    };
};