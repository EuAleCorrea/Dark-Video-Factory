
import { VideoProject, PipelineStage, EngineConfig, VideoFormat, ScriptGenerationSnapshot } from "../types";
import { ProjectService } from "./ProjectService";
import { generateVideoScriptAndPrompts, rewriteTranscript, structureScript, generateSpeech, generateVisualPromptsForSegments } from "./geminiService";
import { PersistenceService } from "./PersistenceService";
import { ChannelProfile, StageDataMap } from "../types";
import { pcmToWav, getAudioDuration } from "../lib/audioUtils";
import { saveAudio, saveSceneAudio, mergeProjectAudio } from "./AudioStorageService";
import { saveSceneImage } from "./ImageStorageService";
import { getImageProvider, IMAGE_MODELS } from "./imageProviders";
import { compressProjectAudio } from "./AudioCompressService";
import { smartChunkScript } from "../lib/smartChunker";
import { alignStoryboardToAudio } from "../lib/alignmentEngine";
import { generateAssContent } from "../lib/subtitleGenerator";
import { StoryboardSegment } from "../types";
import { planStoryboard } from "./storyboardPlanner";
import { renderProjectVideo } from "./VideoRenderService";
import { ElevenLabsService } from "./ElevenLabsService";

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
    private onProgress: ((projectId: string, message: string, stageData?: Record<string, any>) => void) | null = null;

    constructor(
        private projectService: ProjectService,
        private persistence: PersistenceService,
        private getConfig: () => EngineConfig,
        private getProfile: (channelId: string) => ChannelProfile | undefined
    ) { }

    /** Registra callback para atualizar progresso na UI */
    setProgressCallback(cb: ((projectId: string, message: string, stageData?: Record<string, any>) => void) | null) {
        this.onProgress = cb;
    }

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
                case PipelineStage.SCENES:
                    return await this.processScenesStage(project, profile, config);
                case PipelineStage.AUDIO:
                    return await this.processAudioStage(project, profile, config);
                case PipelineStage.AUDIO_COMPRESS:
                    // Estágio removido/obsoleto. Avança direto para o próximo disponível (SUBTITLES).
                    console.log("[Pipeline] Estágio AUDIO_COMPRESS detectado. Pulando para SUBTITLES...");
                    return await this.projectService.advanceStage(project, {});
                case PipelineStage.SUBTITLES:
                    return await this.processSubtitlesStage(project, profile);
                case PipelineStage.IMAGES:
                    // Estágio removido/obsoleto. Avança direto para o próximo disponível (VÍDEO).
                    console.log("[Pipeline] Estágio IMAGES detectado. Pulando para VÍDEO...");
                    return await this.projectService.advanceStage(project, {});
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

            // Re-throw para que o App.tsx capture e atualize o React state
            throw new Error(finalMessage);
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
     * CENAS — Divisão do roteiro longo em blocos e criação de prompts independentes
     */
    private async processScenesStage(
        project: VideoProject,
        profile: ChannelProfile,
        config: EngineConfig
    ): Promise<VideoProject> {
        console.log(`[Pipeline] ====== CENAS — Chunking & Visual Prompts ======`);

        const scriptData = project.stageData.script;
        if (!scriptData?.text) {
            throw new Error("Roteiro não encontrado no estágio inicial. Volte e processe o roteiro.");
        }

        const wordsPerScene = config.sceneConfig?.wordsPerScene || 250;
        const maxScenes = config.sceneConfig?.maxScenes || 15;

        // 1. Chunking
        const chunks = smartChunkScript(scriptData.text, wordsPerScene, maxScenes);
        console.log(`[Pipeline] Roteiro dividido em ${chunks.length} cenas configuradas.`);

        // 2. Setup initial scenes
        const initialScenesData = chunks.map(chunk => ({
            id: chunk.id,
            scriptText: chunk.text,
            visualPrompt: '',
            status: 'pending' as const
        }));

        // 3. Generate prompts via IA
        const visualStyle = profile.visualStyle || "cinematic, 8k, detailed, photorealistic";
        const modelId = profile.scriptingModel || config.scriptingModel || 'gemini-2.0-flash-exp';
        const provider = (profile.scriptingProvider || config.scriptingProvider || 'GEMINI') as 'GEMINI' | 'OPENAI' | 'OPENROUTER';

        console.log(`[Pipeline] Gerando prompts visuais com IA (${provider}/${modelId})...`);

        const visualPromptsRaw = await generateVisualPromptsForSegments(
            initialScenesData.map(s => ({ id: s.id, scriptText: s.scriptText })),
            visualStyle,
            modelId,
            provider,
            config
        );

        // 4. Consolidar os dados
        const finalScenes = initialScenesData.map(scene => {
            const promptObj = visualPromptsRaw.find(p => p.id === scene.id);
            return {
                ...scene,
                visualPrompt: promptObj ? promptObj.visualPrompt : "Cinematic scene, detailed atmosphere"
            };
        });

        const scenesData = {
            scenes: finalScenes,
            mode: 'auto' as const
        };

        // 5. Update Project Stage Data e advance
        console.log(`[Pipeline] ✅ Cenas geradas com sucesso. Avançando de Cenas para Áudio...`);
        return await this.projectService.advanceStage(project, { scenes: scenesData });
    }

    /**
     * ÁUDIO — Processa uma ÚNICA cena individualmente
     * Isso permite que a UI gere o áudio de uma cena sob demanda
     */
    public async processSingleSceneAudio(
        project: VideoProject,
        sceneId: number,
        profile: ChannelProfile,
        config: EngineConfig,
        audioOverride?: { provider: 'google' | 'elevenlabs', voiceId: string }
    ): Promise<VideoProject> {
        const provider = audioOverride?.provider || config.providers.tts || 'google';
        const voiceId = audioOverride?.voiceId || profile.voiceProfile || 'Kore';
        const scenesData = project.stageData.scenes;

        if (!scenesData?.scenes || scenesData.scenes.length === 0) {
            throw new Error(`Dados de cena estruturada não encontrados para a cena ${sceneId}.`);
        }

        const sceneIndex = scenesData.scenes.findIndex(s => s.id === sceneId);
        if (sceneIndex === -1) {
            throw new Error(`Cena com ID ${sceneId} não encontrada no projeto.`);
        }

        const scene = scenesData.scenes[sceneIndex];
        const updatedScenes = [...scenesData.scenes];

        console.log(`[Pipeline] ====== ÁUDIO — TTS por Cena Única (ID: ${scene.id}, Provider: ${provider}, Voz: ${voiceId}) ======`);

        // Atualizar status na memória/UI temporariamente
        updatedScenes[sceneIndex] = { ...scene, status: 'generating' };
        if (this.onProgress) {
            this.onProgress(project.id, `Gerando áudio da Cena ${sceneId}`, {
                ...project.stageData,
                scenes: { ...scenesData, scenes: updatedScenes }
            });
        }

        try {
            let wavData: Uint8Array;
            let duration: number | undefined;

            if (provider === 'elevenlabs') {
                const apiKey = config.apiKeys.elevenLabs;
                if (!apiKey) throw new Error("API Key do ElevenLabs não configurada.");
                
                const elevenService = new ElevenLabsService(apiKey);
                const blob = await elevenService.generateAudio(
                    voiceId, 
                    scene.scriptText, 
                    'eleven_multilingual_v2'
                );
                
                wavData = new Uint8Array(await blob.arrayBuffer());
                const blobUrl = URL.createObjectURL(blob);
                try {
                    duration = await getAudioDuration(blobUrl);
                    console.log(`[Pipeline]   ✅ ElevenLabs: ${duration.toFixed(1)}s de duração`);
                } catch (e) {
                    console.warn(`[Pipeline]   ⚠️ Duração não calculada para cena ${scene.id}`);
                }
            } else {
                // Google TTS fallback/padrão
                const base64Pcm = await generateSpeech(scene.scriptText, voiceId, config);
                if (!base64Pcm) {
                    throw new Error(`Resposta vazia do TTS para cena ${scene.id}`);
                }

                const blobUrl = pcmToWav(base64Pcm);
                try {
                    duration = await getAudioDuration(blobUrl);
                    console.log(`[Pipeline]   ✅ Google TTS: ${duration.toFixed(1)}s de duração`);
                } catch (e) {
                    console.warn(`[Pipeline]   ⚠️ Duração não calculada para cena ${scene.id}`);
                }

                const blobResponse = await fetch(blobUrl);
                wavData = new Uint8Array(await blobResponse.arrayBuffer());
            }

            await saveSceneAudio(project.id, scene.id, wavData);

            updatedScenes[sceneIndex] = {
                ...scene,
                audioUrl: `disk://${project.id}/scenes/scene_${scene.id}.wav`,
                audioDuration: duration,
                status: 'done'
            };

            const updatedProject = {
                ...project,
                stageData: {
                    ...project.stageData,
                    scenes: { ...scenesData, scenes: updatedScenes }
                }
            };

            // Salva silenciosamente o projeto atualizado no banco, SEM AVANÇAR o stageData inteiro
            await this.projectService.updateProject(project.id, { stageData: updatedProject.stageData });

            // Atualiza a cena como 'done' na UI
            if (this.onProgress) {
                this.onProgress(project.id, `Cena ${sceneId} concluída`, updatedProject.stageData);
            }

            return updatedProject;
        } catch (err: any) {
            console.error(`[Pipeline]   ❌ Falha na cena ${scene.id}:`, err.message);
            updatedScenes[sceneIndex] = { ...scene, status: 'error' };

            // Restaura estado de erro para a UI
            if (this.onProgress) {
                this.onProgress(project.id, `Erro na Cena ${sceneId}`, {
                    ...project.stageData,
                    scenes: { ...scenesData, scenes: updatedScenes }
                });
            }

            throw err;
        }
    }

    /**
     * IMAGENS — Processa uma ÚNICA imagem de cena
     */
    public async processSingleSceneImage(
        project: VideoProject,
        sceneId: number,
        profile: ChannelProfile,
        config: EngineConfig,
        imageOverride?: { modelId: string }
    ): Promise<VideoProject> {
        const scenesData = project.stageData.scenes;
        if (!scenesData?.scenes) throw new Error("Cenas não encontradas.");

        const modelId = imageOverride?.modelId || config.providers.image || 'FLUX';
        const sceneIndex = scenesData.scenes.findIndex(s => s.id === sceneId);
        if (sceneIndex === -1) throw new Error(`Cena ${sceneId} não encontrada.`);

        const scene = scenesData.scenes[sceneIndex];
        const updatedScenes = [...scenesData.scenes];

        console.log(`[Pipeline] ====== IMAGENS — Geração por Cena Única (ID: ${scene.id}, Modelo: ${modelId}) ======`);

        updatedScenes[sceneIndex] = { ...scene, status: 'generating' };
        if (this.onProgress) {
            this.onProgress(project.id, `Gerando imagem da Cena ${sceneId}`, {
                ...project.stageData,
                scenes: { ...scenesData, scenes: updatedScenes }
            });
        }

        try {
            const provider = getImageProvider(modelId);
            const modelInfo = (IMAGE_MODELS as any[]).find(m => m.id === modelId);
            const apiKey = config.apiKeys[modelInfo?.apiKeyField as keyof EngineConfig['apiKeys'] || 'flux'];
            
            if (!apiKey) throw new Error(`Chave de API para o modelo ${modelId} não configurada.`);

            // Resolução baseada no formato do projeto (VideoFormat)
            let width = 1024;
            let height = 1024;
            if (profile.format === VideoFormat.LONG_FORM) {
                width = 1792; height = 1024;
            } else if (profile.format === VideoFormat.SHORTS) {
                width = 1024; height = 1792;
            }

            const result = await provider.generate(scene.visualPrompt, width, height, 1, apiKey);
            if (!result.urls || result.urls.length === 0) {
                throw new Error("Nenhuma imagem gerada pelo provider.");
            }

            const imageUrl = result.urls[0];
            await saveSceneImage(project.id, scene.id, imageUrl);

            updatedScenes[sceneIndex] = {
                ...scene,
                imageUrl: `disk://${project.id}/scenes/scene_${scene.id}.png`,
                status: 'done'
            };

            const updatedProject = {
                ...project,
                stageData: {
                    ...project.stageData,
                    scenes: { ...scenesData, scenes: updatedScenes }
                }
            };

            await this.projectService.updateProject(project.id, { stageData: updatedProject.stageData });

            if (this.onProgress) {
                this.onProgress(project.id, `Cena ${sceneId} (Imagem) concluída`, updatedProject.stageData);
            }

            return updatedProject;
        } catch (err: any) {
            console.error(`[Pipeline]   ❌ Falha na imagem da cena ${scene.id}:`, err.message);
            updatedScenes[sceneIndex] = { ...scene, status: 'error' };
            if (this.onProgress) {
                this.onProgress(project.id, `Erro na Imagem da Cena ${sceneId}`, {
                    ...project.stageData,
                    scenes: { ...scenesData, scenes: updatedScenes }
                });
            }
            throw err;
        }
    }

    /**
     * ÁUDIO — Geração TTS (por cena ou roteiro completo)
     * Se cenas existem: gera áudio individualmente por cena (~250 palavras)
     * Se não: fallback para roteiro inteiro (legado)
     */
    private async processAudioStage(
        project: VideoProject,
        profile: ChannelProfile,
        config: EngineConfig
    ): Promise<VideoProject> {
        const voiceId = profile.voiceProfile || 'Kore';
        const scenesData = project.stageData.scenes;
        console.log(`[Pipeline] 🔍 stageData.scenes encontrado: ${scenesData?.scenes?.length || 0} cenas`);

        // ══════════════════════════════════════════════
        // MODO CENAS: Gerar áudio individualmente por cena
        // ══════════════════════════════════════════════
        if (scenesData?.scenes && scenesData.scenes.length > 0) {
            const scenes = scenesData.scenes;
            console.log(`[Pipeline] ====== ÁUDIO — TTS por Cena (${scenes.length} cenas, voz: ${voiceId}) ======`);

            const updatedScenes = [...scenes];
            let totalDuration = 0;

            for (let i = 0; i < updatedScenes.length; i++) {
                const scene = updatedScenes[i];
                const wordCount = scene.scriptText.split(/\s+/).length;
                console.log(`[Pipeline] 🎙️ Cena ${scene.id}/${scenes.length} (${wordCount} palavras)...`);

                // Atualizar progresso na UI via callback
                updatedScenes[i] = { ...scene, status: 'generating' };
                const progressMsg = `Áudio ${i + 1}/${scenes.length}`;
                if (this.onProgress) {
                    this.onProgress(project.id, progressMsg, {
                        ...project.stageData,
                        scenes: { ...scenesData, scenes: updatedScenes }
                    });
                }
                
                await this.projectService.updateProject(project.id, {
                    errorMessage: progressMsg
                }).catch(() => {});

                // Delay entre cenas para evitar rate limit do TTS (429)
                if (i > 0) {
                    console.log(`[Pipeline]   ⏳ Aguardando 3s (rate limit)...`);
                    await new Promise(r => setTimeout(r, 3000));
                }

                try {
                    const base64Pcm = await generateSpeech(scene.scriptText, voiceId, config);
                    if (!base64Pcm) {
                        throw new Error(`Resposta vazia do TTS para cena ${scene.id}`);
                    }

                    const blobUrl = pcmToWav(base64Pcm);
                    let duration: number | undefined;
                    try {
                        duration = await getAudioDuration(blobUrl);
                        totalDuration += duration || 0;
                        console.log(`[Pipeline]   ✅ ${duration.toFixed(1)}s de duração`);
                    } catch (e) {
                        console.warn(`[Pipeline]   ⚠️ Duração não calculada para cena ${scene.id}`);
                    }

                    // Salvar áudio da cena no disco
                    const blobResponse = await fetch(blobUrl);
                    const wavData = new Uint8Array(await blobResponse.arrayBuffer());
                    await saveSceneAudio(project.id, scene.id, wavData);

                    updatedScenes[i] = {
                        ...scene,
                        audioUrl: `disk://${project.id}/scenes/scene_${scene.id}.wav`,
                        audioDuration: duration,
                        status: 'done'
                    };

                    // Atualiza a cena como 'done' na UI
                    if (this.onProgress) {
                        this.onProgress(project.id, progressMsg, {
                            ...project.stageData,
                            scenes: { ...scenesData, scenes: updatedScenes }
                        });
                    }
                } catch (err: any) {
                    console.error(`[Pipeline]   ❌ Falha na cena ${scene.id}:`, err.message);
                    updatedScenes[i] = { ...scene, status: 'error' };
                    throw new Error(`Falha no TTS para cena ${scene.id}: ${err.message}`);
                }
            }

            console.log(`[Pipeline] ✅ Todos os ${scenes.length} áudios gerados. Duração total: ${totalDuration.toFixed(1)}s`);

            // ══════════════════════════════════════════════
            // NOVO: Consolidar áudios individuais em um mestre
            // ══════════════════════════════════════════════
            console.log(`[Pipeline] 🔀 Consolidando áudios das cenas em um único arquivo mestre...`);
            try {
                await mergeProjectAudio(project.id);
            } catch (mergeErr: any) {
                console.warn(`[Pipeline] ⚠️ Falha na consolidação de áudio: ${mergeErr.message}. A próxima etapa pode falhar.`);
            }

            // ══════════════════════════════════════════════
            // NOVO: Compactar Áudio Automaticamente
            // ══════════════════════════════════════════════
            console.log(`[Pipeline] ⚙️ Iniciando compactação automática para MP3...`);
            let compressData: any = undefined;
            try {
                const result = await compressProjectAudio(project.id, (msg) => {
                    console.log(`[Pipeline] [Compress] ${msg}`);
                });
                compressData = {
                    fileUrl: `disk://${result.compressedKey}`,
                    originalSize: result.originalSize,
                    compressedSize: result.compressedSize,
                    compressionRatio: result.compressionRatio,
                    format: result.format,
                    bitrate: result.bitrate,
                    duration: totalDuration,
                    mode: 'auto',
                };
                console.log(`[Pipeline] ✅ Compactação concluída: ${result.compressionRatio}% redução`);
            } catch (err: any) {
                console.warn(`[Pipeline] ⚠️ Falha na compactação automática: ${err.message}. Continuando com áudio raw.`);
            }

            // Limpar mensagem de progresso
            await this.projectService.updateProject(project.id, { errorMessage: '' });

            // Salvar cenas atualizadas + dados de áudio + compressão e avançar PARA LEGENDAS
            const audioData: StageDataMap['audio'] = {
                fileUrl: `disk://${project.id}/scenes`,
                duration: totalDuration,
                provider: config.providers.tts || 'GEMINI',
                mode: 'auto',
            };

            return await this.projectService.advanceStage(project, {
                scenes: { ...scenesData, scenes: updatedScenes },
                audio: audioData,
                audio_compress: compressData
            });
        }

        // Se chegou até aqui, é porque nenhuma cena existia para gerar os áudios individuais.
        // O modo de legacy (roteiro todo num único wav) FOI REMOVIDO para este projeto.
        throw new Error("Nenhum dado de cena estruturada encontrado (stageData.scenes vazio / indefinido). Para gerar áudio sincronizado corretamente, por favor VOLTE ao estágio de Cenas e processe novamente antes de avançar para Áudio.");
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

        // 4. Converter chunks para StoryboardSegments e mapear para Cena correspondente
        const scenes = project.stageData.scenes?.scenes || [];
        const alignedSegments: StoryboardSegment[] = chunks.map(chunk => {
            // Tenta encontrar a cena que contém o início do texto deste chunk
            // Como ambos são extraídos do mesmo script original, a ordem deve bater.
            // Simplified: Encontra cena cujo texto contém este fragmento ou vice-versa.
            const matchingScene = scenes.find(s => 
                s.scriptText.includes(chunk.text.substring(0, 30)) || 
                chunk.text.includes(s.scriptText.substring(0, 30))
            );

            return {
                id: chunk.id,
                sceneId: matchingScene?.id,
                timeRange: '',
                scriptText: chunk.text,
                visualPrompt: matchingScene?.visualPrompt || '',
                duration: 0,
                assets: {
                    imageUrl: matchingScene?.imageUrl || ''
                }
            };
        });

        // 5. Alinhar com duração real do áudio
        const finalSegments = alignStoryboardToAudio(alignedSegments, audioDuration);
        console.log(`[Pipeline] 🎯 Segmentos alinhados com áudio (${audioDuration.toFixed(1)}s total)`);

        alignedSegments.forEach(seg => {
            console.log(`[Pipeline]   Segmento ${seg.id}: ${seg.timeRange} (${seg.duration.toFixed(1)}s) — ${seg.scriptText.substring(0, 50)}...`);
        });

        // 6. Gerar conteúdo ASS
        const assContent = generateAssContent(finalSegments, profile);
        console.log(`[Pipeline] 📄 Conteúdo ASS gerado: ${assContent.length} chars`);

        // 7. Salvar e avançar
        const subtitlesData: StageDataMap['subtitles'] = {
            srtContent: '',
            assContent,
            segments: finalSegments,
            segmentCount: finalSegments.length,
            totalDuration: audioDuration,
            wordCount: scriptData.wordCount,
            mode: 'auto',
        };

        console.log(`[Pipeline] ✅ Legendas geradas: ${finalSegments.length} segmentos, ${audioDuration.toFixed(1)}s`);
        // Agora o status vira 'review' para o usuário conferir a exportação/sincronia
        await this.projectService.updateProject(project.id, { 
            status: 'review',
            stageData: { ...project.stageData, subtitles: subtitlesData }
        });
        
        return {
            ...project,
            status: 'review',
            stageData: { ...project.stageData, subtitles: subtitlesData }
        };
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
