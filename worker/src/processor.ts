
import path from 'path';
import fs from 'fs';
import { createClient } from '@supabase/supabase-js';
import { VideoJob, JobStatus, PipelineStep, ChannelProfile, EngineConfig, StoryboardSegment } from './types';
import { generateVideoScriptAndPrompts, generateSpeech, generateImage, generateVideoMetadata } from './gemini';
import { smartChunkScript, ScriptChunk } from './smartChunker';
import { generateAssContent } from './subtitleGenerator';
import { alignStoryboardToAudio } from './alignmentEngine';
import { pcmToWavBuffer, getAudioDuration, saveBase64ToFile } from './utils';
import ffmpeg from 'fluent-ffmpeg';

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const SUPABASE_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';
const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

// Configuração Engine Mockada (deve vir do DB ou env)
const ENGINE_CONFIG: EngineConfig = {
    hostVolumePath: './temp',
    ffmpegContainerImage: 'linuxserver/ffmpeg',
    maxConcurrentJobs: 1,
    providers: { scripting: 'GEMINI', image: 'GEMINI', tts: 'GEMINI' },
    apiKeys: {
        gemini: process.env.GEMINI_API_KEY || '',
        openai: process.env.OPENAI_API_KEY || '',
        elevenLabs: '',
        flux: '',
        openrouter: ''
    }
};

export async function processVideoJob(job: VideoJob) {
    const jobId = job.id;
    const workDir = path.resolve(__dirname, `../temp/${jobId}`);

    // Cria diretórios de trabalho
    if (!fs.existsSync(workDir)) fs.mkdirSync(workDir, { recursive: true });
    if (!fs.existsSync(path.join(workDir, 'images'))) fs.mkdirSync(path.join(workDir, 'images'));
    if (!fs.existsSync(path.join(workDir, 'audio'))) fs.mkdirSync(path.join(workDir, 'audio'));

    await log(jobId, `Iniciando processamento no diretório: ${workDir}`, 'INFO');

    try {
        // 1. Carregar Perfil do Canal
        const { data: profileData, error } = await supabase.from('profiles').select('*').eq('id', job.channelId).single();
        if (error || !profileData) throw new Error(`Perfil do canal ${job.channelId} não encontrado.`);

        // Mapear do DB snake_case para CamelCase do ChannelProfile
        const profile: ChannelProfile = {
            id: profileData.id,
            name: profileData.name,
            format: profileData.format,
            visualStyle: profileData.visual_style,
            voiceProfile: profileData.voice_profile,
            bgmTheme: profileData.bgm_theme,
            subtitleStyle: profileData.subtitle_style,
            llmPersona: profileData.llm_persona,
            youtubeCredentials: profileData.youtube_credentials
        };

        // --- FASE 1: ROTEIRO & STORYBOARD ---
        await updateJob(jobId, { currentStep: PipelineStep.SCRIPTING, progress: 10 });

        const { script, visualPrompts } = await generateVideoScriptAndPrompts(
            profile,
            job.theme,
            ENGINE_CONFIG,
            job.modelChannel,
            job.referenceScript
        );

        await log(jobId, "Roteiro e Prompts gerados.", 'SUCCESS');

        // Smart Chunking
        await updateJob(jobId, { currentStep: PipelineStep.TRANSCRIPTION_CHUNKING, progress: 20 });
        const chunks = smartChunkScript(script);

        let currentTime = 0;
        const storyboard: StoryboardSegment[] = chunks.map((chunk, index) => {
            const start = currentTime;
            const end = currentTime + chunk.durationEstimate;
            currentTime = end;
            const promptIndex = index % visualPrompts.length;
            return {
                id: chunk.id,
                timeRange: `${start.toFixed(1)} - ${end.toFixed(1)}`,
                duration: chunk.durationEstimate,
                scriptText: chunk.text,
                visualPrompt: `${visualPrompts[promptIndex]} --style ${profile.visualStyle}`
            };
        });

        // Salva resultado parcial
        await updateJob(jobId, {
            result: { script, rawPrompts: visualPrompts, storyboard },
            currentStep: PipelineStep.VOICE_GEN,
            progress: 30
        });

        // --- FASE 2: VOZ ---
        // Se o job exigir aprovação humana, teríamos parado aqui. 
        // Mas o Worker assume execução contínua por enquanto.

        await log(jobId, "Sintetizando Voz...", 'INFO');
        const wavPath = path.join(workDir, 'audio', 'master.wav');

        const fullScript = storyboard.map(s => s.scriptText).join(' ');
        const pcmBase64 = await generateSpeech(fullScript, profile.voiceProfile, ENGINE_CONFIG);

        if (!pcmBase64) throw new Error("Falha na geração de voz.");

        const wavBuffer = pcmToWavBuffer(pcmBase64, 24000);
        await fs.promises.writeFile(wavPath, wavBuffer);

        const duration = await getAudioDuration(wavPath);
        await log(jobId, `Áudio gerado: ${duration.toFixed(2)}s`, 'SUCCESS');

        // Alinhamento
        const alignedStoryboard = alignStoryboardToAudio(storyboard, duration);
        await updateJob(jobId, {
            result: { script, rawPrompts: visualPrompts, storyboard: alignedStoryboard },
            progress: 50
        });

        // --- FASE 3: IMAGENS ---
        await updateJob(jobId, { currentStep: PipelineStep.IMAGE_PROMPTING, progress: 60 });
        const aspectRatio = profile.format === 'SHORTS' ? '9:16' : '16:9';

        for (let i = 0; i < alignedStoryboard.length; i++) {
            const seg = alignedStoryboard[i];
            const imgName = `${String(i + 1).padStart(3, '0')}.png`;
            const imgPath = path.join(workDir, 'images', imgName);

            try {
                const b64 = await generateImage(seg.visualPrompt, aspectRatio, ENGINE_CONFIG);
                if (b64) {
                    await saveBase64ToFile(b64, imgPath);
                    // Atualiza asset no storyboard com caminho local (ou URL pública se uploadasse)
                    alignedStoryboard[i].assets = { imageUrl: imgPath };
                } else {
                    // Placeholder se falhar
                    await log(jobId, `Falha imagem ${i + 1}. Usando placeholder? (Não implementado)`, 'WARN');
                }
            } catch (e) {
                console.error(`Erro imagem ${i + 1}`, e);
            }
        }

        // --- FASE 4: RENDER (FFmpeg) ---
        await updateJob(jobId, { currentStep: PipelineStep.RENDERING, progress: 80 });
        const outputPath = path.join(workDir, `output_${jobId}.mp4`);
        const assPath = path.join(workDir, 'subtitles.ass');
        const assContent = generateAssContent(alignedStoryboard, profile);
        await fs.promises.writeFile(assPath, assContent, 'utf-8');

        await renderVideoFFmpeg(workDir, alignedStoryboard, wavPath, assPath, outputPath, profile.format);

        await log(jobId, "Renderização concluída.", 'SUCCESS');

        // --- FASE 5: UPLOAD (Simulado / Todo) ---
        // Aqui faríamos upload do MP4 para o Supabase Storage
        // const { data: uploadData, error: uploadError } = await supabase.storage.from('videos').upload(`${jobId}.mp4`, fs.createReadStream(outputPath));

        await updateJob(jobId, {
            status: JobStatus.COMPLETED,
            currentStep: PipelineStep.DONE,
            progress: 100
        });

    } catch (e) {
        console.error("Erro Fatal no Processador:", e);
        await log(jobId, `Erro Fatal: ${(e as Error).message}`, 'ERROR');
        throw e;
    }
}

async function renderVideoFFmpeg(workDir: string, storyboard: StoryboardSegment[], audioPath: string, assPath: string, outputPath: string, format: string) {
    return new Promise<void>((resolve, reject) => {
        const command = ffmpeg();

        // Input de Imagens (Pattern)
        // ffmpeg espera %03d.png
        command.input(path.join(workDir, 'images', '%03d.png'))
            .inputOptions(['-loop 1', `-t ${storyboard.reduce((acc, s) => acc + s.duration, 0) + 5}`]); // Duração total + margem

        // Input de Áudio
        command.input(audioPath);

        // Filtros complexos (Zoompan + Subtitles)
        const resolution = format === 'SHORTS' ? "1080:1920" : "1920:1080";

        // Simplificado para teste: Apenas resize e legendas
        // Zoompan é complexo de acertar sem ajuste fino
        command.complexFilter([
            `[0:v]scale=${resolution}:force_original_aspect_ratio=increase,crop=${resolution.replace(':', '/')}[v_scaled]`,
            `[v_scaled]ass=${assPath.replace(/\\/g, '/')}[v_subbed]` // Caminho do ASS deve ter forward slashes
        ]);

        command.outputOptions([
            '-map [v_subbed]',
            '-map 1:a',
            '-c:v libx264',
            '-preset ultrafast', // Para dev
            '-shortest',
            '-pix_fmt yuv420p'
        ]);

        command.save(outputPath)
            .on('end', () => resolve())
            .on('error', (err) => reject(err));
    });
}

async function log(jobId: string, message: string, level: 'INFO' | 'WARN' | 'ERROR' | 'SUCCESS') {
    // Busca logs atuais e faz append
    const { data } = await supabase.from('jobs').select('logs').eq('id', jobId).single();
    const currentLogs = data?.logs || [];
    const entry = { timestamp: new Date().toISOString(), level, message };

    await supabase.from('jobs').update({
        logs: [...currentLogs, entry],
        updated_at: new Date().toISOString()
    }).eq('id', jobId);
}

async function updateJob(jobId: string, updates: Partial<VideoJob>) {
    // Mapeia VideoJob para colunas DB
    const payload: any = {};
    if (updates.status) payload.status = updates.status;
    if (updates.currentStep) payload.current_step = updates.currentStep;
    if (updates.progress) payload.progress = updates.progress;
    if (updates.result) payload.result = updates.result;

    payload.updated_at = new Date().toISOString();

    await supabase.from('jobs').update(payload).eq('id', jobId);
}
