
import { VideoProject, PipelineStage, EngineConfig, VideoFormat, ScriptGenerationSnapshot } from "../types";
import { ProjectService } from "./ProjectService";
import { generateVideoScriptAndPrompts, rewriteTranscript, structureScript, generateSpeech } from "./geminiService";
import { PersistenceService } from "./PersistenceService";
import { ChannelProfile, StageDataMap } from "../types";
import { pcmToWav, getAudioDuration } from "../lib/audioUtils";
import { saveAudio } from "./AudioStorageService";

export class PipelineExecutor {
    constructor(
        private projectService: ProjectService,
        private persistence: PersistenceService,
        private getConfig: () => EngineConfig,
        private getProfile: (channelId: string) => ChannelProfile | undefined
    ) { }

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
                default:
                    console.log(`No auto-process defined for stage ${project.currentStage}`);
                    await this.projectService.updateProject(project.id, { status: "ready" });
                    break;
            }
        } catch (error) {
            console.error(`Pipeline execution failed for project ${project.id}:`, error);
            await this.projectService.updateProject(project.id, {
                status: "error",
                errorMessage: String(error),
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
            console.log(`[Pipeline] 📝 APIFY retornou transcript com ${transcript.length} chars`);

            if (transcript) {
                await this.projectService.updateProject(project.id, {
                    stageData: {
                        ...project.stageData,
                        reference: { ...referenceData, transcript }
                    }
                });
            }
        }

        if (!transcript) {
            throw new Error("Transcrição não encontrada. O vídeo pode não ter legendas habilitadas, ou o ator APIFY retornou vazio.");
        }

        console.log(`[Pipeline] ✅ Transcrição obtida (${transcript.length} chars). Aguardando aprovação do usuário.`);

        await this.projectService.updateProject(project.id, {
            status: 'review',
            stageData: {
                ...project.stageData,
                reference: { ...referenceData, transcript }
            }
        });

        return {
            ...project,
            status: 'review',
            stageData: { ...project.stageData, reference: { ...referenceData, transcript } }
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
        const modelId = profile.scriptingModel || 'gemini-3-flash-preview';
        const provider = profile.scriptingProvider || config.providers.scripting || 'GEMINI';

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
        const p1Result = await rewriteTranscript(transcript, rewritePrompt, modelId, provider, config);
        console.log(`[Pipeline] P1 concluído: ${p1Result.caracteres} caracteres`);

        // P2 — Estruturação Viral
        console.log(`[Pipeline] ====== P2 — Estruturação via ${provider}/${modelId} ======`);
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

        return await this.projectService.advanceStage(project, { script: scriptData });
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

        // Converter PCM para WAV Uint8Array e salvar no IndexedDB (evita QuotaExceeded do localStorage)
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
        console.log(`[Pipeline] 💾 Áudio salvo no IndexedDB (${(wavData.length / 1024).toFixed(0)} KB)`);

        const audioData: StageDataMap['audio'] = {
            fileUrl: `idb://${project.id}`,
            duration,
            provider: config.providers.tts || 'GEMINI',
            mode: 'auto',
        };

        return await this.projectService.advanceStage(project, { audio: audioData });
    }
}
