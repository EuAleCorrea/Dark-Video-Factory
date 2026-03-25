import React from 'react';
import { VideoProject, PipelineStage, STAGE_META, ReferenceStageData, SubtitlesStageData, AudioStageData, AudioCompressStageData, VideoStageData, EngineConfig, ScenesStageData, SceneData, ChannelProfile } from '../types';
import { X, BookOpen, FileText, Calendar, Hash, Type, Info, ExternalLink, MessageSquare, Code, Play, Clock, AlignLeft, Captions, Mic, Volume2, HardDrive, Zap, Download, Image as ImageIcon, Loader2, Cpu, Film, FolderOpen, Copy, Pause } from 'lucide-react';
import { openUrl } from '@tauri-apps/plugin-opener';
import { convertFileSrc } from '@tauri-apps/api/core';
import VideoPlayerModal from './VideoPlayerModal';
import { loadAudioBlobUrl, loadAudioRaw, resolveAudioPath, mergeProjectAudio } from '../services/AudioStorageService';
import Storyboard from './Storyboard';
import { ProjectService } from '../services/ProjectService';
import { ImagePromptService } from '../services/ImagePromptService';
import { getImageProvider, getImageModel, IMAGE_MODELS } from '../services/imageProviders';
import { interpretErrorWithAI } from '../services/geminiService';
import { useStatusModal } from '../contexts/StatusModalContext';
import { saveImageToDisk } from '../services/ImageDiskService';
import { converterParaSRT, getSrtStats } from '../services/SrtConverterService';
import { PipelineExecutor } from '../services/PipelineExecutor';
import { ElevenLabsService } from '../services/ElevenLabsService';
import * as DiskStorage from '../services/DiskStorageService';
import { SubtitleStyleGallery } from './editor/SubtitleStyleGallery';
import { SubtitlePreset, SUBTITLE_PRESETS } from '../lib/subtitlePresets';
import { transcribeAudio, generateVisualPromptsForSegments } from '../services/geminiService';
import { generateSrtContent, generateAssContent } from '../lib/subtitleGenerator';
import { Wand2 } from 'lucide-react';

interface StageDetailsModalProps {
    isOpen: boolean;
    onClose: () => void;
    project: VideoProject | null;
    stage: PipelineStage | null;
    config: EngineConfig | null;
    profile: ChannelProfile | null;
    onUpdate: (projectId: string, updatedProject: Partial<VideoProject>) => Promise<void>;
    executor: PipelineExecutor | null;
}

export default function StageDetailsModal({ isOpen, onClose, project, stage, config, profile, onUpdate, executor }: StageDetailsModalProps) {
    const [isVideoPlayerOpen, setIsVideoPlayerOpen] = React.useState(false);
    const [showAss, setShowAss] = React.useState(false);
    const [audioBlobUrl, setAudioBlobUrl] = React.useState<string | null>(null);
    const [audioLoading, setAudioLoading] = React.useState(false);
    const [isExporting, setIsExporting] = React.useState(false);
    const [stylePrompt, setStylePrompt] = React.useState("");
    const [generatingIds, setGeneratingIds] = React.useState<number[]>([]);
    const [generatingAudioIds, setGeneratingAudioIds] = React.useState<number[]>([]);
    const [generatingImageIds, setGeneratingImageIds] = React.useState<number[]>([]); // Novo
    const [imageViewerData, setImageViewerData] = React.useState<{ url: string, text: string } | null>(null);
    const [sceneAudioConfigs, setSceneAudioConfigs] = React.useState<Record<number, { provider: string, voiceId: string }>>({});
    const [sceneImageConfigs, setSceneImageConfigs] = React.useState<Record<number, { modelId: string }>>({}); // Novo
    const [elevenLabsVoices, setElevenLabsVoices] = React.useState<any[]>([]);
    const [elevenLabsLoading, setElevenLabsLoading] = React.useState(false);
    const [isTranscribing, setIsTranscribing] = React.useState(false);
    const [selectedSubtitleStyle, setSelectedSubtitleStyle] = React.useState<SubtitlePreset | null>(null);
    const isGeneratingRef = React.useRef(false);
    const status = useStatusModal();

    // Helper para casar a voz do perfil com as opções do modal
    const getInitialVoice = (provider: string) => {
        const pv = profile?.voiceProfile || '';
        if (provider === 'google') {
            const googleVoices = ['Kore', 'Puck', 'Charon', 'Fenrir', 'Aoede'];
            // Se o perfil contém o nome de uma voz Google (ex: "Charon (Masculino)")
            const matched = googleVoices.find(v => pv.toLowerCase().includes(v.toLowerCase()));
            return matched || 'Kore';
        }
        // Para ElevenLabs, assume que o perfil já guarda o ID ou nome exato
        return pv || (elevenLabsVoices[0]?.voice_id || '');
    };

    const handleGenerateSceneAudio = async (sceneId: number) => {
        if (!project || !executor) {
            status.error("Executor não disponível ou projeto inválido.");
            return;
        }
        
        // Determinar configurações efetivas (local override ou global fallback)
        const sceneConfig = sceneAudioConfigs[sceneId];
        const effectiveProvider = (sceneConfig?.provider || config?.providers.tts || 'google') as 'google' | 'elevenlabs';
        const effectiveVoiceId = sceneConfig?.voiceId || getInitialVoice(effectiveProvider);

        setGeneratingAudioIds(prev => [...prev, sceneId]);
        try {
            const updatedProject = await executor.processSingleSceneAudio(
                project,
                sceneId,
                profile!,
                config!,
                { provider: effectiveProvider, voiceId: effectiveVoiceId }
            );
            status.success(`Áudio da cena ${sceneId} gerado!`);
            if (onUpdate) await onUpdate(project.id, updatedProject);
        } catch (err: any) {
            console.error('Error in processSingleSceneAudio:', err);
            status.error(err.message || String(err), "Falha na Geração");
        } finally {
            setGeneratingAudioIds(prev => prev.filter(id => id !== sceneId));
        }
    };

    const handleGenerateSceneImage = async (sceneId: number) => {
        if (!project || !executor || generatingImageIds.includes(sceneId)) return;

        setGeneratingImageIds(prev => [...prev, sceneId]);
        const modelId = sceneImageConfigs[sceneId]?.modelId || config?.providers.image || 'FLUX';

        try {
            const updatedProject = await executor.processSingleSceneImage(
                project,
                sceneId,
                profile!,
                config!,
                { modelId }
            );

            // O executor já atualiza o projeto no disco e via onProgress
            await onUpdate(project.id, { stageData: updatedProject.stageData });
        } catch (err: any) {
            console.error(err);
            status.error("Erro ao gerar imagem", err.message);
        } finally {
            setGeneratingImageIds(prev => prev.filter(id => id !== sceneId));
        }
    };

    // 🔒 MODO TESTE
    const TEST_MODE_MAX_IMAGES = 2;

    React.useEffect(() => {
        if (project?.stageData.reference?.stylePrompt) {
            setStylePrompt(project.stageData.reference.stylePrompt);
        } else {
            setStylePrompt("monochrome, cinematic lighting, high contrast, realistic texture, 8k render, dark atmosphere");
        }
    }, [project?.id]);

    React.useEffect(() => {
        if (!isOpen || !config?.apiKeys?.elevenLabs) return;
        const fetchVoices = async () => {
            try {
                setElevenLabsLoading(true);
                const service = new ElevenLabsService(config.apiKeys.elevenLabs!);
                const voices = await service.getVoices();
                setElevenLabsVoices(voices);
            } catch (err) {
                console.error('Failed to load ElevenLabs voices:', err);
            } finally {
                setElevenLabsLoading(false);
            }
        };
        fetchVoices();
    }, [isOpen, config?.apiKeys?.elevenLabs]);

    React.useEffect(() => {
        if (!isOpen || !project || !stage) return;

        if (stage === PipelineStage.AUDIO || stage === PipelineStage.AUDIO_COMPRESS) {
            setAudioLoading(true);
            setAudioBlobUrl(null);

            const loadAudio = async () => {
                try {
                    if (stage === PipelineStage.AUDIO_COMPRESS) {
                        const compressedKey = `${project.id}_compressed`;
                        const rawData = await loadAudioRaw(compressedKey);
                        if (rawData) {
                            const blob = new Blob([rawData.buffer as ArrayBuffer], { type: 'audio/mpeg' });
                            setAudioBlobUrl(URL.createObjectURL(blob));
                        }
                    } else {
                        const blobUrl = await loadAudioBlobUrl(project.id);
                        setAudioBlobUrl(blobUrl);
                    }
                } catch (err) {
                    console.error('[StageDetails] Failed to load audio:', err);
                } finally {
                    setAudioLoading(false);
                }
            };
            loadAudio();
            return () => {
                setAudioBlobUrl(prev => {
                    if (prev) URL.revokeObjectURL(prev);
                    return null;
                });
            };
        }
    }, [isOpen, project?.id, stage]);

    if (!isOpen || !project || !stage) return null;

    const meta = STAGE_META[stage];

    const handleExternalLink = async (e: React.MouseEvent, url: string) => {
        e.preventDefault();
        try {
            await openUrl(url);
        } catch (err) {
            console.error('Failed to open external link:', err);
        }
    };

    const handleUpdateSegment = async (id: number, scriptText: string, visualPrompt: string) => {
        if (!project) return;
        const subData = project.stageData.subtitles as SubtitlesStageData;
        if (!subData) return;

        const updatedSegments = subData.segments.map(seg =>
            seg.id === id ? { ...seg, scriptText, visualPrompt } : seg
        );

        await onUpdate(project.id, {
            stageData: {
                ...project.stageData,
                subtitles: { ...subData, segments: updatedSegments }
            }
        });
    };

    const handleUpdateSegmentImage = async (id: number, imageUrl: string) => {
        if (!project) return;
        const subData = project.stageData.subtitles as SubtitlesStageData;
        if (!subData) return;

        const updatedSegments = subData.segments.map(seg =>
            seg.id === id ? { ...seg, assets: { ...seg.assets, imageUrl } } : seg
        );

        await onUpdate(project.id, {
            stageData: {
                ...project.stageData,
                subtitles: { ...subData, segments: updatedSegments }
            }
        });
    };

    const handleGenerateSubtitles = async () => {
        if (!project || !config || isTranscribing) return;
        
        setIsTranscribing(true);
        status.open('🎙️ Gerando Legendas via IA...');

        try {
            // ETAPA 1: Carregar áudio
            status.log('📥 Carregando áudio do projeto...');
            let rawAudio = await loadAudioRaw(project.id);
            
            if (!rawAudio) {
                status.log('🔀 Áudio mestre não encontrado, consolidando cenas...');
                try {
                    const sceneIds = project.stageData.scenes?.scenes
                        ?.filter((s: any) => s.audioUrl || s.status === 'done')
                        .map((s: any) => s.id) || [];
                    status.log(`📋 ${sceneIds.length} cenas com áudio encontradas`);
                    await mergeProjectAudio(project.id, sceneIds.length > 0 ? sceneIds : undefined);
                    status.log('✅ Consolidação concluída!');
                    rawAudio = await loadAudioRaw(project.id);
                } catch (mergeErr: any) {
                    throw new Error(`Falha ao consolidar cenas: ${mergeErr.message}`);
                }
            }

            if (!rawAudio) throw new Error("Áudio não encontrado. Gere os áudios das cenas primeiro.");

            status.log(`📦 Áudio carregado: ${(rawAudio.byteLength / 1024 / 1024).toFixed(2)} MB`);

            // ETAPA 2: Converter para base64
            status.log('🔄 Preparando áudio para transcrição...');
            let binary = '';
            const len = rawAudio.byteLength;
            for (let i = 0; i < len; i++) {
                binary += String.fromCharCode(rawAudio[i]);
            }
            const base64Audio = window.btoa(binary);
            status.log(`📤 Base64 pronto (${(base64Audio.length / 1024 / 1024).toFixed(2)} MB)`);

            // ETAPA 3: Transcrever via Gemini 2.0 Flash
            status.log('🧠 Enviando para Gemini 2.0 Flash (STT)...');
            status.log('⏳ Isso pode levar 30-60s dependendo do tamanho do áudio...');
            const { segments: transcribedSegments } = await transcribeAudio(
                base64Audio,
                'audio/wav',
                config
            );
            status.log(`✅ Transcrição concluída! ${transcribedSegments.length} segmentos`);

            // ETAPA 4: Converter para StoryboardSegments
            status.log('📝 Formatando segmentos de legenda...');
            const sttSegments = transcribedSegments.map(s => {
                const startMin = Math.floor(s.startTime / 60);
                const startSec = Math.floor(s.startTime % 60);
                const startMs = Math.floor((s.startTime % 1) * 100);
                
                const endMin = Math.floor(s.endTime / 60);
                const endSec = Math.floor(s.endTime % 60);
                const endMs = Math.floor((s.endTime % 1) * 100);

                const timeRange = `${String(startMin).padStart(2, '0')}:${String(startSec).padStart(2, '0')}.${String(startMs).padStart(2, '0')} - ${String(endMin).padStart(2, '0')}:${String(endSec).padStart(2, '0')}.${String(endMs).padStart(2, '0')}`;

                return {
                    id: s.id,
                    scriptText: s.scriptText,
                    visualPrompt: '',
                    duration: s.endTime - s.startTime,
                    startTime: s.startTime,
                    endTime: s.endTime,
                    timeRange
                };
            });

            // ETAPA 5: Gerar Prompts Visuais via IA
            status.log('🎨 Gerando prompts visuais para imagens...');
            const visualStyle = profile?.visualStyle || "cinematic, 8k, detailed";
            const modelId = profile?.scriptingModel || config.scriptingModel || 'gemini-2.0-flash-exp';
            const provider = (profile?.scriptingProvider || config.scriptingProvider || 'GEMINI') as any;

            const visualPromptsRaw = await generateVisualPromptsForSegments(
                sttSegments.map(s => ({ id: s.id, scriptText: s.scriptText })),
                visualStyle,
                modelId,
                provider,
                config
            );
            status.log(`✅ ${visualPromptsRaw.length} prompts visuais gerados`);

            // ETAPA 6: Finalizar Segmentos
            const finalSegments = sttSegments.map(seg => {
                const promptObj = visualPromptsRaw.find(p => p.id === seg.id);
                return {
                    ...seg,
                    visualPrompt: promptObj ? promptObj.visualPrompt : "Cinematic visualization"
                };
            });

            // ETAPA 7: Gerar arquivos SRT/ASS
            status.log('📄 Gerando legendas SRT/ASS...');
            const srtContent = generateSrtContent(finalSegments);
            const style = selectedSubtitleStyle || project.stageData.subtitles?.config?.style || SUBTITLE_PRESETS[0];
            const profileWithStyle = { ...profile!, subtitleStyle: style };
            const assContent = generateAssContent(finalSegments, profileWithStyle as any);

            // ETAPA 8: Atualizar projeto
            status.log('💾 Salvando dados do projeto...');
            const subtitleData: SubtitlesStageData = {
                srtContent,
                assContent,
                segments: finalSegments,
                segmentCount: finalSegments.length,
                totalDuration: finalSegments[finalSegments.length - 1]?.endTime || 0,
                wordCount: finalSegments.reduce((acc, s) => acc + s.scriptText.split(/\s+/).length, 0),
                config: {
                    style: style,
                    mode: 'ai' as const
                }
            };

            await onUpdate(project.id, {
                currentStage: PipelineStage.SUBTITLES,
                stageData: {
                    ...project.stageData,
                    subtitles: subtitleData
                }
            });

            status.success('Legendas e Storyboard gerados com sucesso!');
        } catch (err: any) {
            console.error(err);
            // Formata mensagem de erro mais legível
            let errorMsg = '';
            if (typeof err === 'object' && err.message) {
                errorMsg = err.message;
            } else if (typeof err === 'string') {
                errorMsg = err;
            } else {
                errorMsg = JSON.stringify(err);
            }
            // Extrai mensagem útil de erros JSON do Gemini
            if (errorMsg.includes('"code":429') || errorMsg.includes('RESOURCE_EXHAUSTED')) {
                errorMsg = '⚠️ Quota excedida em todas as chaves Gemini. Aguarde alguns minutos e tente novamente, ou adicione mais chaves em Configurações.';
            }
            status.error(errorMsg);
        } finally {
            setIsTranscribing(false);
        }
    };

    const handleStyleSelect = async (style: SubtitlePreset) => {
        setSelectedSubtitleStyle(style);
        if (!project || !project.stageData.subtitles) return;

        const subData = project.stageData.subtitles as SubtitlesStageData;
        const profileWithStyle = { ...profile!, subtitleStyle: style };
        const assContent = generateAssContent(subData.segments, profileWithStyle as any);

        await onUpdate(project.id, {
            stageData: {
                ...project.stageData,
                subtitles: { 
                    ...subData, 
                    assContent,
                    config: { 
                        style, 
                        mode: subData.config?.mode || 'ai' as const
                    }
                }
            }
        });
        status.success(`Estilo "${style.name}" aplicado!`);
    };

    const handleGenerateImages = async (ids: number[]) => {
        if (isGeneratingRef.current) return;
        if (!project || !config) return;

        const subData = project.stageData.subtitles;
        if (!subData) return;

        isGeneratingRef.current = true;
        status.open('🎨 Gerando Imagens...');
        setGeneratingIds(prev => [...new Set([...prev, ...ids])]);

        try {
            const modelIdMap: Record<string, string> = {
                'FLUX': 'FLUX.1', 'NANO_BANANA': 'Nano Banana', 'IDEOGRAM': 'Ideogram', 'TOGETHER': 'FLUX.1-Together'
            };

            const imageModelId = modelIdMap[config.providers.image] || 'FLUX.1';
            const model = getImageModel(imageModelId);
            const provider = getImageProvider(imageModelId);

            if (!model) throw new Error(`Modelo ${imageModelId} não encontrado.`);
            const apiKey = (config.apiKeys as any)[model.apiKeyField];

            const updatedSegments = [...subData.segments];
            for (const id of ids) {
                const segIdx = updatedSegments.findIndex(s => s.id === id);
                if (segIdx === -1) continue;
                const seg = updatedSegments[segIdx];

                try {
                    const expandedPrompt = await ImagePromptService.expandPrompt(seg.scriptText, stylePrompt, config);
                    const result = await provider.generate(expandedPrompt, 1024, 1024, 1, apiKey);
                    
                    if (result.urls?.[0]) {
                        let imageUrl = result.urls[0];
                        const localPath = await saveImageToDisk(imageUrl, project.id, id);
                        imageUrl = localPath;

                        updatedSegments[segIdx] = { ...updatedSegments[segIdx], assets: { ...updatedSegments[segIdx].assets, imageUrl } };
                        await onUpdate(project.id, {
                            stageData: {
                                ...project.stageData,
                                subtitles: { ...subData, segments: [...updatedSegments] },
                                reference: { ...project.stageData.reference!, stylePrompt }
                            }
                        });
                    }
                } catch (err) {
                    console.error(`Error generating image for segment ${id}:`, err);
                } finally {
                    setGeneratingIds(prev => prev.filter(gid => gid !== id));
                }
            }
            status.success('Geração Concluída!');
        } catch (error: any) {
            status.error(error.message);
        } finally {
            isGeneratingRef.current = false;
        }
    };

    const renderReferenceDetails = (refData: ReferenceStageData) => (
        <div className="p-6 space-y-8">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                <section>
                    <h4 className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-3 flex items-center gap-2"><Info size={14} /> Metadados</h4>
                    <div className="bg-slate-50 rounded-2xl p-4 border border-slate-100 space-y-3">
                        <DetailRow label="Título" value={refData.videoTitle} />
                        <DetailRow label="Canal" value={refData.channelName} />
                        <button onClick={(e) => handleExternalLink(e, refData.videoUrl || "")} className="text-emerald-600 text-sm font-bold flex items-center gap-1 mt-2">Ver no YouTube <ExternalLink size={12}/></button>
                    </div>
                </section>
                <div className="relative group rounded-2xl overflow-hidden border cursor-pointer shadow-sm" onClick={() => setIsVideoPlayerOpen(true)}>
                    <img src={refData.thumbnailUrl} alt="Thumbnail" className="w-full aspect-video object-cover" />
                    <div className="absolute inset-0 bg-black/20 flex items-center justify-center"><Play size={40} className="text-white fill-white" /></div>
                </div>
            </div>
            <section>
                <h4 className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-3">Transcrição</h4>
                <div className="bg-white border rounded-3xl p-6 text-slate-700 font-serif leading-relaxed h-[400px] overflow-y-auto custom-scrollbar whitespace-pre-wrap">
                    {refData.transcript}
                </div>
            </section>
            <VideoPlayerModal isOpen={isVideoPlayerOpen} onClose={() => setIsVideoPlayerOpen(false)} videoId={refData.videoId} videoTitle={refData.videoTitle} />
        </div>
    );

    const renderScriptDetails = (scriptData: any) => (
        <div className="p-6 space-y-8">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <StatCard icon={Type} label="Palavras" value={`${scriptData.wordCount}`} color="blue" />
                <StatCard icon={Calendar} label="Data" value={new Date(scriptData.generationSnapshot?.generatedAt || Date.now()).toLocaleDateString()} color="purple" />
                <StatCard icon={Hash} label="Tags" value={`${scriptData.tags?.length || 0}`} color="emerald" />
            </div>
            <section>
                <div className="flex justify-between items-center mb-3">
                    <h4 className="text-xs font-bold text-slate-400 uppercase tracking-widest">Roteiro Gerado</h4>
                    <button onClick={() => { navigator.clipboard.writeText(scriptData.text); status.success("Texto copiado!"); }} className="text-xs flex items-center gap-1 text-slate-400 hover:text-emerald-600 transition-colors"><Copy size={12}/> Copiar</button>
                </div>
                <div className="bg-slate-50 border rounded-3xl p-6 text-slate-800 font-serif text-lg leading-relaxed h-[500px] overflow-y-auto custom-scrollbar whitespace-pre-wrap">
                    {scriptData.text}
                </div>
            </section>
        </div>
    );

    const renderAudioDetails = (audioData: AudioStageData) => (
        <div className="p-6 space-y-8">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <StatCard icon={Mic} label="Motor" value={audioData.provider || "Desconhecido"} color="emerald" />
                <StatCard icon={Clock} label="Duração" value={`${audioData.duration?.toFixed(1)}s`} color="blue" />
                <StatCard icon={HardDrive} label="Formato" value="WAV" color="purple" />
            </div>
            <AudioPlayerComponent label="Áudio Principal (WAV)" />
        </div>
    );

    const renderAudioCompressDetails = (compressData: AudioCompressStageData) => (
        <div className="p-6 space-y-8">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <StatCard icon={Zap} label="Compressão" value={`${compressData.compressionRatio?.toFixed(1)}x`} color="emerald" />
                <StatCard icon={Clock} label="Duração" value={`${compressData.duration?.toFixed(1)}s`} color="blue" />
                <StatCard icon={HardDrive} label="Formato" value="MP3" color="purple" />
            </div>
            <AudioPlayerComponent label="Áudio Final (MP3)" />
        </div>
    );

    const AudioPlayerComponent = ({ label }: { label: string }) => (
        <section>
            <h4 className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-3 flex items-center gap-2"><Volume2 size={14} /> {label}</h4>
            {audioLoading ? <div className="p-8 text-center text-slate-400 animate-pulse">Carregando...</div> :
             audioBlobUrl ? <div className="bg-slate-50 p-4 rounded-2xl border"><audio controls src={audioBlobUrl} className="w-full" /></div> :
             <div className="p-4 bg-amber-50 text-amber-700 rounded-xl border border-amber-100 italic text-sm text-center">Arquivo não disponível localmente.</div>}
        </section>
    );

    const renderSubtitlesDetails = (subData: SubtitlesStageData) => (
        <div className="p-6 space-y-8">
            <div className="flex items-center justify-between bg-slate-50 p-4 rounded-2xl border border-slate-100">
                <div className="flex items-center gap-3">
                    <div className="p-2 bg-emerald-100 text-emerald-600 rounded-lg">
                        <Captions size={20} />
                    </div>
                    <div>
                        <h5 className="text-sm font-bold text-slate-800 uppercase tracking-tight">Sincronização de Legendas</h5>
                        <p className="text-[10px] text-slate-400 uppercase tracking-wider">Gemini 1.5 Flash STT Engine</p>
                    </div>
                </div>
                <button
                    onClick={handleGenerateSubtitles}
                    disabled={isTranscribing}
                    className="flex items-center gap-2 px-4 py-2 bg-emerald-600 text-white rounded-xl hover:bg-emerald-700 transition-all disabled:opacity-50 shadow-md active:scale-95"
                >
                    {isTranscribing ? <Loader2 size={16} className="animate-spin" /> : <Wand2 size={16} />}
                    <span className="text-xs font-bold uppercase">{subData ? 'Regerar com IA' : 'Gerar Legendas (IA)'}</span>
                </button>
            </div>

            <div className="bg-white border rounded-2xl p-4 shadow-sm">
                <SubtitleStyleGallery 
                    selectedStyleId={selectedSubtitleStyle?.id || subData?.config?.style?.id || profile?.subtitleStyle?.styleId}
                    onSelect={handleStyleSelect}
                />
            </div>

            {subData && (
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <StatCard icon={Captions} label="Segmentos" value={`${subData.segmentCount || 0}`} color="emerald" />
                    <StatCard icon={Clock} label="Duração" value={`${subData.totalDuration?.toFixed(1) || 0}s`} color="blue" />
                    <StatCard icon={Type} label="Palavras" value={`${subData.wordCount || 0}`} color="purple" />
                </div>
            )}

            <section>
                <div className="flex justify-between items-center mb-3"><h4 className="text-xs font-bold text-slate-400 uppercase tracking-widest">Storyboard</h4></div>
                <Storyboard
                    segments={subData?.segments || []}
                    isEditable={true}
                    onUpdate={handleUpdateSegment}
                    onUpdateImage={handleUpdateSegmentImage}
                    onGenerate={handleGenerateImages}
                    generatingIds={generatingIds}
                    onImageClick={(url, text) => setImageViewerData({ url, text })}
                    config={config!}
                />
            </section>
        </div>
    );

    const renderImagesDetails = (subData: SubtitlesStageData) => (
        <div className="p-6 space-y-8">
            <div className="bg-white border rounded-2xl p-4 shadow-sm mb-6">
                <label className="text-[10px] text-slate-400 font-bold uppercase mb-2 block">Estilo Visual Global</label>
                <textarea
                    className="w-full bg-slate-50 border rounded-xl p-3 text-sm text-slate-700 font-mono outline-none resize-none"
                    rows={3}
                    value={stylePrompt}
                    onChange={(e) => setStylePrompt(e.target.value)}
                />
            </div>
            <Storyboard
                segments={subData.segments}
                isEditable={true}
                onUpdate={handleUpdateSegment}
                onUpdateImage={handleUpdateSegmentImage}
                onGenerate={handleGenerateImages}
                generatingIds={generatingIds}
                onImageClick={(url, text) => setImageViewerData({ url, text })}
                config={config!}
            />
        </div>
    );

    const renderVideoDetails = (videoData: VideoStageData) => {
        const handleOpenFolder = async () => {
            if (!videoData.fileUrl) return;
            try {
                const { revealItemInDir } = await import('@tauri-apps/plugin-opener');
                await revealItemInDir(videoData.fileUrl);
            } catch (err) {
                console.error(err);
            }
        };

        return (
            <div className="p-6 space-y-8">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <StatCard icon={Film} label="Resolução" value={videoData.resolution || '1080x1920'} color="emerald" />
                    <StatCard icon={Clock} label="Duração" value={`${videoData.duration?.toFixed(1) || 0}s`} color="blue" />
                    <StatCard icon={HardDrive} label="Formato" value="MP4" color="purple" />
                </div>
                {videoData.fileUrl && (
                    <div className="bg-black rounded-2xl overflow-hidden border shadow-lg">
                        <video controls className="w-full max-h-[500px]" src={convertFileSrc(videoData.fileUrl)} />
                    </div>
                )}
                <div className="bg-slate-50 p-4 rounded-xl space-y-2">
                    <DetailRow label="Arquivo" value={videoData.fileUrl?.split(/[\\/]/).pop() || 'N/A'} />
                    <DetailRow label="Caminho" value={videoData.fileUrl || 'N/A'} />
                </div>
                {videoData.fileUrl && (
                    <button onClick={handleOpenFolder} className="w-full py-3 bg-emerald-50 text-emerald-700 font-bold rounded-2xl border border-emerald-200 transition-all active:scale-95 flex items-center justify-center gap-2">
                        <FolderOpen size={18} /> Ver na Pasta
                    </button>
                )}
            </div>
        );
    };


    const renderScenesDetails = (scenesData: ScenesStageData) => (
        <div className="p-6 space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                <StatCard icon={Film} label="Cenas" value={String(scenesData.scenes.length)} color="blue" />
                <StatCard icon={Type} label="Palavras" value={String(scenesData.scenes.reduce((acc, s) => acc + (s.scriptText?.split(/\s+/).length || 0), 0))} color="purple" />
                <StatCard icon={Zap} label="Modo" value={scenesData.mode} color="emerald" />
                <StatCard icon={Mic} label="Áudios" value={`${scenesData.scenes.filter(s => !!s.audioUrl).length}/${scenesData.scenes.length}`} color="orange" />
            </div>
            <div className="grid grid-cols-1 gap-4">
                {scenesData.scenes.map(scene => (
                    <SceneCard
                        key={scene.id}
                        scene={scene}
                        project={project}
                        config={config}
                        profile={profile}
                        generatingAudioIds={generatingAudioIds}
                        generatingImageIds={generatingImageIds}
                        sceneAudioConfigs={sceneAudioConfigs}
                        sceneImageConfigs={sceneImageConfigs}
                        elevenLabsVoices={elevenLabsVoices}
                        onAudioGenerate={handleGenerateSceneAudio}
                        onImageGenerate={handleGenerateSceneImage}
                        onAudioConfigChange={(sceneId, cfg) => setSceneAudioConfigs(prev => ({ ...prev, [sceneId]: cfg }))}
                        onImageConfigChange={(sceneId, cfg) => setSceneImageConfigs(prev => ({ ...prev, [sceneId]: cfg }))}
                        onImageClick={(url, text) => setImageViewerData({ url, text })}
                    />
                ))}
            </div>
        </div>
    );

    const renderContent = () => {
        if (!project.stageData) return null;
        switch (stage) {
            case PipelineStage.SCENES: return renderScenesDetails(project.stageData.scenes as ScenesStageData);
            case PipelineStage.REFERENCE: return renderReferenceDetails(project.stageData.reference as ReferenceStageData);
            case PipelineStage.SCRIPT: return renderScriptDetails(project.stageData.script);
            case PipelineStage.AUDIO: return renderAudioDetails(project.stageData.audio as AudioStageData);
            case PipelineStage.AUDIO_COMPRESS: return renderAudioCompressDetails(project.stageData.audio_compress as AudioCompressStageData);
            case PipelineStage.SUBTITLES: return renderSubtitlesDetails(project.stageData.subtitles as SubtitlesStageData);
            case PipelineStage.IMAGES: return renderImagesDetails(project.stageData.subtitles as SubtitlesStageData);
            case PipelineStage.VIDEO: return renderVideoDetails(project.stageData.video as VideoStageData);
            default: return <div className="p-12 text-center text-slate-400">Dados não disponíveis.</div>;
        }
    };

    return (
        <div className="fixed inset-0 z-[10000] flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4" onClick={onClose}>
            <div className="bg-white rounded-3xl shadow-2xl w-full max-w-4xl max-h-[90vh] flex flex-col overflow-hidden" onClick={e => e.stopPropagation()}>
                <div className="px-6 py-5 border-b flex items-center justify-between bg-slate-50/50">
                    <div className="flex items-center gap-4">
                        <div className="w-12 h-12 rounded-2xl flex items-center justify-center shadow-sm" style={{ backgroundColor: meta.bgColor, color: meta.color }}>{meta.icon || <FileText size={24}/>}</div>
                        <div>
                            <h3 className="text-xl font-bold text-slate-900">{meta.label}</h3>
                            <p className="text-xs text-slate-500">{project.title} • {new Date(project.updatedAt).toLocaleTimeString()}</p>
                        </div>
                    </div>
                    <button onClick={onClose} className="p-2 hover:bg-slate-200 rounded-xl transition-colors"><X size={20}/></button>
                </div>
                <div className="flex-1 overflow-y-auto custom-scrollbar">{renderContent()}</div>
            </div>
            {imageViewerData && (
                <div className="fixed inset-0 z-[20000] bg-black/98 flex flex-col items-center justify-center p-8 animate-in fade-in" onClick={() => setImageViewerData(null)}>
                    <img src={imageViewerData.url} className="max-w-full max-h-full object-contain rounded-2xl shadow-2xl shadow-primary/20" />
                    <p className="mt-6 text-white text-xl font-light italic max-w-2xl text-center">{imageViewerData.text}</p>
                    <button className="absolute top-8 right-8 text-white/50 hover:text-white"><X size={40}/></button>
                </div>
            )}
        </div>
    );
}

// ─── HELPER COMPONENTS ────────────────────────────────────

function DetailRow({ label, value, compact = false }: { label: string; value: string; compact?: boolean }) {
    return (
        <div className={compact ? "" : "flex flex-col gap-0.5"}>
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">{label}</span>
            <span className={`text-[#0F172A] break-all ${compact ? 'text-xs block mt-0.5' : 'text-sm font-medium'}`}>{value || '—'}</span>
        </div>
    );
}

function StatCard({ icon: Icon, label, value, color }: { icon: any; label: string; value: string; color: string }) {
    const colors: Record<string, string> = {
        blue: 'bg-blue-50 text-blue-600 border-blue-100',
        purple: 'bg-purple-50 text-purple-600 border-purple-100',
        emerald: 'bg-emerald-50 text-emerald-600 border-emerald-100',
        orange: 'bg-orange-50 text-orange-600 border-orange-100',
    };

    return (
        <div className={`p-4 rounded-2xl border ${colors[color]} flex items-center gap-4`}>
            <div className={`p-2.5 rounded-xl bg-white shadow-sm`}>
                <Icon size={18} />
            </div>
            <div>
                <p className="text-[10px] font-bold uppercase tracking-widest opacity-70 leading-none mb-1">{label}</p>
                <p className="text-sm font-black tabular-nums">{value}</p>
            </div>
        </div>
    );
}

// ─── SCENE CARD COMPONENT (MEMOIZED) ──────────────────────

const SceneCard = React.memo(({ 
    scene, project, config, profile, 
    generatingAudioIds, generatingImageIds, 
    sceneAudioConfigs, sceneImageConfigs, 
    elevenLabsVoices, 
    onAudioGenerate, onImageGenerate, 
    onAudioConfigChange, onImageConfigChange,
    onImageClick
}: {
    scene: SceneData;
    project: VideoProject;
    config: EngineConfig | null;
    profile: ChannelProfile | null;
    generatingAudioIds: number[];
    generatingImageIds: number[];
    sceneAudioConfigs: Record<number, { provider: string, voiceId: string }>;
    sceneImageConfigs: Record<number, { modelId: string }>;
    elevenLabsVoices: any[]; // Assuming ElevenLabsVoice type if available
    onAudioGenerate: (id: number) => void;
    onImageGenerate: (id: number) => void;
    onAudioConfigChange: (id: number, cfg: { provider: string, voiceId: string }) => void;
    onImageConfigChange: (id: number, cfg: { modelId: string }) => void;
    onImageClick: (url: string, text: string) => void;
}) => {
    const sceneConfig = sceneAudioConfigs[scene.id];
    const currentProvider = sceneConfig?.provider || config?.providers.tts || 'google';
    
    // Helper local para voz
    const getInitialVoice = (provider: string) => {
        const pv = profile?.voiceProfile || '';
        if (provider === 'google') {
            const googleVoices = ['Kore', 'Puck', 'Charon', 'Fenrir', 'Aoede'];
            const matched = googleVoices.find(v => pv.toLowerCase().includes(v.toLowerCase()));
            return matched || 'Kore';
        }
        return pv || (elevenLabsVoices[0]?.voice_id || '');
    };

    const currentVoiceId = sceneConfig?.voiceId || getInitialVoice(currentProvider);

    return (
        <div className="bg-white border rounded-2xl p-5 shadow-sm transition-shadow hover:shadow-md">
            <div className="flex justify-between mb-4">
                <span className="text-xs font-bold text-slate-400">CENA #{scene.id}</span>
                {!!scene.audioUrl && <span className="text-[10px] text-emerald-600 bg-emerald-50 px-2 rounded-lg font-bold">ÁUDIO OK</span>}
            </div>
            <div className="space-y-4">
                <div className="text-sm leading-relaxed text-slate-700 bg-slate-50 p-3 rounded-xl border line-clamp-3 overflow-hidden h-[5.25rem]">
                    {scene.scriptText}
                </div>
                
                <div className="flex flex-wrap items-center gap-3 py-1">
                    <div className="flex items-center gap-2">
                        <select 
                            className="bg-slate-100 text-[11px] font-bold rounded-lg px-2 py-1.5 outline-none hover:bg-slate-200 transition-colors"
                            value={currentProvider}
                            onChange={(e) => {
                                const newProv = e.target.value;
                                const newVoice = newProv === 'google' ? (profile?.voiceProfile || 'Kore') : (elevenLabsVoices[0]?.voice_id || '');
                                onAudioConfigChange(scene.id, { provider: newProv, voiceId: newVoice });
                            }}
                        >
                            <option value="google">Google TTS</option>
                            <option value="elevenlabs">ElevenLabs</option>
                        </select>
                        <select 
                            className="bg-slate-100 text-[11px] font-bold rounded-lg px-2 py-1.5 outline-none max-w-[120px] hover:bg-slate-200 transition-colors"
                            value={currentVoiceId}
                            onChange={(e) => onAudioConfigChange(scene.id, { provider: currentProvider, voiceId: e.target.value })}
                        >
                            {currentProvider === 'elevenlabs' 
                                ? elevenLabsVoices.map(v => <option key={v.voice_id} value={v.voice_id}>{v.name}</option>)
                                : ['Kore', 'Puck', 'Charon', 'Fenrir', 'Aoede'].map(v => <option key={v} value={v}>{v}</option>)
                            }
                        </select>
                    </div>
                    <button
                        onClick={() => onAudioGenerate(scene.id)}
                        disabled={generatingAudioIds.includes(scene.id)}
                        className={`flex-1 flex items-center justify-center gap-2 py-1.5 rounded-lg text-xs font-bold transition-all shadow-sm
                            ${generatingAudioIds.includes(scene.id) 
                                ? 'bg-slate-100 text-slate-400 cursor-not-allowed' 
                                : 'bg-emerald-600 text-white hover:bg-emerald-700 active:scale-95'
                            }
                        `}
                    >
                        {generatingAudioIds.includes(scene.id) ? <Loader2 size={14} className="animate-spin" /> : <Mic size={14} />}
                        {generatingAudioIds.includes(scene.id) ? 'Sintetizando...' : 'Gerar Áudio'}
                    </button>
                </div>

                {/* Player assíncrono ja existente no escopo do arquivo */}
                <SceneAudioPlayerWrapper projectId={project.id} sceneId={scene.id} audioUrl={scene.audioUrl} />

                <div className="text-[11px] leading-relaxed text-slate-400 italic bg-slate-50/50 p-3 rounded-xl border border-dashed line-clamp-3 overflow-hidden h-[4.5rem]">
                    {scene.visualPrompt}
                </div>

                {/* Geração de Imagem */}
                <div className="flex flex-wrap items-center gap-3 py-1 mt-1">
                    <div className="flex items-center gap-2">
                        <select 
                            className="bg-slate-100 text-[11px] font-bold rounded-lg px-2 py-1.5 outline-none max-w-[150px] hover:bg-slate-200 transition-colors"
                            value={sceneImageConfigs[scene.id]?.modelId || config?.providers.image || 'FLUX'}
                            onChange={(e) => onImageConfigChange(scene.id, { modelId: e.target.value })}
                        >
                            {IMAGE_MODELS.map(m => (
                                <option key={m.id} value={m.id}>{m.label}</option>
                            ))}
                        </select>
                    </div>
                    <button
                        onClick={() => onImageGenerate(scene.id)}
                        disabled={generatingImageIds.includes(scene.id)}
                        className={`flex-1 flex items-center justify-center gap-2 py-1.5 rounded-lg text-xs font-bold transition-all shadow-sm
                            ${generatingImageIds.includes(scene.id) 
                                ? 'bg-slate-100 text-slate-400 cursor-not-allowed' 
                                : 'bg-primary text-white hover:bg-primary/90 active:scale-95'
                            }
                        `}
                    >
                        {generatingImageIds.includes(scene.id) ? <Loader2 size={14} className="animate-spin" /> : <ImageIcon size={14} />}
                        {generatingImageIds.includes(scene.id) ? 'Gerando...' : 'Gerar Imagem'}
                    </button>
                </div>

                {/* Preview de imagem ja existente no escopo do arquivo */}
                <SceneImagePreviewWrapper 
                    projectId={project.id} 
                    sceneId={scene.id} 
                    prompt={scene.visualPrompt} 
                    imageUrl={scene.imageUrl} 
                    onImageClick={onImageClick}
                />
            </div>
        </div>
    );
});

// Wrappers para os sub-componentes (estatizados para evitar re-declaração)
function SceneAudioPlayer({ projectId, sceneId, refreshKey }: { projectId: string, sceneId: number, refreshKey: string }) {
    const [url, setUrl] = React.useState<string | null>(null);

    React.useEffect(() => {
        const resolve = async () => {
            try {
                const relPath = resolveAudioPath(`${projectId}:scene_${sceneId}`);
                const absPath = await DiskStorage.getAbsolutePath(relPath);
                const fileExists = await DiskStorage.exists(relPath);
                if (fileExists) {
                    setUrl(convertFileSrc(absPath));
                }
            } catch (e) {
                console.error('Failed to resolve audio path:', e);
            }
        };
        resolve();
    }, [projectId, sceneId, refreshKey]);

    if (!url) return null;

    return (
        <div className="mt-3 p-3 bg-slate-100/50 rounded-2xl border flex items-center gap-3 shadow-inner animate-in fade-in slide-in-from-top-2 duration-300">
            <div className="p-2 bg-primary/10 rounded-lg text-primary">
                <Volume2 size={16} />
            </div>
            <audio src={url} controls className="h-8 flex-1 custom-audio-player" />
        </div>
    );
}

function SceneImagePreview({ projectId, sceneId, prompt, refreshKey, onImageClick }: { projectId: string, sceneId: number, prompt: string, refreshKey: string, onImageClick: (url: string, text: string) => void }) {
    const [url, setUrl] = React.useState<string | null>(null);

    React.useEffect(() => {
        const resolve = async () => {
            try {
                const relPath = DiskStorage.joinPath('projects', projectId, 'scenes', `scene_${sceneId}.png`);
                const absPath = await DiskStorage.getAbsolutePath(relPath);
                const fileExists = await DiskStorage.exists(relPath);
                if (fileExists) {
                    setUrl(convertFileSrc(absPath));
                }
            } catch (e) {
                console.error('Failed to resolve image path:', e);
            }
        };
        resolve();
    }, [projectId, sceneId, refreshKey]);

    if (!url) return null;

    return (
        <div 
            className="mt-3 relative group cursor-pointer overflow-hidden rounded-2xl border aspect-video bg-slate-100 shadow-sm animate-in fade-in slide-in-from-top-2 duration-300"
            onClick={() => onImageClick(url, prompt)}
        >
            <img 
                src={url} 
                alt="Preview"
                className="w-full h-full object-cover transition-transform group-hover:scale-105"
            />
            <div className="absolute inset-0 bg-black/20 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                <div className="p-3 bg-white/20 backdrop-blur-md rounded-full text-white border border-white/30 scale-90 group-hover:scale-100 transition-transform">
                    <ImageIcon size={24} />
                </div>
            </div>
        </div>
    );
}

function SceneAudioPlayerWrapper({ projectId, sceneId, audioUrl }: { projectId: string, sceneId: number, audioUrl?: string }) {
    if (!audioUrl) return null;
    return <SceneAudioPlayer projectId={projectId} sceneId={sceneId} refreshKey={audioUrl} />;
}

function SceneImagePreviewWrapper({ projectId, sceneId, prompt, imageUrl, onImageClick }: { projectId: string, sceneId: number, prompt: string, imageUrl?: string, onImageClick: (url: string, text: string) => void }) {
    if (!imageUrl) return null;
    return <SceneImagePreview projectId={projectId} sceneId={sceneId} prompt={prompt} refreshKey={imageUrl} onImageClick={onImageClick} />;
}

// Adicionando display names para facilitar debug no React DevTools
SceneCard.displayName = 'SceneCard';
