import React from 'react';
import { VideoProject, PipelineStage, STAGE_META, ReferenceStageData, SubtitlesStageData, AudioStageData, AudioCompressStageData, VideoStageData, EngineConfig } from '../types';
import { X, BookOpen, FileText, Calendar, Hash, Type, Info, ExternalLink, MessageSquare, Code, Play, Clock, AlignLeft, Captions, Mic, Volume2, HardDrive, Zap, Download, Image as ImageIcon, Loader2, Cpu, Film, FolderOpen, Copy } from 'lucide-react';
import { openUrl } from '@tauri-apps/plugin-opener';
import { convertFileSrc } from '@tauri-apps/api/core';
import VideoPlayerModal from './VideoPlayerModal';
import { loadAudioBlobUrl, loadAudioRaw } from '../services/AudioStorageService';
import Storyboard from './Storyboard';
import { ProjectService } from '../services/ProjectService';
import { ImagePromptService } from '../services/ImagePromptService';
import { getImageProvider, getImageModel } from '../services/imageProviders';
import { interpretErrorWithAI } from '../services/geminiService';
import { useStatusModal } from '../contexts/StatusModalContext';
import { saveImageToDisk } from '../services/ImageDiskService';
import { converterParaSRT, getSrtStats } from '../services/SrtConverterService';

interface StageDetailsModalProps {
    isOpen: boolean;
    onClose: () => void;
    project: VideoProject | null;
    stage: PipelineStage | null;
    config: EngineConfig | null;
    onUpdate: (projectId: string, updatedProject: Partial<VideoProject>) => Promise<void>;
}

export default function StageDetailsModal({ isOpen, onClose, project, stage, config, onUpdate }: StageDetailsModalProps) {
    const [isVideoPlayerOpen, setIsVideoPlayerOpen] = React.useState(false);
    const [showAss, setShowAss] = React.useState(false);
    const [audioBlobUrl, setAudioBlobUrl] = React.useState<string | null>(null);
    const [audioLoading, setAudioLoading] = React.useState(false);
    const [isExporting, setIsExporting] = React.useState(false);
    const [stylePrompt, setStylePrompt] = React.useState("");
    const [generatingIds, setGeneratingIds] = React.useState<number[]>([]);
    const [imageViewerData, setImageViewerData] = React.useState<{ url: string, text: string } | null>(null);
    const isGeneratingRef = React.useRef(false);
    const status = useStatusModal();

    // ═══════════════════════════════════════════════════
    // 🔒 MODO TESTE — Trava temporária de segurança
    //    Limita geração a N imagens por ação.
    //    Remover quando a aplicação estiver estável.
    // ═══════════════════════════════════════════════════
    const TEST_MODE_MAX_IMAGES = 2;

    React.useEffect(() => {
        if (project?.stageData.reference?.stylePrompt) {
            setStylePrompt(project.stageData.reference.stylePrompt);
        } else {
            setStylePrompt("monochrome, cinematic lighting, high contrast, realistic texture, 8k render, dark atmosphere");
        }
    }, [project?.id]);

    React.useEffect(() => {
        if (!isOpen || !project || !stage) return;

        // Load audio for AUDIO or AUDIO_COMPRESS stages
        if (stage === PipelineStage.AUDIO || stage === PipelineStage.AUDIO_COMPRESS) {
            setAudioLoading(true);
            setAudioBlobUrl(null);

            const loadAudio = async () => {
                try {
                    if (stage === PipelineStage.AUDIO_COMPRESS) {
                        // MP3 compressed — key is projectId_compressed
                        const compressedKey = `${project.id}_compressed`;
                        const rawData = await loadAudioRaw(compressedKey);
                        if (rawData) {
                            const blob = new Blob([rawData.buffer as ArrayBuffer], { type: 'audio/mpeg' });
                            setAudioBlobUrl(URL.createObjectURL(blob));
                        }
                    } else {
                        // WAV original
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
                // Cleanup blob URL on unmount
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
                subtitles: {
                    ...subData,
                    segments: updatedSegments
                }
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
                subtitles: {
                    ...subData,
                    segments: updatedSegments
                }
            }
        });
    };

    const handleGenerateImages = async (ids: number[]) => {
        // ── REGRA 2: Prevenção de loop / double-click ──
        if (isGeneratingRef.current) {
            console.warn('[StageDetails] ⛔ Geração já em andamento — ignorando disparo duplicado.');
            return;
        }

        if (!project || !config) {
            status.open('❌ Erro de Configuração');
            status.error('Projeto ou Configuração não encontrados.');
            return;
        }

        const subData = project.stageData.subtitles;
        if (!subData) {
            status.open('❌ Erro de Dados');
            status.error('Dados de legenda não encontrados. Processe o estágio de Legendas primeiro.');
            return;
        }

        // ── REGRA 3: Verificar imagens pré-existentes ──
        const existingImages = ids.filter(id => {
            const seg = subData.segments.find(s => s.id === id);
            return seg?.assets?.imageUrl;
        });

        if (existingImages.length > 0) {
            const confirmed = window.confirm(
                `⚠️ Já existem ${existingImages.length} imagem(ns) gerada(s) anteriormente.\n\nDeseja substituir todas?`
            );
            if (!confirmed) {
                console.log('[StageDetails] 🚫 Usuário cancelou a substituição.');
                return;
            }
        }

        const safeIds = ids;

        // ── Marcar como em execução (anti-loop) ──
        isGeneratingRef.current = true;

        // ── Abrir StatusModal com logs em tempo real ──
        status.open('🎨 Gerando Imagens...');
        status.log(`🎯 ${safeIds.length} segmentos selecionados`);
        status.log(`🖌️ Estilo: ${stylePrompt.substring(0, 80)}...`);

        // Marcar cenas selecionadas como "em processamento"
        setGeneratingIds(prev => [...new Set([...prev, ...safeIds])]);

        try {
            const modelIdMap: Record<string, string> = {
                'FLUX': 'FLUX.1',
                'NANO_BANANA': 'Nano Banana',
                'IDEOGRAM': 'Ideogram',
                'TOGETHER': 'FLUX.1-Together'
            };

            const imageModelId = modelIdMap[config.providers.image] || 'FLUX.1';
            const model = getImageModel(imageModelId);
            const provider = getImageProvider(imageModelId);

            if (!model) throw new Error(`Modelo ${imageModelId} não encontrado.`);

            const apiKey = (config.apiKeys as any)[model.apiKeyField] as string;

            if (!apiKey) {
                status.error(`API Key (${model.apiKeyField}) para ${imageModelId} não está configurada.`, 'Chave de API ausente');
                setGeneratingIds(prev => prev.filter(gid => !ids.includes(gid)));
                isGeneratingRef.current = false;
                return;
            }

            status.log(`🤖 Modelo: ${model.label} [${model.badge}]`);

            let lastRawError = "";
            let lastErrorMessage = "";
            const updatedSegments = [...subData.segments];
            let successCount = 0;

            const getFriendlyErrorMessage = (error: any): string => {
                const msg = error?.message || String(error);
                if (msg.includes("Insufficient funds") || msg.includes("insufficientCredits")) return "Seu saldo na RunWare acabou ou é insuficiente.";
                if (msg.includes("Unauthorized") || msg.includes("Invalid API Key") || msg.includes("401")) return "Sua chave de API parece estar incorreta ou inválida.";
                return msg.replace("Erro RunWare:", "").trim();
            };

            // ESTRATÉGIA DE CONSOLIDAÇÃO:
            const sceneGroups: Record<string, number[]> = {};
            for (const id of safeIds) {
                const seg = subData.segments.find(s => s.id === id);
                const sId = seg?.sceneId ? `scene_${seg.sceneId}` : `seg_${id}`;
                if (!sceneGroups[sId]) sceneGroups[sId] = [];
                sceneGroups[sId].push(id);
            }

            const totalScenes = Object.keys(sceneGroups).length;
            status.log(`📦 Consolidação: ${safeIds.length} segmentos → ${totalScenes} cenas únicas`);
            status.log('─────────────────────────────');

            let sceneIndex = 0;
            for (const [sKey, segmentIdsInScene] of Object.entries(sceneGroups)) {
                sceneIndex++;
                const firstId = segmentIdsInScene[0];
                const segIdx = updatedSegments.findIndex(s => s.id === firstId);
                if (segIdx === -1) {
                    setGeneratingIds(prev => prev.filter(gid => !segmentIdsInScene.includes(gid)));
                    continue;
                }

                const seg = updatedSegments[segIdx];

                try {
                    status.log(`🔄 [${sceneIndex}/${totalScenes}] Cena ${sKey} (${segmentIdsInScene.length} seg.)...`);

                    const expandedPrompt = await ImagePromptService.expandPrompt(
                        seg.scriptText,
                        stylePrompt,
                        config
                    );
                    status.log(`   📝 Prompt expandido (${expandedPrompt.length} chars)`);

                    const result = await provider.generate(
                        expandedPrompt,
                        project.stageData.reference?.videoUrl ? 768 : 1024,
                        project.stageData.reference?.videoUrl ? 1376 : 1024,
                        1,
                        apiKey
                    );

                    if (result.urls && result.urls.length > 0) {
                        let imageUrl = result.urls[0];

                        // Salvar imagem em disco para persistência segura
                        try {
                            const firstSegId = segmentIdsInScene[0];
                            const localPath = await saveImageToDisk(imageUrl, project.id, firstSegId);
                            imageUrl = localPath;
                            status.log(`   💾 Imagem salva em disco`);
                        } catch (diskErr) {
                            console.warn('[StageDetails] Falha ao salvar em disco, usando URL direta:', diskErr);
                            // Continua com a URL original se falhar
                        }
                        for (const id of segmentIdsInScene) {
                            const idx = updatedSegments.findIndex(s => s.id === id);
                            if (idx !== -1) {
                                updatedSegments[idx] = {
                                    ...updatedSegments[idx],
                                    assets: {
                                        ...updatedSegments[idx].assets,
                                        imageUrl
                                    }
                                };
                            }
                        }
                        successCount += segmentIdsInScene.length;
                        status.log(`   ✅ Imagem gerada e replicada para ${segmentIdsInScene.length} segmentos`);

                        // ── SALVAMENTO INCREMENTAL: atualizar o projeto a cada cena ──
                        // Isso garante que o Storyboard re-renderize com as novas imagens
                        const partialSubData = { ...subData, segments: [...updatedSegments] };
                        await onUpdate(project.id, {
                            stageData: {
                                ...project.stageData,
                                subtitles: partialSubData,
                                reference: {
                                    ...project.stageData.reference!,
                                    stylePrompt: stylePrompt
                                }
                            }
                        });
                    } else {
                        throw new Error("API retornou sucesso mas sem URLs de imagem.");
                    }
                } catch (err: any) {
                    console.error(`[StageDetails] ❌ Falha na cena ${sKey}:`, err);
                    lastErrorMessage = getFriendlyErrorMessage(err);
                    lastRawError = err.message || String(err);
                    status.log(`   ❌ Erro: ${lastErrorMessage}`);
                } finally {
                    setGeneratingIds(prev => prev.filter(gid => !segmentIdsInScene.includes(gid)));
                }
            }

            status.log('─────────────────────────────');

            if (successCount === safeIds.length) {
                status.log(`🎉 Todas as ${safeIds.length} imagens foram geradas com sucesso!`);
                status.success('Geração Concluída!');
            } else if (successCount > 0) {
                const aiFriendlyMessage = lastRawError
                    ? await interpretErrorWithAI(lastRawError, config)
                    : lastErrorMessage;
                status.log(`⚠️ Geração parcial: ${successCount}/${safeIds.length} imagens`);
                status.log(`💡 ${aiFriendlyMessage}`);
                status.error(`${successCount} de ${safeIds.length} imagens geradas`, 'Geração Parcial');
            } else {
                const aiFriendlyMessage = lastRawError
                    ? await interpretErrorWithAI(lastRawError, config)
                    : lastErrorMessage;
                status.log(`💡 ${aiFriendlyMessage}`);
                status.error(aiFriendlyMessage, 'Falha na Geração');
            }
        } catch (error: any) {
            console.error("[StageDetails] Erro crítico na orquestração:", error);
            status.error(error.message || 'Falha na comunicação com o serviço', 'Erro Inesperado');
        } finally {
            isGeneratingRef.current = false;
        }
    };

    const renderReferenceDetails = (refData: ReferenceStageData) => {
        if (!refData) return null;

        return (
            <div className="p-6 space-y-8">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                    <div className="space-y-6">
                        <section>
                            <h4 className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-3 flex items-center gap-2">
                                <Info size={14} /> Metadados da Origem
                            </h4>
                            <div className="bg-slate-50 rounded-2xl p-4 border border-slate-100 space-y-3">
                                <DetailRow label="Título Original" value={refData.videoTitle} />
                                <DetailRow label="Canal" value={refData.channelName} />
                                <DetailRow label="Vídeo ID" value={refData.videoId} />
                                <div className="pt-2">
                                    <button
                                        onClick={(e) => handleExternalLink(e, refData.videoUrl || `https://youtube.com/watch?v=${refData.videoId}`)}
                                        className="inline-flex items-center gap-2 text-sm font-semibold text-emerald-600 hover:text-emerald-700 transition-colors bg-transparent border-none p-0 cursor-pointer"
                                    >
                                        Ver no YouTube <ExternalLink size={14} />
                                    </button>
                                </div>
                            </div>
                        </section>

                        {refData.apifyRawData && (
                            <section>
                                <h4 className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-3 flex items-center gap-2">
                                    <Code size={14} /> Dados Extras (APIFY)
                                </h4>
                                <div className="bg-slate-900 rounded-2xl p-4 overflow-hidden shadow-inner">
                                    <pre className="text-[11px] text-emerald-400/90 font-mono overflow-auto max-h-[200px] custom-scrollbar">
                                        {JSON.stringify(refData.apifyRawData, null, 2)}
                                    </pre>
                                </div>
                            </section>
                        )}
                    </div>

                    <div>
                        <h4 className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-3">YouTube Player</h4>
                        <div
                            className="relative group rounded-2xl overflow-hidden border border-slate-200 shadow-sm cursor-pointer"
                            onClick={() => setIsVideoPlayerOpen(true)}
                        >
                            <img
                                src={refData.thumbnailUrl}
                                alt="Reference"
                                className="w-full aspect-video object-cover transition-transform duration-500 group-hover:scale-105"
                            />
                            <div className="absolute inset-0 bg-black/20 group-hover:bg-black/40 transition-colors flex items-center justify-center">
                                <div className="w-16 h-16 bg-white/20 backdrop-blur-md rounded-full flex items-center justify-center text-white scale-90 group-hover:scale-100 transition-transform shadow-xl border border-white/30">
                                    <Play size={32} fill="currentColor" className="ml-1" />
                                </div>
                            </div>
                            <div className="absolute bottom-3 right-3 px-2 py-1 bg-black/70 text-white text-[10px] font-bold rounded backdrop-blur-sm">
                                ASSISTIR PREVIEW
                            </div>
                        </div>
                    </div>
                </div>

                <section>
                    <h4 className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-3 flex items-center gap-2">
                        <MessageSquare size={14} /> Transcrição Obtida
                    </h4>
                    <div className="bg-white border border-slate-200 rounded-3xl p-6 shadow-sm">
                        <div className="prose prose-slate max-w-none text-slate-700 leading-relaxed font-serif text-lg whitespace-pre-wrap max-h-[500px] overflow-y-auto pr-4 custom-scrollbar">
                            {refData.transcript || 'Nenhuma transcrição disponível.'}
                        </div>
                    </div>
                </section>

                <VideoPlayerModal
                    isOpen={isVideoPlayerOpen}
                    onClose={() => setIsVideoPlayerOpen(false)}
                    videoId={refData.videoId}
                    videoTitle={refData.videoTitle}
                />
            </div>
        );
    };

    const renderScriptDetails = (scriptData: any) => {
        if (!scriptData) return null;

        return (
            <div className="p-6 space-y-8">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <StatCard icon={Type} label="Contagem" value={`${scriptData.wordCount} palavras`} color="blue" />
                    <StatCard icon={Calendar} label="Gerado em" value={scriptData.generationSnapshot?.generatedAt ? new Date(scriptData.generationSnapshot.generatedAt).toLocaleDateString() : '—'} color="purple" />
                    <StatCard icon={Hash} label="Tags" value={`${scriptData.tags?.length || 0} etiquetas`} color="emerald" />
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <section>
                        <h4 className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-3">Título Otimizado</h4>
                        <div className="bg-emerald-50 rounded-2xl p-4 border border-emerald-100 text-emerald-900 font-bold text-lg">
                            {scriptData.title || 'Sem título gerado'}
                        </div>
                    </section>
                    <section>
                        <h4 className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-3">Sugestão de Thumbnail (Texto)</h4>
                        <div className="bg-orange-50 rounded-2xl p-4 border border-orange-100 text-orange-900 font-bold italic">
                            "{scriptData.thumbText || '—'}"
                        </div>
                    </section>
                </div>

                <section>
                    <div className="flex items-center justify-between mb-3">
                        <h4 className="text-xs font-bold text-slate-400 uppercase tracking-widest">Roteiro Final (Magnético)</h4>
                        <button
                            onClick={() => {
                                if (scriptData.text) {
                                    navigator.clipboard.writeText(scriptData.text);
                                    status.open('📋 Roteiro copiado!');
                                    status.success('Texto copiado para a área de transferência.');
                                }
                            }}
                            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-slate-500 hover:text-emerald-600 hover:bg-emerald-50 rounded-full transition border border-slate-200 hover:border-emerald-200"
                            title="Copiar roteiro"
                        >
                            <Copy size={12} />
                            Copiar
                        </button>
                    </div>
                    <div className="bg-slate-50 border border-slate-200 rounded-3xl p-6 shadow-inner">
                        <div className="text-slate-800 leading-relaxed text-lg whitespace-pre-wrap max-h-[600px] overflow-y-auto pr-4 custom-scrollbar font-serif">
                            {scriptData.text || 'Nenhum roteiro gerado.'}
                        </div>
                    </div>
                </section>

                {/* Botão Exportar SRT para CapCut */}
                {scriptData.text && (
                    <section className="bg-gradient-to-r from-violet-50 to-purple-50 rounded-2xl p-5 border border-violet-200">
                        <div className="flex items-center justify-between">
                            <div>
                                <h4 className="font-bold text-violet-800 flex items-center gap-2">
                                    <Captions size={16} /> Exportar SRT (CapCut)
                                </h4>
                                <p className="text-xs text-violet-500 mt-1">
                                    Gera arquivo .srt para importar no CapCut e usar vozes TTS
                                </p>
                            </div>
                            <button
                                onClick={async () => {
                                    try {
                                        const srtContent = converterParaSRT(scriptData.text);
                                        const stats = getSrtStats(srtContent);
                                        const { invoke } = await import('@tauri-apps/api/core');
                                        const tempDir = await invoke<string>('get_downloads_dir');
                                        const sep = tempDir.includes('\\') ? '\\' : '/';
                                        const safeTitle = (project?.title || 'roteiro').replace(/[^a-zA-Z0-9\s-]/g, '').substring(0, 40).trim().replace(/\s+/g, '_');
                                        const filePath = `${tempDir}${sep}${safeTitle}.srt`;
                                        const encoder = new TextEncoder();
                                        const bytes = encoder.encode(srtContent);
                                        await invoke('write_file', { path: filePath, content: Array.from(bytes) });
                                        status.open('\u2705 SRT Exportado!');
                                        status.log(`\ud83d\udcc4 Arquivo: ${filePath}`);
                                        status.log(`\ud83d\udce6 ${stats.blocos} blocos | Duração estimada: ${stats.duracaoTotal}`);
                                        status.success('SRT salvo com sucesso!', {
                                            label: "Abrir na Pasta",
                                            icon: <FolderOpen size={16} />,
                                            onClick: async () => {
                                                try {
                                                    console.log('[SRT Export] Tentando revelar o arquivo:', filePath);
                                                    const { revealItemInDir } = await import('@tauri-apps/plugin-opener');
                                                    await revealItemInDir(filePath);
                                                } catch (err: any) {
                                                    console.error('[SRT Export] Erro ao abrir pasta:', err);
                                                    alert('Falha ao abrir a pasta: ' + (err?.message || String(err)));
                                                }
                                            }
                                        });
                                    } catch (err: any) {
                                        console.error('[SRT Export]', err);
                                        status.open('\u274c Erro ao Exportar SRT');
                                        status.error(err.message || 'Falha ao salvar arquivo');
                                    }
                                }}
                                className="px-5 py-2.5 bg-violet-600 hover:bg-violet-500 text-white rounded-full font-bold text-sm transition flex items-center gap-2 shadow-lg shadow-violet-200"
                            >
                                <Download size={14} />
                                Exportar .srt
                            </button>
                        </div>
                    </section>
                )}

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <section>
                        <h4 className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-3">Descrição SEO</h4>
                        <div className="bg-slate-50 rounded-2xl p-4 text-sm text-slate-600 max-h-[150px] overflow-y-auto custom-scrollbar">
                            {scriptData.description || '—'}
                        </div>
                    </section>
                    <section>
                        <h4 className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-3">Tags Selecionadas</h4>
                        <div className="flex flex-wrap gap-2">
                            {scriptData.tags?.map((t: string, i: number) => (
                                <span key={i} className="px-3 py-1 bg-slate-100 text-slate-600 rounded-full text-xs font-medium border border-slate-200">
                                    #{t}
                                </span>
                            )) || '—'}
                        </div>
                    </section>
                </div>

                <section className="pt-4 border-t border-slate-100">
                    <h4 className="text-[10px] font-black text-slate-300 uppercase tracking-[0.2em] mb-4">Metadados de Geração (IA)</h4>
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                        <DetailRow label="Modelo" value={scriptData.generationSnapshot?.modelId} compact />
                        <DetailRow label="Provider" value={scriptData.generationSnapshot?.modelProvider} compact />
                        <DetailRow label="Prompt ID" value={scriptData.generationSnapshot?.promptVersionId || 'Padrão'} compact />
                        <DetailRow label="Modo" value={scriptData.mode === 'auto' ? 'Automático' : 'Manual'} compact />
                    </div>
                </section>
            </div>
        );
    };

    const renderAudioDetails = (audioData: AudioStageData) => {
        if (!audioData) return null;

        return (
            <div className="p-6 space-y-8">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <StatCard icon={Mic} label="Provider" value={audioData.provider || 'N/A'} color="emerald" />
                    <StatCard icon={Clock} label="Duração" value={audioData.duration ? `${audioData.duration.toFixed(1)}s` : 'N/A'} color="blue" />
                    <StatCard icon={HardDrive} label="Formato" value="WAV" color="purple" />
                </div>
                <AudioPlayer label="Reprodução do Áudio (WAV)" />
            </div>
        );
    };

    const renderAudioCompressDetails = (compressData: AudioCompressStageData) => {
        if (!compressData) return null;

        return (
            <div className="p-6 space-y-8">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <StatCard icon={Zap} label="Compressão" value={compressData.compressionRatio ? `${compressData.compressionRatio.toFixed(1)}x` : 'N/A'} color="emerald" />
                    <StatCard icon={Clock} label="Duração" value={(compressData.duration || project.stageData.audio?.duration) ? `${(compressData.duration || project.stageData.audio?.duration)?.toFixed(1)}s` : 'N/A'} color="blue" />
                    <StatCard icon={HardDrive} label="Formato" value={compressData.format?.toUpperCase() || 'MP3'} color="purple" />
                </div>

                <section>
                    <h4 className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-3 flex items-center gap-2">
                        <Download size={14} /> Detalhes da Compressão
                    </h4>
                    <div className="bg-slate-50 rounded-2xl p-4 border border-slate-100 space-y-3">
                        <DetailRow label="Tamanho Original" value={compressData.originalSize ? formatBytes(compressData.originalSize) : 'N/A'} />
                        <DetailRow label="Tamanho Comprimido" value={compressData.compressedSize ? formatBytes(compressData.compressedSize) : 'N/A'} />
                        <DetailRow label="Bitrate" value={compressData.bitrate ? `${compressData.bitrate} kbps` : 'N/A'} />
                    </div>
                </section>
                <AudioPlayer label="Reprodução do Áudio (MP3)" />
            </div>
        );
    };

    const AudioPlayer = ({ label }: { label: string }) => (
        <section>
            <h4 className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-3 flex items-center gap-2">
                <Volume2 size={14} /> {label}
            </h4>
            {audioLoading ? (
                <div className="bg-slate-50 rounded-2xl p-6 border border-slate-100 flex items-center justify-center gap-3">
                    <div className="w-5 h-5 border-2 border-emerald-500 border-t-transparent rounded-full animate-spin" />
                    <span className="text-sm text-slate-500">Carregando áudio...</span>
                </div>
            ) : audioBlobUrl ? (
                <div className="bg-slate-50 rounded-2xl p-4 border border-slate-100">
                    <audio controls className="w-full" src={audioBlobUrl} preload="metadata">
                        Seu navegador não suporta o elemento de áudio.
                    </audio>
                </div>
            ) : (
                <div className="bg-amber-50 rounded-2xl p-4 border border-amber-200 text-center">
                    <p className="text-sm text-amber-700">Áudio não encontrado no armazenamento local.</p>
                </div>
            )}
        </section>
    );

    const renderSubtitlesDetails = (subData: SubtitlesStageData) => {
        if (!subData) return null;

        return (
            <div className="p-6 space-y-8">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <StatCard icon={Captions} label="Segmentos" value={`${subData.segmentCount}`} color="emerald" />
                    <StatCard icon={Clock} label="Duração Total" value={`${subData.totalDuration.toFixed(1)}s`} color="blue" />
                    <StatCard icon={Type} label="Palavras" value={`${subData.wordCount || 0}`} color="purple" />
                </div>

                <section>
                    <h4 className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-3 flex items-center gap-1">
                        <AlignLeft size={14} /> Storyboard do Vídeo
                    </h4>
                    <div className="bg-slate-50 border border-slate-200 rounded-3xl p-4 shadow-inner">
                        <Storyboard
                            segments={subData.segments}
                            isEditable={true}
                            onUpdate={handleUpdateSegment}
                            onUpdateImage={handleUpdateSegmentImage}
                            onGenerate={handleGenerateImages}
                            generatingIds={generatingIds}
                            onImageClick={(url: string, text: string) => setImageViewerData({ url, text })}
                            config={config!}
                        />
                    </div>
                </section>

                <section>
                    <button
                        onClick={() => setShowAss(!showAss)}
                        className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-3 flex items-center gap-2 hover:text-slate-600 transition-colors cursor-pointer bg-transparent border-none p-0"
                    >
                        <Code size={14} /> Conteúdo ASS {showAss ? '▼' : '▶'}
                    </button>
                    {showAss && (
                        <div className="bg-slate-900 rounded-2xl p-4 overflow-hidden shadow-inner">
                            <pre className="text-[11px] text-emerald-400/90 font-mono overflow-auto max-h-[300px] custom-scrollbar whitespace-pre-wrap">
                                {subData.assContent}
                            </pre>
                        </div>
                    )}
                </section>
            </div>
        );
    };

    const renderImagesDetails = (subData: SubtitlesStageData) => {
        if (!subData) return null;

        const sceneCount = subData.segments.length;

        return (
            <div className="p-6 space-y-8">
                <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                    <StatCard icon={ImageIcon} label="Cenas Planejadas" value={`${sceneCount}`} color="emerald" />
                    <StatCard icon={Clock} label="Duração" value={`${subData.totalDuration.toFixed(1)}s`} color="blue" />
                    <StatCard icon={Cpu} label="Modelo IA" value={(() => { const m = getImageModel(({ 'FLUX': 'FLUX.1', 'NANO_BANANA': 'Nano Banana', 'IDEOGRAM': 'Ideogram', 'TOGETHER': 'FLUX.1-Together' })[config?.providers.image || 'FLUX'] || 'FLUX.1'); return m ? `${m.label} [${m.badge}]` : config?.providers.image || 'N/A'; })()} color="purple" />
                    <StatCard icon={Zap} label="Otimização" value="Ativa" color="orange" />
                </div>

                <div className="bg-blue-50 border border-blue-100 rounded-2xl p-4 flex items-start gap-3">
                    <div className="p-2 bg-white rounded-lg text-blue-600 shadow-sm shrink-0">
                        <Info size={16} />
                    </div>
                    <div>
                        <p className="text-sm font-bold text-blue-900">Configuração de Geração Global</p>
                        <p className="text-xs text-blue-700 leading-relaxed mt-0.5">
                            O modelo <span className="font-bold underline">{(() => { const m = getImageModel(({ 'FLUX': 'FLUX.1', 'NANO_BANANA': 'Nano Banana', 'IDEOGRAM': 'Ideogram', 'TOGETHER': 'FLUX.1-Together' })[config?.providers.image || 'FLUX'] || 'FLUX.1'); return m ? `${m.label} (${m.badge})` : config?.providers.image; })()}</span> será utilizado para <b>todas as imagens</b> deste projeto.
                            Essa configuração é definida globalmente e não pode ser alterada individualmente por cena para manter a consistência visual.
                        </p>
                    </div>
                </div>

                <section>
                    <h4 className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-3 flex items-center gap-2">
                        <Zap size={14} className="text-purple-500" /> Direção de Arte (Estilo Visual Global)
                    </h4>
                    <div className="bg-white border border-slate-200 rounded-2xl p-4 shadow-sm mb-6">
                        <label className="text-[10px] text-slate-400 font-bold uppercase mb-2 block">Prompt de Estilo / Look & Feel</label>
                        <textarea
                            className="w-full bg-slate-50 border border-slate-200 rounded-xl p-3 text-sm text-slate-700 font-mono focus:border-purple-400 outline-none resize-none"
                            rows={3}
                            placeholder="Descreva o estilo visual (ex: dark cinematic, hyper-realistic, 8k...)"
                            value={stylePrompt}
                            onChange={(e) => setStylePrompt(e.target.value)}
                        />
                        <p className="text-[10px] text-slate-400 mt-2 italic">
                            * Este estilo será combinado com a descrição de cada cena para gerar as imagens.
                        </p>
                    </div>

                    <h4 className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-3 flex items-center gap-2">
                        <ImageIcon size={14} /> Revisão de Roteiro & Descrições de Cena
                    </h4>
                    <div className="bg-slate-50 border border-slate-200 rounded-3xl p-4 shadow-inner">
                        <Storyboard
                            segments={subData.segments}
                            isEditable={true}
                            onUpdate={handleUpdateSegment}
                            onUpdateImage={handleUpdateSegmentImage}
                            onGenerate={handleGenerateImages}
                            generatingIds={generatingIds}
                            onImageClick={(url: string, text: string) => setImageViewerData({ url, text })}
                            config={config!}
                        />
                    </div>
                </section>
            </div>
        );
    };

    const renderImageViewer = () => {
        if (!imageViewerData) return null;

        return (
            <div
                className="fixed inset-0 z-[20000] bg-slate-950/98 backdrop-blur-xl flex flex-col items-center justify-center p-4 md:p-12 animate-in fade-in duration-500"
                onClick={() => setImageViewerData(null)}
            >
                <div
                    className="relative max-w-6xl w-full h-full flex flex-col items-center justify-center gap-6"
                    onClick={e => e.stopPropagation()}
                >
                    {/* Botão Fechar Flutuante */}
                    <button
                        onClick={() => setImageViewerData(null)}
                        className="absolute top-0 -right-4 md:-right-12 text-white/40 hover:text-white transition-all p-3 hover:scale-110 active:scale-95"
                    >
                        <X size={40} strokeWidth={1.5} />
                    </button>

                    {/* Container Principal */}
                    <div className="w-full flex-1 flex flex-col md:flex-row gap-8 items-stretch overflow-hidden">
                        {/* Area da Imagem */}
                        <div className="flex-1 flex items-center justify-center bg-black/40 rounded-[2.5rem] border border-white/5 overflow-hidden shadow-2xl relative group">
                            <img
                                src={imageViewerData.url}
                                alt="Preview Ampliado"
                                className="w-full h-full object-contain p-2"
                            />
                            {/* Overlay de Brilho Sutil */}
                            <div className="absolute inset-0 bg-gradient-to-t from-black/20 to-transparent pointer-events-none" />
                        </div>

                        {/* Painel Lateral de Informações */}
                        <div className="w-full md:w-96 flex flex-col gap-6 animate-in slide-in-from-right-8 duration-700">
                            {/* Card do Texto */}
                            <div className="bg-white/5 border border-white/10 rounded-[2rem] p-8 backdrop-blur-md shadow-xl flex-1 flex flex-col">
                                <h4 className="text-primary text-[11px] font-black uppercase tracking-[0.2em] mb-6 flex items-center gap-3">
                                    <div className="w-1.5 h-1.5 rounded-full bg-primary shadow-[0_0_8px_rgba(20,184,166,0.8)]" />
                                    Narrativa da Cena
                                </h4>
                                <div className="flex-1 overflow-y-auto custom-scrollbar pr-2">
                                    <p className="text-white text-xl md:text-2xl font-light leading-relaxed tracking-wide italic opacity-90 first-letter:text-4xl first-letter:font-bold first-letter:text-primary">
                                        {imageViewerData.text}
                                    </p>
                                </div>
                            </div>

                            {/* Detalhes Técnicos Estilizados */}
                            <div className="bg-slate-900/50 border border-white/5 rounded-[2rem] p-8 backdrop-blur-sm">
                                <div className="flex items-center gap-3 mb-6 text-white/30">
                                    <Cpu size={16} />
                                    <span className="text-[10px] font-bold uppercase tracking-widest text-white/50">
                                        {imageViewerData.url.includes('pexels.com') ? 'Fonte da Imagem' : 'Motor de Geração'}
                                    </span>
                                </div>

                                <div className="space-y-4">
                                    <div className="flex flex-col gap-1">
                                        <span className="text-[10px] text-white/20 uppercase font-black">
                                            {imageViewerData.url.includes('pexels.com') ? 'Banco de Imagens' : 'Modelo Ativo'}
                                        </span>
                                        <span className="text-white font-medium text-lg tracking-tight">
                                            {imageViewerData.url.includes('pexels.com')
                                                ? 'Pexels Stock'
                                                : (() => { const m = getImageModel(({ 'FLUX': 'FLUX.1', 'NANO_BANANA': 'Nano Banana', 'IDEOGRAM': 'Ideogram', 'TOGETHER': 'FLUX.1-Together' })[config?.providers.image || 'FLUX'] || 'FLUX.1'); return m ? `${m.label} [${m.badge}]` : 'N/A'; })()}
                                        </span>
                                    </div>
                                    <div className="w-full h-px bg-white/5" />
                                    <div className="flex items-center justify-between">
                                        <span className="text-xs text-white/30">Engine</span>
                                        <span className="text-[10px] px-2 py-0.5 bg-primary/10 text-primary border border-primary/20 rounded-full font-bold">
                                            {imageViewerData.url.includes('pexels.com') ? 'Pexels API' : (() => { const m = getImageModel(({ 'FLUX': 'FLUX.1', 'NANO_BANANA': 'Nano Banana', 'IDEOGRAM': 'Ideogram', 'TOGETHER': 'FLUX.1-Together' })[config?.providers.image || 'FLUX'] || 'FLUX.1'); return m?.providerGroup || 'RunWare AI'; })()}
                                        </span>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Hint de Teclado/Interação */}
                    <p className="text-white/20 text-[10px] font-medium tracking-widest uppercase">
                        Clique fora para fechar ou pressione Esc
                    </p>
                </div>
            </div>
        );
    };

    const renderVideoDetails = (videoData: VideoStageData) => {
        if (!videoData) return null;

        const fileSizeDisplay = videoData.fileUrl ? 'Salvo no disco' : 'N/A';
        const fileName = videoData.fileUrl?.split(/[\\/]/).pop() || 'N/A';

        const handleOpenFolder = async () => {
            if (!videoData.fileUrl) return;
            try {
                // Reveal the video file in the containing folder
                const { revealItemInDir } = await import('@tauri-apps/plugin-opener');
                await revealItemInDir(videoData.fileUrl);
            } catch (err) {
                console.error('Failed to open folder:', err);
                alert(`Caminho do vídeo:\n${videoData.fileUrl}`);
            }
        };

        return (
            <div className="p-6 space-y-8">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <StatCard icon={Film} label="Resolução" value={videoData.resolution || 'N/A'} color="emerald" />
                    <StatCard icon={Clock} label="Duração" value={videoData.duration ? `${videoData.duration.toFixed(1)}s` : 'N/A'} color="blue" />
                    <StatCard icon={HardDrive} label="Formato" value="MP4 (H.264)" color="purple" />
                </div>

                {/* Video Player */}
                {videoData.fileUrl && (
                    <section>
                        <h4 className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-3 flex items-center gap-2">
                            <Play size={14} /> Player do Vídeo Final
                        </h4>
                        <div className="bg-black rounded-2xl overflow-hidden border border-slate-200 shadow-lg">
                            <video
                                controls
                                className="w-full max-h-[480px]"
                                src={convertFileSrc(videoData.fileUrl)}
                                preload="metadata"
                            >
                                Seu navegador não suporta o elemento de vídeo.
                            </video>
                        </div>
                    </section>
                )}

                {/* File Details */}
                <section>
                    <h4 className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-3 flex items-center gap-2">
                        <Download size={14} /> Detalhes do Arquivo
                    </h4>
                    <div className="bg-slate-50 rounded-2xl p-4 border border-slate-100 space-y-3">
                        <DetailRow label="Arquivo" value={fileName} />
                        <DetailRow label="Caminho" value={videoData.fileUrl || 'N/A'} />
                        <DetailRow label="Status" value={fileSizeDisplay} />
                    </div>
                </section>

                {/* Action Button */}
                {videoData.fileUrl && (
                    <div className="flex gap-3">
                        <button
                            onClick={handleOpenFolder}
                            className="flex-1 flex items-center justify-center gap-2 px-4 py-3 bg-emerald-50 text-emerald-700 font-semibold rounded-2xl border border-emerald-200 hover:bg-emerald-100 transition-all active:scale-[0.98]"
                        >
                            <FolderOpen size={18} />
                            Abrir Pasta do Vídeo
                        </button>
                    </div>
                )}
            </div>
        );
    };

    const renderContent = () => {
        switch (stage) {
            case PipelineStage.REFERENCE:
                return renderReferenceDetails(project.stageData.reference as ReferenceStageData);
            case PipelineStage.SCRIPT:
                return renderScriptDetails(project.stageData.script);
            case PipelineStage.AUDIO:
                return renderAudioDetails(project.stageData.audio as AudioStageData);
            case PipelineStage.AUDIO_COMPRESS:
                return renderAudioCompressDetails(project.stageData.audio_compress as AudioCompressStageData);
            case PipelineStage.SUBTITLES:
                return renderSubtitlesDetails(project.stageData.subtitles as SubtitlesStageData);
            case PipelineStage.IMAGES:
                return renderImagesDetails(project.stageData.subtitles as SubtitlesStageData);
            case PipelineStage.VIDEO:
                return renderVideoDetails(project.stageData.video as VideoStageData);
            default:
                return (
                    <div className="p-8 text-center text-slate-500">
                        <Info className="w-12 h-12 mx-auto mb-3 opacity-20" />
                        <p>Detalhes ainda não disponíveis para este estágio.</p>
                    </div>
                );
        }
    };

    const formatBytes = (bytes: number) => {
        if (bytes < 1024) return `${bytes} B`;
        if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
        return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
    };

    return (
        <>
            <div className="fixed inset-0 z-[10000] flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4" onClick={onClose}>
                <div
                    className="bg-white rounded-3xl shadow-2xl w-full max-w-4xl max-h-[90vh] flex flex-col overflow-hidden animate-in fade-in zoom-in duration-200"
                    onClick={e => e.stopPropagation()}
                >
                    {/* Header */}
                    <div className="px-6 py-5 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
                        <div className="flex items-center gap-4">
                            <div className="w-12 h-12 rounded-2xl flex items-center justify-center shadow-sm" style={{ backgroundColor: meta.bgColor, color: meta.color }}>
                                {stage === PipelineStage.REFERENCE ? <BookOpen size={24} /> : <FileText size={24} />}
                            </div>
                            <div>
                                <h3 className="text-xl font-bold text-slate-900">Detalhes: {meta.label}</h3>
                                <p className="text-sm text-slate-500 flex items-center gap-2">
                                    <span className="font-medium text-slate-700">{project.title}</span>
                                    <span className="w-1 h-1 rounded-full bg-slate-300" />
                                    <span>{new Date(project.updatedAt).toLocaleDateString()}</span>
                                </p>
                            </div>
                        </div>
                        <button
                            onClick={onClose}
                            className="p-2.5 rounded-2xl hover:bg-slate-200/50 text-slate-400 transition-colors"
                        >
                            <X size={20} />
                        </button>
                    </div>

                    {/* Content Area */}
                    <div className="flex-1 overflow-y-auto custom-scrollbar bg-white">
                        {renderContent()}
                    </div>

                    {/* Footer */}
                    <div className="px-6 py-4 bg-slate-50 border-t border-slate-100 flex items-center justify-between">
                        <div className="flex items-center gap-2 text-[11px] font-bold text-slate-400 uppercase tracking-widest">
                            <Cpu size={14} className="text-purple-400" />
                            {(() => {
                                if (stage === PipelineStage.IMAGES || stage === PipelineStage.THUMBNAIL) {
                                    return (
                                        <>
                                            Modelo de Imagem: <span className="text-slate-900">{(() => { const m = getImageModel(({ 'FLUX': 'FLUX.1', 'NANO_BANANA': 'Nano Banana', 'IDEOGRAM': 'Ideogram', 'TOGETHER': 'FLUX.1-Together' })[config?.providers.image || 'FLUX'] || 'FLUX.1'); return m ? `${m.label} (${m.badge})` : 'N/A'; })()}</span>
                                        </>
                                    );
                                }
                                if (stage === PipelineStage.AUDIO || stage === PipelineStage.AUDIO_COMPRESS) {
                                    return (
                                        <>
                                            Modelo de Áudio: <span className="text-slate-900">{config?.providers.tts === 'ELEVENLABS' ? 'ElevenLabs' : 'Gemini Voice'}</span>
                                        </>
                                    );
                                }
                                if (stage === PipelineStage.SCRIPT || stage === PipelineStage.REFERENCE) {
                                    return (
                                        <>
                                            Modelo de Script: <span className="text-slate-900">{config?.scriptingModel || config?.providers.scripting || 'Gemini'}</span>
                                        </>
                                    );
                                }
                                if (stage === PipelineStage.VIDEO) {
                                    return (
                                        <>
                                            Motor de Renderização: <span className="text-slate-900">FFmpeg Nativo (H.264 + AAC)</span>
                                        </>
                                    );
                                }
                                return (
                                    <>
                                        Sistema Ativado: <span className="text-slate-900">Pipeline Alpha</span>
                                    </>
                                );
                            })()}
                        </div>
                        <button
                            onClick={onClose}
                            className="px-6 py-2.5 bg-slate-900 text-white font-semibold rounded-2xl hover:bg-slate-800 transition-all shadow-md active:scale-95"
                        >
                            Fechar Visualização
                        </button>
                    </div>
                </div>
            </div >
            {renderImageViewer()}
        </>
    );
}


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
                <p className="text-base font-bold leading-none">{value}</p>
            </div>
        </div>
    );
}
