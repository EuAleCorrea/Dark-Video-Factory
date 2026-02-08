import { Worker, Job } from 'bullmq';
import Redis from 'ioredis';
import { supabase } from './supabase';
import { VideoJob, JobStatus, PipelineStep, EngineConfig } from '../types';
import { ReferenceService } from '../services/ReferenceService';

const REDIS_URL = process.env.REDIS_URL || 'redis://localhost:6379';
const connection = new Redis(REDIS_URL, { maxRetriesPerRequest: null });

/**
 * CLOUD WORKER
 * Executa as etapas do pipeline que rodam na nuvem (Hostinger).
 */
export const cloudWorker = new Worker(
    'video-generation-queue',
    async (job: Job<VideoJob>) => {
        const videoJob = job.data;
        console.log(`[CloudWorker] Processando Job: ${videoJob.id} - Step: ${videoJob.currentStep}`);

        try {
            // 0. Carregar Configurações do Banco (Secrets)
            const config = await loadConfig(videoJob.id);

            // --- MAPEAMENTO DE ETAPAS ---
            switch (videoJob.currentStep) {

                case PipelineStep.REFERENCE_FETCH:
                    await handleReferenceFetch(videoJob, config);
                    break;

                case PipelineStep.REFERENCE_TRANSCRIBE:
                    await handleReferenceTranscribe(videoJob, config);
                    break;

                // Próximas etapas serão implementadas aqui (Init, Scripting, etc.)

                default:
                    console.log(`[CloudWorker] Etapa ${videoJob.currentStep} não processada por este worker ou já finalizada.`);
            }

        } catch (error) {
            console.error(`[CloudWorker Error] Job ${videoJob.id}:`, error);
            await updateJobStatus(videoJob.id, {
                status: JobStatus.FAILED,
                logs: [...videoJob.logs, {
                    timestamp: new Date().toISOString(),
                    level: 'ERROR',
                    message: `Erro na etapa ${videoJob.currentStep}: ${(error as Error).message}`
                }]
            });
            throw error;
        }
    },
    { connection }
);

// --- HANDLERS DAS ETAPAS ---

async function handleReferenceFetch(job: VideoJob, config: EngineConfig) {
    if (!job.modelChannel) {
        // Se não tem canal modelo, pula para o INIT
        await updateJobStatus(job.id, {
            currentStep: PipelineStep.INIT,
            progress: 5
        });
        return;
    }

    await addLog(job.id, `Iniciando busca de vídeo modelo para: ${job.modelChannel}`);

    const refVideo = await ReferenceService.fetchTopReferenceVideo(job.modelChannel, config);

    if (!refVideo) {
        await addLog(job.id, `Nenhum vídeo encontrado para o canal modelo. Prosseguindo sem referência.`, 'WARN');
        await updateJobStatus(job.id, {
            currentStep: PipelineStep.INIT,
            progress: 5
        });
        return;
    }

    await addLog(job.id, `Vídeo modelo selecionado: ${refVideo.title} (${refVideo.id})`, 'SUCCESS');

    await updateJobStatus(job.id, {
        currentStep: PipelineStep.REFERENCE_TRANSCRIBE,
        progress: 10,
        // Armazenar o ID do vídeo para a próxima etapa (podemos salvar no metadata ou campo específico)
        modelChannel: refVideo.id // Sobrescrevemos com o ID real do vídeo
    });
}

async function handleReferenceTranscribe(job: VideoJob, config: EngineConfig) {
    // O job.modelChannel agora deve conter o ID do vídeo selecionado
    const videoId = job.modelChannel;
    if (!videoId) {
        await updateJobStatus(job.id, { currentStep: PipelineStep.INIT });
        return;
    }

    await addLog(job.id, `Iniciando transcrição via Apify para o vídeo: ${videoId}`);

    try {
        const { transcript, metadata } = await ReferenceService.transcribeReference(videoId, config);
        await addLog(job.id, `Transcrição concluída com sucesso (${transcript.length} caracteres).`, 'SUCCESS');

        await updateJobStatus(job.id, {
            referenceScript: transcript,
            referenceMetadata: metadata,
            currentStep: PipelineStep.INIT,
            progress: 20
        });
    } catch (error) {
        await addLog(job.id, `Erro na transcrição: ${(error as Error).message}. Prosseguindo com tema genérico.`, 'WARN');
        await updateJobStatus(job.id, {
            currentStep: PipelineStep.INIT,
            progress: 20
        });
    }
}

// --- UTILS ---

async function loadConfig(jobId: string): Promise<EngineConfig> {
    // Futuramente buscar do Supabase (tabela engine_secrets)
    // Por enquanto usa variáveis de ambiente ou mock
    return {
        apiKeys: {
            youtube: process.env.YOUTUBE_API_KEY || '',
            apify: process.env.APIFY_API_TOKEN || '',
            gemini: process.env.GEMINI_API_KEY || ''
        }
    } as EngineConfig;
}

async function updateJobStatus(jobId: string, updates: any) {
    const { error } = await supabase
        .from('jobs')
        .update(updates)
        .eq('id', jobId);

    if (error) console.error("Erro ao atualizar status do Job:", error);
}

async function addLog(jobId: string, message: string, level: string = 'INFO') {
    const { data: job } = await supabase.from('jobs').select('logs').eq('id', jobId).single();
    const logs = job?.logs || [];

    const newLogs = [...logs, {
        timestamp: new Date().toISOString(),
        level,
        message
    }];

    await supabase.from('jobs').update({ logs: newLogs }).eq('id', jobId);
}
