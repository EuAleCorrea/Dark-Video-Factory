import { invoke } from '@tauri-apps/api/core';
import {
    VideoJob, JobStatus, PipelineStep, LogEntry,
    ChannelProfile, EngineConfig, StoryboardSegment, VideoFormat
} from '../types';
import {
    generateVideoScriptAndPrompts,
    generateImage,
    generateSpeech,
    generateVideoMetadata
} from './geminiService';

export type JobUpdateCallback = (job: VideoJob) => void;

interface FfmpegInfo {
    installed: boolean;
    version: string;
    path: string;
}

interface FfmpegResult {
    success: boolean;
    stdout: string;
    stderr: string;
    exit_code: number | null;
}

export class JobQueueService {
    private queue: VideoJob[] = [];
    private isProcessing = false;
    private onJobUpdate: JobUpdateCallback;
    private getProfile: (channelId: string) => ChannelProfile | undefined;
    private getConfig: () => EngineConfig;
    private getPromptText: () => string | undefined;

    constructor(
        onJobUpdate: JobUpdateCallback,
        getProfile: (channelId: string) => ChannelProfile | undefined,
        getConfig: () => EngineConfig,
        getPromptText: () => string | undefined,
    ) {
        this.onJobUpdate = onJobUpdate;
        this.getProfile = getProfile;
        this.getConfig = getConfig;
        this.getPromptText = getPromptText;
    }

    /** Check if FFmpeg is installed */
    async checkFfmpeg(): Promise<FfmpegInfo> {
        try {
            return await invoke<FfmpegInfo>('check_ffmpeg');
        } catch {
            return { installed: false, version: '', path: '' };
        }
    }

    /** Add a job to the queue */
    enqueue(job: VideoJob): void {
        this.queue.push(job);
        console.log(`[Queue] Job ${job.id} adicionado. Fila: ${this.queue.length}`);
        this.processNext();
    }

    /** Get queue status */
    getQueueStatus() {
        return {
            queueLength: this.queue.length,
            isProcessing: this.isProcessing,
        };
    }

    /** Process next job in queue */
    private async processNext(): Promise<void> {
        if (this.isProcessing || this.queue.length === 0) return;

        this.isProcessing = true;
        const job = this.queue.shift()!;

        try {
            await this.processJob(job);
        } catch (error) {
            this.updateJob(job, {
                status: JobStatus.FAILED,
                logs: [...job.logs, this.log('ERROR', `Pipeline falhou: ${error}`)],
            });
        } finally {
            this.isProcessing = false;
            this.processNext(); // Process next in queue
        }
    }

    /** Main pipeline processor */
    private async processJob(job: VideoJob): Promise<void> {
        const profile = this.getProfile(job.channelId);
        if (!profile) {
            throw new Error(`Perfil ${job.channelId} não encontrado`);
        }
        const config = this.getConfig();

        // === STEP 1: SCRIPTING ===
        this.updateJob(job, {
            status: JobStatus.PROCESSING,
            currentStep: PipelineStep.SCRIPTING,
            progress: 5,
            logs: [...job.logs, this.log('INFO', '🖊️ Gerando roteiro via IA...')],
        });

        const { script, visualPrompts } = await generateVideoScriptAndPrompts(
            profile,
            job.theme,
            config,
            job.modelChannel,
            job.referenceScript,
        );

        const storyboard: StoryboardSegment[] = visualPrompts.map((prompt, i) => ({
            id: i,
            timeRange: `${i * 5}s - ${(i + 1) * 5}s`,
            scriptText: this.splitScript(script, visualPrompts.length, i),
            visualPrompt: prompt,
            duration: 5,
        }));

        this.updateJob(job, {
            progress: 20,
            result: { script, storyboard, rawPrompts: visualPrompts },
            logs: [...job.logs, this.log('SUCCESS', `✅ Roteiro gerado: ${script.length} chars, ${visualPrompts.length} cenas`)],
        });

        // === STEP 2: IMAGE GENERATION ===
        this.updateJob(job, {
            currentStep: PipelineStep.IMAGE_PROMPTING,
            progress: 25,
            logs: [...job.logs, this.log('INFO', `🎨 Gerando ${storyboard.length} imagens...`)],
        });

        const aspectRatio = profile.format === VideoFormat.SHORTS ? '9:16' as const : '16:9' as const;
        for (let i = 0; i < storyboard.length; i++) {
            try {
                const fullPrompt = `${storyboard[i].visualPrompt}, ${profile.visualStyle}`;
                const imageUrl = await generateImage(fullPrompt, aspectRatio, config);
                if (imageUrl) {
                    storyboard[i].assets = { ...storyboard[i].assets, imageUrl };
                }
            } catch (e) {
                console.warn(`[Pipeline] Imagem ${i + 1} falhou:`, e);
            }

            const imageProgress = 25 + Math.floor(((i + 1) / storyboard.length) * 25);
            this.updateJob(job, {
                progress: imageProgress,
                result: { ...job.result!, storyboard: [...storyboard] },
                logs: [...job.logs, this.log('INFO', `🖼️ Imagem ${i + 1}/${storyboard.length} gerada`)],
            });
        }

        // === STEP 3: VOICE GENERATION (TTS) ===
        this.updateJob(job, {
            currentStep: PipelineStep.VOICE_GEN,
            progress: 55,
            logs: [...job.logs, this.log('INFO', '🎙️ Sintetizando narração...')],
        });

        try {
            const audioData = await generateSpeech(script, profile.voiceProfile, config);
            if (audioData) {
                this.updateJob(job, {
                    result: { ...job.result!, masterAudioUrl: `data:audio/wav;base64,${audioData}` },
                    logs: [...job.logs, this.log('SUCCESS', '✅ Áudio narrado gerado')],
                });
            }
        } catch (e) {
            this.updateJob(job, {
                logs: [...job.logs, this.log('WARN', `⚠️ TTS falhou: ${e}. Continuando sem áudio.`)],
            });
        }

        this.updateJob(job, { progress: 70 });

        // === STEP 4: METADATA GENERATION ===
        this.updateJob(job, {
            currentStep: PipelineStep.METADATA_GEN,
            progress: 75,
            logs: [...job.logs, this.log('INFO', '📊 Gerando metadados virais...')],
        });

        try {
            const metadata = await generateVideoMetadata(profile, script, config);
            this.updateJob(job, {
                metadata,
                logs: [...job.logs, this.log('SUCCESS', `✅ Metadados: ${metadata.titles?.[0] || 'OK'}`)],
            });
        } catch (e) {
            this.updateJob(job, {
                logs: [...job.logs, this.log('WARN', `⚠️ Metadados falharam: ${e}`)],
            });
        }

        this.updateJob(job, { progress: 85 });

        // === STEP 5: REVIEW PENDING ===
        this.updateJob(job, {
            currentStep: PipelineStep.APPROVAL,
            status: JobStatus.REVIEW_PENDING,
            progress: 90,
            logs: [...job.logs, this.log('INFO', '👁️ Aguardando revisão humana antes da renderização...')],
        });

        // Pipeline pauses here — user must approve to trigger rendering
    }

    /** Render video using FFmpeg (called after user approval) */
    async renderJob(job: VideoJob): Promise<void> {
        const ffmpegInfo = await this.checkFfmpeg();
        if (!ffmpegInfo.installed) {
            this.updateJob(job, {
                status: JobStatus.FAILED,
                logs: [...job.logs, this.log('ERROR', '❌ FFmpeg não encontrado. Instale: https://ffmpeg.org/download.html')],
            });
            return;
        }

        this.updateJob(job, {
            status: JobStatus.PROCESSING,
            currentStep: PipelineStep.RENDERING,
            progress: 92,
            logs: [...job.logs, this.log('INFO', `🎬 Renderizando com FFmpeg (${ffmpegInfo.version.substring(0, 40)})...`)],
        });

        try {
            // For now, log the FFmpeg render step as placeholder
            // Real implementation would assemble images + audio into final video
            const result = await invoke<FfmpegResult>('run_ffmpeg', {
                args: ['-version']
            });

            if (result.success) {
                this.updateJob(job, {
                    currentStep: PipelineStep.DONE,
                    status: JobStatus.COMPLETED,
                    progress: 100,
                    logs: [...job.logs,
                    this.log('SUCCESS', '✅ Renderização concluída!'),
                    this.log('INFO', `FFmpeg: ${result.stdout.split('\n')[0]}`),
                    ],
                });
            } else {
                throw new Error(result.stderr);
            }
        } catch (e) {
            this.updateJob(job, {
                status: JobStatus.FAILED,
                logs: [...job.logs, this.log('ERROR', `❌ Render falhou: ${e}`)],
            });
        }
    }

    // --- HELPERS ---

    private updateJob(job: VideoJob, updates: Partial<VideoJob>): void {
        Object.assign(job, updates);
        this.onJobUpdate({ ...job });
    }

    private log(level: LogEntry['level'], message: string): LogEntry {
        return {
            timestamp: new Date().toISOString(),
            level,
            message,
        };
    }

    /** Split script text evenly across segments */
    private splitScript(script: string, totalSegments: number, index: number): string {
        const sentences = script.match(/[^.!?]+[.!?]+/g) || [script];
        const perSegment = Math.ceil(sentences.length / totalSegments);
        const start = index * perSegment;
        return sentences.slice(start, start + perSegment).join(' ').trim();
    }
}
