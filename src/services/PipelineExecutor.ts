
import { VideoProject, PipelineStage, EngineConfig, VideoFormat, ScriptGenerationSnapshot } from "../types";
import { ProjectService } from "./ProjectService";
import { generateVideoScriptAndPrompts, rewriteTranscript, structureScript, generateSpeech } from "./geminiService";
import { PersistenceService } from "./PersistenceService";
import { ChannelProfile, StageDataMap } from "../types";
import { pcmToWav, getAudioDuration } from "../lib/audioUtils";
import { saveAudio } from "./AudioStorageService";
import { compressProjectAudio } from "./AudioCompressService";
import { smartChunkScript } from "../lib/smartChunker";
import { alignStoryboardToAudio } from "../lib/alignmentEngine";
import { generateAssContent } from "../lib/subtitleGenerator";
import { StoryboardSegment } from "../types";
import { planStoryboard } from "./storyboardPlanner";
import { renderProjectVideo } from "./VideoRenderService";

export interface PromptPreviewRequest {
    stage: 'P1' | 'P2';
    stageLabel: string;
    modelId: string;
    provider: string;
    isCustomPrompt: boolean;
    systemPrompt: string;
    userPrompt: string;
    inputLength: number;
}

export class PipelineExecutor {
    private onPromptPreview: ((data: PromptPreviewRequest) => Promise<boolean>) | null = null;

    constructor(
        private projectService: ProjectService,
        private persistence: PersistenceService,
        private getConfig: () => EngineConfig,
        private getProfile: (channelId: string) => ChannelProfile | undefined
    ) { }

    /** Registra callback para debug visual de prompts. Retorna true=prosseguir, false=cancelar */
    setPromptPreview(cb: ((data: PromptPreviewRequest) => Promise<boolean>) | null) {
        this.onPromptPreview = cb;
    }

    async processProject(project: VideoProject): Promise<VideoProject | void> {
        try {
            await this.projectService.updateProject(project.id, { status: "processing" });

            const config = this.getConfig();
            const profile = this.getProfile(project.channelId);

            if (!profile) {
                throw new Error(`Profile not found for channel ${project.channelId}`);
            }

            switch (project.currentStage) {
                case PipelineStage.REFERENCE:
                    return await this.processReferenceStage(project, config);
                case PipelineStage.SCRIPT:
                    return await this.processScriptStage(project, profile, config);
                case PipelineStage.AUDIO:
                    return await this.processAudioStage(project, profile, config);
                case PipelineStage.AUDIO_COMPRESS:
                    return await this.processAudioCompressStage(project);
                case PipelineStage.SUBTITLES:
                    return await this.processSubtitlesStage(project, profile);
                case PipelineStage.IMAGES:
                    return await this.processImagesStage(project, profile);
                case PipelineStage.VIDEO:
                    return await this.processVideoStage(project, profile);
                default:
                    console.log(`No auto-process defined for stage ${project.currentStage}`);
                    await this.projectService.updateProject(project.id, { status: "ready" });
                    break;
            }
        } catch (error: any) {
            console.error(`Pipeline execution failed for project ${project.id}:`, error);

            let detailedError = String(error);
            if (error instanceof Error) {
                // Se for um erro padrão do JS, tenta pegar a stack mas limpa para não ficar gigante
                detailedError = `${error.message}${error.stack ? `\n\nStack Trace:\n${error.stack.split('\n').slice(0, 5).join('\n')}` : ''}`;
            } else if (typeof error === 'object' && error !== null) {
                try {
                    detailedError = JSON.stringify(error, null, 2);
                } catch {
                    detailedError = String(error);
                }
            }

            const finalMessage = `Erro no estágio ${project.currentStage}: ${detailedError}`;

            await this.projectService.updateProject(project.id, {
                status: "error",
                errorMessage: finalMessage,
            });
        }
    }

    // --- STAGE HANDLERS ---

    private async processReferenceStage(
        project: VideoProject,
        config: EngineConfig
    ): Promise<VideoProject> {
        const referenceData = project.stageData.reference;
        if (!referenceData) throw new Error("Dados de referência ausentes");

        let transcript = referenceData.transcript?.trim() || '';

        if (!transcript) {
            const apifyKey = config.apiKeys.apify;
            if (!apifyKey) {
                throw new Error("Token da APIFY não configurado. Vá em Configurações e preencha o campo APIFY.");
            }

            console.log(`[Pipeline] 🎯 Transcrevendo vídeo ${referenceData.videoId} via APIFY...`);
            const { transcribeVideo } = await import("../lib/youtubeMock");
            const result = await transcribeVideo(referenceData.videoId, apifyKey);
            transcript = result.transcript?.trim() || '';
            const apifyMetadata = result.metadata;
            console.log(`[Pipeline] 📝 APIFY retornou transcript com ${transcript.length} chars`);
            console.log(`[Pipeline] 📦 APIFY metadata keys:`, apifyMetadata ? Object.keys(apifyMetadata) : 'NENHUM');

            if (transcript) {
                const enrichedReference = {
                    ...referenceData,
                    transcript,
                    description: apifyMetadata?.description || referenceData.description,
                    viewCount: apifyMetadata?.viewCount || referenceData.viewCount,
                    duration: apifyMetadata?.duration || referenceData.duration,
                    apifyRawData: apifyMetadata || undefined,
                };

                // CRÍTICO: Atualiza o objeto em memória para que saves subsequentes não sobrescrevam com dados antigos
                project.stageData.reference = enrichedReference;

                console.log(`[Pipeline] 💾 Salvando reference enriquecida no Supabase...`);
                await this.projectService.updateProject(project.id, {
                    stageData: {
                        ...project.stageData,
                        reference: enrichedReference
                    }
                });
            }
        }

        if (!transcript) {
            throw new Error("Transcrição não encontrada. O vídeo pode não ter legendas habilitadas, ou o ator APIFY retornou vazio.");
        }

        console.log(`[Pipeline] ✅ Transcrição obtida. Definindo status para 'review'...`);

        // Agora o project.stageData.reference já está atualizado (enriquecido)
        await this.projectService.updateProject(project.id, {
            status: 'review',
            stageData: project.stageData
        });

        return {
            ...project,
            status: 'review',
            stageData: { ...project.stageData, reference: project.stageData.reference }
        };
    }

    /**
     * ROTEIRO → próximo estágio
     * Pipeline de 2 prompts:
     *   P1 (Reescrita Magnética) → P2 (Estruturação Viral)
     * Grava ScriptGenerationSnapshot imutável no vídeo.
     */
    private async processScriptStage(
        project: VideoProject,
        profile: ChannelProfile,
        config: EngineConfig
    ): Promise<VideoProject> {
        const referenceData = project.stageData.reference;
        const transcript = referenceData?.transcript;

        if (!transcript) {
            throw new Error("Transcrição de referência não encontrada. Volte ao estágio Referência.");
        }

        // Resolve model: channel-specific or global fallback
        const modelId = profile.scriptingModel || config.scriptingModel || 'gemini-1.5-flash';
        const provider = profile.scriptingProvider || config.scriptingProvider || config.providers.scripting || 'GEMINI';

        // Load active ChannelPrompt
        let rewritePrompt = '';
        let structurePrompt = '';
        let promptVersionId = '';

        if (profile.activePromptId) {
            try {
                const prompts = await this.persistence.loadChannelPrompts(profile.id);
                const active = prompts.find(p => p.id === profile.activePromptId);
                if (active) {
                    rewritePrompt = active.promptText;
                    structurePrompt = active.structurePromptText || '';
                    promptVersionId = active.id;
                    console.log(`[Pipeline] Usando ChannelPrompt ativo: ${active.id}`);
                }
            } catch (e) {
                console.warn('[Pipeline] Erro ao carregar ChannelPrompt, usando defaults:', e);
            }
        }

        // P1 — Reescrita Magnética
        console.log(`[Pipeline] ====== P1 — Reescrita via ${provider}/${modelId} ======`);

        // Monta prompts para preview
        const isCustomP1 = !!rewritePrompt;
        const p1SystemPrompt = rewritePrompt || `Você é um reescritor profissional de roteiros para YouTube.
Reescreva o texto mantendo a essência mas tornando-o mais magnético e envolvente.
REGRAS:
- Manter o mesmo tamanho aproximado
- Otimizar para TTS (sem emojis, sem URLs, sem caracteres especiais)
- Português do Brasil

SAÍDA (JSON STRICT):
{ "text": "texto reescrito completo...", "caracteres": 1234 }`;
        const p1UserPrompt = `TRANSCRIÇÃO ORIGINAL:\n\n${transcript}`;

        // DEBUG: Preview antes de enviar P1
        if (this.onPromptPreview) {
            const proceed = await this.onPromptPreview({
                stage: 'P1',
                stageLabel: 'Reescrita Magnética',
                modelId,
                provider,
                isCustomPrompt: isCustomP1,
                systemPrompt: p1SystemPrompt,
                userPrompt: p1UserPrompt,
                inputLength: transcript.length,
            });
            if (!proceed) {
                await this.projectService.updateProject(project.id, { status: 'ready' });
                throw new Error('Pipeline cancelado pelo usuário no debug P1');
            }
        }

        const p1Result = await rewriteTranscript(transcript, rewritePrompt, modelId, provider, config);
        console.log(`[Pipeline] P1 concluído: ${p1Result.caracteres} caracteres`);

        // P2 — Estruturação Viral
        console.log(`[Pipeline] ====== P2 — Estruturação via ${provider}/${modelId} ======`);

        const isCustomP2 = !!structurePrompt;
        const p2SystemPrompt = structurePrompt || `Você é um especialista em YouTube SEO e viralização.
Dado o roteiro abaixo, gere os metadados para um vídeo viral.

SAÍDA (JSON STRICT):
{
  "title": "Título viral (máx 60 chars)",
  "description": "Descrição SEO completa...",
  "thumb_text": "TEXTO THUMBNAIL (máx 6 palavras, CAPS)",
  "tags": ["tag1", "tag2", ...]
}`;
        const p2UserPrompt = `ROTEIRO:\n\n${p1Result.text}`;

        // DEBUG: Preview antes de enviar P2
        if (this.onPromptPreview) {
            const proceed = await this.onPromptPreview({
                stage: 'P2',
                stageLabel: 'Estruturação Viral (SEO)',
                modelId,
                provider,
                isCustomPrompt: isCustomP2,
                systemPrompt: p2SystemPrompt,
                userPrompt: p2UserPrompt,
                inputLength: p1Result.text.length,
            });
            if (!proceed) {
                await this.projectService.updateProject(project.id, { status: 'ready' });
                throw new Error('Pipeline cancelado pelo usuário no debug P2');
            }
        }

        const p2Result = await structureScript(p1Result.text, structurePrompt, modelId, provider, config);
        console.log(`[Pipeline] P2 concluído: title="${p2Result.title}"`);

        // Create immutable snapshot
        const snapshot: ScriptGenerationSnapshot = {
            modelId,
            modelProvider: provider,
            rewritePromptText: rewritePrompt,
            structurePromptText: structurePrompt,
            promptVersionId,
            generatedAt: new Date().toISOString(),
        };

        const scriptData: StageDataMap['script'] = {
            text: p1Result.text,
            wordCount: p1Result.text.split(/\s+/).length,
            promptUsed: promptVersionId || 'default',
            title: p2Result.title,
            description: p2Result.description,
            thumbText: p2Result.thumb_text,
            tags: p2Result.tags,
            generationSnapshot: snapshot,
            mode: 'auto'
        };

        console.log(`[Pipeline] 💾 Salvando roteiro no Supabase...`);
        console.log(`[Pipeline]   → text: ${scriptData.text.length} chars`);
        console.log(`[Pipeline]   → title: "${scriptData.title}"`);
        console.log(`[Pipeline]   → tags: ${scriptData.tags?.length || 0}`);
        console.log(`[Pipeline]   → snapshot.model: ${snapshot.modelId}`);
        console.log(`[Pipeline]   → snapshot.promptVersionId: ${snapshot.promptVersionId || '(default)'}`);

        const result = await this.projectService.advanceStage(project, { script: scriptData });
        console.log(`[Pipeline] ✅ Roteiro salvo e avançado para estágio: ${result.currentStage}`);
        return result;
    }

    /**
     * ÁUDIO — Geração TTS
     * 1. Lê o roteiro do P1 (script.text)
     * 2. Usa a voz configurada no perfil do canal
     * 3. Gera via Gemini TTS com retry
     * 4. Converte base64 PCM → WAV
     * 5. Calcula duração e avança estágio
     */
    private async processAudioStage(
        project: VideoProject,
        profile: ChannelProfile,
        config: EngineConfig
    ): Promise<VideoProject> {
        const scriptData = project.stageData.script;
        if (!scriptData?.text) {
            throw new Error("Roteiro não encontrado. Volte ao estágio Roteiro e processe novamente.");
        }

        const voiceId = profile.voiceProfile || 'Kore';
        console.log(`[Pipeline] ====== ÁUDIO — TTS com voz ${voiceId} ======`);
        console.log(`[Pipeline] Texto: ${scriptData.text.length} caracteres, ~${scriptData.wordCount} palavras`);

        // Gerar áudio via Gemini TTS (com retry automático)
        const base64Pcm = await generateSpeech(scriptData.text, voiceId, config);
        if (!base64Pcm) {
            throw new Error("Falha na geração de áudio: resposta vazia do TTS.");
        }

        // Converter para WAV blob URL (para calcular duração)
        const blobUrl = pcmToWav(base64Pcm);

        // Calcular duração do áudio
        let duration: number | undefined;
        try {
            duration = await getAudioDuration(blobUrl);
            console.log(`[Pipeline] ✅ Áudio gerado: ${duration.toFixed(1)}s de duração`);
        } catch (e) {
            console.warn('[Pipeline] Não foi possível calcular duração do áudio:', e);
        }

        // Converter PCM para WAV Uint8Array e salvar no disco
        const binaryString = atob(base64Pcm);
        const pcmBytes = new Uint8Array(binaryString.length);
        for (let i = 0; i < binaryString.length; i++) {
            pcmBytes[i] = binaryString.charCodeAt(i);
        }
        // Reutilizamos a lógica de header WAV do pcmToWav, mas precisamos do Uint8Array raw
        // Para simplificar, vamos buscar o blob do blobUrl e salvar
        const blobResponse = await fetch(blobUrl);
        const wavArrayBuffer = await blobResponse.arrayBuffer();
        const wavData = new Uint8Array(wavArrayBuffer);
        await saveAudio(project.id, wavData);
        console.log(`[Pipeline] 💾 Áudio salvo no disco (${(wavData.length / 1024).toFixed(0)} KB)`);

        const audioData: StageDataMap['audio'] = {
            fileUrl: `disk://${project.id}`,
            duration,
            provider: config.providers.tts || 'GEMINI',
            mode: 'auto',
        };

        return await this.projectService.advanceStage(project, { audio: audioData });
    }

    /**
     * COMPACTAR ÁUDIO — FFmpeg WAV → MP3
     * 1. Valida FFmpeg instalado
     * 2. Lê WAV do disco
     * 3. Comprime via FFmpeg (temp files no disco)
     * 4. Salva MP3 no disco
     * 5. Avança para estágio SUBTITLES
     * 
     * ⚠️ Usa temp files para evitar problemas com WAV grandes em memória
     */
    private async processAudioCompressStage(
        project: VideoProject
    ): Promise<VideoProject> {
        console.log(`[Pipeline] ====== COMPRESSÃO DE ÁUDIO — FFmpeg ======`);

        const result = await compressProjectAudio(project.id, (msg) => {
            console.log(`[Pipeline] ${msg}`);
        });

        const compressData: StageDataMap['audio_compress'] = {
            fileUrl: `disk://${result.compressedKey}`,
            originalSize: result.originalSize,
            compressedSize: result.compressedSize,
            compressionRatio: result.compressionRatio,
            format: result.format,
            bitrate: result.bitrate,
            duration: project.stageData.audio?.duration,
            mode: 'auto',
        };

        console.log(`[Pipeline] ✅ Compressão concluída: ${result.compressionRatio}% redução`);
        return await this.projectService.advanceStage(project, { audio_compress: compressData });
    }

    /**
     * LEGENDAS — Storyboard + ASS
     * 1. Lê roteiro (P1) e duração do áudio
     * 2. Divide em segmentos de 9-18s (smartChunker)
     * 3. Alinha tempos com duração real do áudio (alignmentEngine)
     * 4. Gera conteúdo .ass estilizado (subtitleGenerator)
     * 5. Salva dados e avança para estágio IMAGES
     */
    private async processSubtitlesStage(
        project: VideoProject,
        profile: ChannelProfile
    ): Promise<VideoProject> {
        console.log(`[Pipeline] ====== LEGENDAS — Storyboard + ASS ======`);

        // 1. Obter roteiro
        const scriptData = project.stageData.script;
        if (!scriptData?.text) {
            throw new Error("Roteiro não encontrado. Volte ao estágio Roteiro e processe novamente.");
        }

        // 2. Obter duração do áudio (preferência: audio_compress > audio)
        const audioDuration = project.stageData.audio_compress?.duration
            || project.stageData.audio?.duration;

        if (!audioDuration || audioDuration <= 0) {
            throw new Error(
                "Duração do áudio não encontrada. Verifique se os estágios de Áudio e Compressão foram concluídos corretamente."
            );
        }

        console.log(`[Pipeline] 📝 Roteiro: ${scriptData.text.length} chars, ~${scriptData.wordCount} palavras`);
        console.log(`[Pipeline] ⏱️ Duração total do áudio: ${audioDuration.toFixed(1)}s`);

        // 3. Dividir em segmentos (smart chunking)
        const chunks = smartChunkScript(scriptData.text);
        console.log(`[Pipeline] 🧩 Smart Chunker: ${chunks.length} segmentos criados`);

        // 4. Converter chunks para StoryboardSegments
        const rawSegments: StoryboardSegment[] = chunks.map(chunk => ({
            id: chunk.id,
            timeRange: '',
            scriptText: chunk.text,
            visualPrompt: '',
            duration: 0,
        }));

        // 5. Alinhar com duração real do áudio
        const alignedSegments = alignStoryboardToAudio(rawSegments, audioDuration);
        console.log(`[Pipeline] 🎯 Segmentos alinhados com áudio (${audioDuration.toFixed(1)}s total)`);

        alignedSegments.forEach(seg => {
            console.log(`[Pipeline]   Segmento ${seg.id}: ${seg.timeRange} (${seg.duration.toFixed(1)}s) — ${seg.scriptText.substring(0, 50)}...`);
        });

        // 6. Gerar conteúdo ASS
        const assContent = generateAssContent(alignedSegments, profile);
        console.log(`[Pipeline] 📄 Conteúdo ASS gerado: ${assContent.length} chars`);

        // 7. Salvar e avançar
        const subtitlesData: StageDataMap['subtitles'] = {
            srtContent: '',
            assContent,
            segments: alignedSegments,
            segmentCount: alignedSegments.length,
            totalDuration: audioDuration,
            wordCount: scriptData.wordCount,
            mode: 'auto',
        };

        console.log(`[Pipeline] ✅ Legendas geradas: ${alignedSegments.length} segmentos, ${audioDuration.toFixed(1)}s`);
        return await this.projectService.advanceStage(project, { subtitles: subtitlesData });
    }

    /**
     * IMAGENS — Agrupamento de Cenas e Prompts
     * 1. Lê os segmentos gerados no estágio SUBTITLES
     * 2. Usa o StoryboardPlanner para agrupar em cenas e gerar visualPrompts
     * 3. Atualiza os segmentos no projeto
     * 4. Define status para 'review' para o usuário revisar os prompts
     */
    private async processImagesStage(
        project: VideoProject,
        profile: ChannelProfile
    ): Promise<VideoProject> {
        console.log(`[Pipeline] ====== IMAGENS — Agrupamento de Cenas ======`);

        const subtitleData = project.stageData.subtitles;
        if (!subtitleData?.segments || subtitleData.segments.length === 0) {
            throw new Error("Segmentos do storyboard não encontrados. Volte ao estágio Legendas.");
        }

        const config = this.getConfig();

        // 1. Planejar o storyboard (agrupar cenas + prompts)
        // Por padrão, usa o OpenRouter se o usuário não definiu um modelo de roteirização específico que tenha fallback
        const updatedSegments = await planStoryboard(subtitleData.segments, profile, config);

        // 2. Atualizar o estágio de legendas com os novos segmentos (agora com visualPrompt)
        const updatedSubtitleData = {
            ...subtitleData,
            segments: updatedSegments
        };

        // 3. Atualizar o projeto e aguardar revisão
        await this.projectService.updateProject(project.id, {
            status: 'review',
            stageData: {
                ...project.stageData,
                subtitles: updatedSubtitleData
            }
        });

        console.log(`[Pipeline] ✅ Agrupamento de cenas concluído. Status definido para 'review'.`);

        return {
            ...project,
            status: 'review',
            stageData: {
                ...project.stageData,
                subtitles: updatedSubtitleData
            }
        };
    }

    /**
     * VÍDEO — Renderização FFmpeg
     * 1. Valida que todos os assets estão presentes
     * 2. Chama VideoRenderService para renderizar
     * 3. Reporta progresso via logs
     * 4. Salva resultado em VideoStageData e avança para PUBLISH_YT
     */
    private async processVideoStage(
        project: VideoProject,
        profile: ChannelProfile
    ): Promise<VideoProject> {
        console.log(`[Pipeline] ====== VÍDEO — Renderização FFmpeg ======`);

        const result = await renderProjectVideo(
            project,
            profile,
            (progress) => {
                console.log(`[Pipeline] [${progress.phase}] ${progress.message}`);
            }
        );

        const videoData: StageDataMap['video'] = {
            fileUrl: result.outputPath,
            resolution: result.resolution,
            duration: result.duration,
            mode: 'auto',
        };

        console.log(`[Pipeline] ✅ Vídeo renderizado: ${result.duration.toFixed(1)}s, ${(result.fileSize / 1024 / 1024).toFixed(1)} MB`);
        console.log(`[Pipeline]   → Arquivo: ${result.outputPath}`);
        return await this.projectService.advanceStage(project, { video: videoData });
    }
}
