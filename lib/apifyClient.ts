/**
 * APIFY CLIENT SERVICE
 * Responsável por orquestrar a extração de dados via Apify Actors.
 * Usamos o actor 'dtrungtin/youtube-transcript' por ser especializado e econômico.
 */

const APIFY_BASE_URL = 'https://api.apify.com/v2';
// Actor ID for "YouTube Transcript Scraper"
const ACTOR_ID = 'dtrungtin/youtube-transcript'; 

interface ApifyRun {
  id: string;
  defaultDatasetId: string;
  status: 'READY' | 'RUNNING' | 'SUCCEEDED' | 'FAILED' | 'TIMED-OUT' | 'ABORTED';
}

/**
 * Dispara o scraper de transcrição e aguarda o resultado.
 * Implementa padrão de Polling com Circuit Breaker (Timeout).
 */
export const fetchYoutubeTranscriptFromApify = async (videoId: string, apiToken: string): Promise<string> => {
    try {
        console.log(`[Apify] Iniciando job para video: ${videoId}`);

        // 1. Start the Actor
        const run = await triggerActor(videoId, apiToken);
        console.log(`[Apify] Run ID: ${run.id}. Aguardando processamento...`);

        // 2. Poll for completion (Max 60 seconds)
        const finishedRun = await waitForRunCompletion(run.id, apiToken);
        
        if (finishedRun.status !== 'SUCCEEDED') {
            throw new Error(`Apify run failed with status: ${finishedRun.status}`);
        }

        // 3. Fetch Dataset
        console.log(`[Apify] Job concluído. Baixando dataset: ${finishedRun.defaultDatasetId}`);
        const items = await fetchDatasetItems(finishedRun.defaultDatasetId, apiToken);

        // 4. Parse & Combine
        if (!items || items.length === 0) {
            throw new Error("Nenhuma transcrição encontrada. O vídeo pode não ter legendas habilitadas.");
        }

        const fullText = items
            .map((item: any) => item.text)
            .filter((t: any) => t) // Remove vazios
            .join(' ');

        return fullText;

    } catch (error) {
        console.error("[Apify Error]", error);
        throw error;
    }
};

async function triggerActor(videoId: string, token: string): Promise<ApifyRun> {
    const url = `${APIFY_BASE_URL}/acts/${ACTOR_ID}/runs?token=${token}`;
    
    const response = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            videoId: videoId,
            lang: 'pt', // Preferência por PT
        })
    });

    if (!response.ok) {
        const err = await response.json();
        throw new Error(`Failed to start actor: ${err.error?.message || response.statusText}`);
    }

    const data = await response.json();
    return data.data;
}

async function waitForRunCompletion(runId: string, token: string): Promise<ApifyRun> {
    const url = `${APIFY_BASE_URL}/acts/${ACTOR_ID}/runs/${runId}?token=${token}`;
    
    const POLLING_INTERVAL = 3000; // 3s
    const MAX_ATTEMPTS = 20; // 20 * 3s = 60s Timeout
    let attempts = 0;

    while (attempts < MAX_ATTEMPTS) {
        attempts++;
        await new Promise(resolve => setTimeout(resolve, POLLING_INTERVAL));

        const response = await fetch(url);
        if (!response.ok) {
            console.warn(`[Apify] Polling error (Attempt ${attempts}): ${response.statusText}`);
            continue;
        }

        const data = await response.json();
        const run: ApifyRun = data.data;

        if (run.status === 'SUCCEEDED' || run.status === 'FAILED' || run.status === 'ABORTED' || run.status === 'TIMED-OUT') {
            return run;
        }
        
        console.log(`[Apify] Status: ${run.status} (Tentativa ${attempts}/${MAX_ATTEMPTS})`);
    }

    throw new Error("Apify Job Timeout: O scraper demorou mais de 60s para responder.");
}

async function fetchDatasetItems(datasetId: string, token: string): Promise<any[]> {
    const url = `${APIFY_BASE_URL}/datasets/${datasetId}/items?token=${token}`;
    const response = await fetch(url);
    if (!response.ok) throw new Error("Failed to fetch dataset items");
    return await response.json();
}