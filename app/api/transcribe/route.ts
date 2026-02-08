import { NextRequest, NextResponse } from 'next/server';
import { fetchYoutubeTranscriptFromApify } from '@/lib/apifyClient';

/**
 * API Route para servir de Proxy para a Apify.
 * Resolve problemas de CORS e protege o Token (pode usar do .env ou do header).
 */
export async function POST(req: NextRequest) {
    try {
        const { videoId, apiToken } = await req.json();

        if (!videoId) {
            return NextResponse.json({ error: 'Video ID é obrigatório' }, { status: 400 });
        }

        // Prioriza o token enviado pelo usuário (do LocalStorage), 
        // mas aceita o do .env como fallback de segurança
        const token = apiToken || process.env.APIFY_API_TOKEN;

        if (!token) {
            return NextResponse.json({ error: 'Apify API Token não configurado' }, { status: 401 });
        }

        console.log(`[API Proxy] Solicitando transcrição para: ${videoId}`);

        // Chama a função que já temos (agora rodando no SERVIDOR)
        const result = await fetchYoutubeTranscriptFromApify(videoId, token);

        return NextResponse.json(result);

    } catch (error: any) {
        console.error('[API Proxy Error]', error);
        return NextResponse.json({
            error: error.message || 'Erro interno na transcrição'
        }, { status: 500 });
    }
}
