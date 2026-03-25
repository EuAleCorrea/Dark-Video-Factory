import React from 'react';
import { VideoProject, StageMeta, PipelineStage, StageDataMap, PIPELINE_STAGES_ORDER } from '../types';
import {
    CheckCircle, AlertTriangle, Loader2, Clock, CheckCircle2, Circle, Hourglass,
    Trash2, BookOpen, FileText, Mic, Volume2, Subtitles, ImageIcon, Film, Upload, ImagePlus, Send, Layout
} from 'lucide-react';

interface ProjectCardProps {
    project: VideoProject;
    stageMeta: StageMeta;
    isSelected: boolean;
    onToggleSelect: () => void;
    onClick: () => void;
    onDelete: () => void;
    onStageClick?: (project: VideoProject, stage: PipelineStage) => void;
    onViewError?: (project: VideoProject) => void;
}

const STATUS_CONFIG: Record<string, { icon: any; label: string; color: string; bg: string }> = {
    ready: { icon: CheckCircle, label: 'Pronto', color: '#10B981', bg: 'rgba(16, 185, 129, 0.12)' },
    pending: { icon: Hourglass, label: 'Pendente', color: '#F59E0B', bg: 'rgba(245, 158, 11, 0.12)' },
    processing: { icon: Loader2, label: 'Processando', color: '#8B5CF6', bg: 'rgba(139, 92, 246, 0.12)' },
    waiting: { icon: Clock, label: 'Aguardando', color: '#64748B', bg: 'rgba(100, 116, 139, 0.12)' },
    error: { icon: AlertTriangle, label: 'Erro', color: '#EF4444', bg: 'rgba(239, 68, 68, 0.12)' },
    review: { icon: CheckCircle, label: '✅ Pronto', color: '#10B981', bg: 'rgba(16, 185, 129, 0.12)' },
};

// Mapping of PipelineStage to the StageDataMap key
const STAGE_DATA_KEY: Record<PipelineStage, keyof StageDataMap> = {
    [PipelineStage.REFERENCE]: 'reference',
    [PipelineStage.SCRIPT]: 'script',
    [PipelineStage.AUDIO]: 'audio',
    [PipelineStage.SCENES]: 'scenes',
    [PipelineStage.AUDIO_COMPRESS]: 'audio_compress',
    [PipelineStage.SUBTITLES]: 'subtitles',
    [PipelineStage.IMAGES]: 'images',
    [PipelineStage.VIDEO]: 'video',
    [PipelineStage.PUBLISH_YT]: 'publish_yt',
    [PipelineStage.THUMBNAIL]: 'thumbnail',
    [PipelineStage.PUBLISH_THUMB]: 'publish_thumb',
};

// Icon + tooltip per stage
const STAGE_ICON_MAP: Record<PipelineStage, { icon: any; tooltip: string }> = {
    [PipelineStage.REFERENCE]: { icon: BookOpen, tooltip: 'Referência' },
    [PipelineStage.SCRIPT]: { icon: FileText, tooltip: 'Roteiro' },
    [PipelineStage.AUDIO]: { icon: Mic, tooltip: 'Audio e Imagem' },
    [PipelineStage.SCENES]: { icon: Layout, tooltip: 'Cenas' },
    [PipelineStage.AUDIO_COMPRESS]: { icon: Volume2, tooltip: 'Compressão' },
    [PipelineStage.SUBTITLES]: { icon: Subtitles, tooltip: 'Legendas' },
    [PipelineStage.IMAGES]: { icon: ImageIcon, tooltip: 'Imagens (Obsoleto)' },
    [PipelineStage.VIDEO]: { icon: Film, tooltip: 'Vídeo' },
    [PipelineStage.PUBLISH_YT]: { icon: Upload, tooltip: 'Publicar YT' },
    [PipelineStage.THUMBNAIL]: { icon: ImagePlus, tooltip: 'Thumbnail' },
    [PipelineStage.PUBLISH_THUMB]: { icon: Send, tooltip: 'Publicar Thumb' },
};

/** Checks if the current stage has completed data */
function hasStageData(project: VideoProject): boolean {
    const key = STAGE_DATA_KEY[project.currentStage];
    if (!key) return false;
    const data = project.stageData[key];
    if (data === undefined || data === null) return false;

    // Para REFERENCE: precisa ter transcript preenchido
    if (key === 'reference') {
        const ref = data as StageDataMap['reference'] | undefined;
        return !!ref?.transcript && ref.transcript.trim().length > 0;
    }

    return true;
}

/** Computes the effective display status */
function getEffectiveStatus(project: VideoProject): string {
    // If processing, error, or review — always show as-is
    if (project.status === 'processing' || project.status === 'error' || project.status === 'review') {
        return project.status;
    }
    // For 'ready' or 'waiting': check if the current stage actually has data
    return hasStageData(project) ? 'ready' : 'pending';
}

/** Returns the stages that have been completed (before currentStage) */
function getCompletedStages(project: VideoProject): PipelineStage[] {
    const currentIdx = PIPELINE_STAGES_ORDER.indexOf(project.currentStage);
    if (currentIdx <= 0) return [];
    return PIPELINE_STAGES_ORDER.slice(0, currentIdx);
}

export default function ProjectCard({ project, stageMeta, isSelected, onToggleSelect, onClick, onDelete, onStageClick, onViewError }: ProjectCardProps) {
    const effectiveStatus = getEffectiveStatus(project);
    const statusConf = STATUS_CONFIG[effectiveStatus] || STATUS_CONFIG.waiting;
    const StatusIcon = statusConf.icon;
    const thumbnail = project.stageData.reference?.thumbnailUrl;
    const completedStages = getCompletedStages(project);

    const currentStageIdx = PIPELINE_STAGES_ORDER.indexOf(project.currentStage);
    const hasReachedAudio = currentStageIdx >= PIPELINE_STAGES_ORDER.indexOf(PipelineStage.SCENES);
    
    let audioCounter = null;
    if (hasReachedAudio && project.stageData.scenes?.scenes) {
        const scenes = project.stageData.scenes.scenes;
        const total = scenes.length;
        if (total > 0) {
            const withAudio = scenes.filter(s => !!s.audioUrl).length;
            audioCounter = { withAudio, total };
        }
    }

    return (
        <div
            className={`
        relative border rounded-xl p-4 cursor-pointer transition-all duration-200
        hover:shadow-md hover:-translate-y-0.5 group bg-white
        ${isSelected
                    ? 'border-primary shadow-sm ring-2 ring-primary/20'
                    : 'border-theme hover:border-theme-hover'
                }
      `}
            onClick={onClick}
        >
            {/* Selection Circle */}
            <div
                onClick={(e) => { e.stopPropagation(); onToggleSelect(); }}
                className={`absolute top-2 right-2 z-10 p-1.5 rounded-full backdrop-blur-md transition-all cursor-pointer
                    ${isSelected ? 'bg-primary text-white' : 'bg-black/30 text-white/50 hover:bg-black/50 hover:text-white'}
                `}
            >
                {isSelected ? <CheckCircle2 size={18} fill="currentColor" className="text-white" /> : <Circle size={18} />}
            </div>

            {/* Thumbnail */}
            {thumbnail && (
                <div className="mb-3 rounded-lg overflow-hidden border border-theme">
                    <img
                        src={thumbnail}
                        alt=""
                        className="w-full aspect-video object-cover"
                        loading="lazy"
                    />
                </div>
            )}

            {/* Title */}
            <h4 className="text-base font-semibold text-theme-primary line-clamp-2 leading-snug mb-2.5 pl-7">
                {project.title}
            </h4>

            {/* Footer: Status + Date */}
            <div className="flex items-center justify-between">
                <div
                    className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-sm font-medium cursor-help"
                    style={{ backgroundColor: statusConf.bg, color: statusConf.color }}
                    onClick={(e) => {
                        if (project.status === 'error' && onViewError) {
                            e.stopPropagation();
                            onViewError(project);
                        }
                    }}
                >
                    <StatusIcon className={`w-3.5 h-3.5 ${project.status === 'processing' ? 'animate-spin' : ''}`} />
                    {project.status === 'processing' && project.errorMessage ? project.errorMessage : statusConf.label}
                </div>

                <span className="text-sm text-theme-placeholder">
                    {new Date(project.updatedAt).toLocaleDateString('pt-BR')}
                </span>
            </div>

            {/* Stage Icons Bar — abaixo da data */}
            <div className="flex items-center gap-1.5 mt-2.5 pt-2.5 border-t border-theme">
                {/* Lixeira (sempre presente) */}
                <button
                    onClick={(e) => { e.stopPropagation(); onDelete(); }}
                    className="p-1.5 rounded-md text-theme-muted hover:text-red-500 hover:bg-red-50 transition-colors"
                    title="Remover do pipeline"
                >
                    <Trash2 size={15} />
                </button>

                {/* Separador */}
                {completedStages.length > 0 && (
                    <div className="w-px h-4" style={{ backgroundColor: 'var(--df-border)' }} />
                )}

                {/* Ícones das etapas concluídas */}
                {completedStages.map((stage) => {
                    const stageInfo = STAGE_ICON_MAP[stage];
                    const StageIcon = stageInfo.icon;
                    return (
                        <button
                            key={stage}
                            onClick={(e) => {
                                e.stopPropagation();
                                if (onStageClick) onStageClick(project, stage);
                            }}
                            className="p-1.5 rounded-md text-emerald-500 bg-emerald-50 hover:bg-emerald-100 transition-colors"
                            title={stageInfo.tooltip}
                        >
                            <StageIcon size={14} />
                        </button>
                    );
                })}

                {/* Badge de progresso de Áudio / Botão Avançar */}
                {audioCounter && (
                    <div className="ml-auto flex items-center gap-2">
                        {project.currentStage === PipelineStage.AUDIO && audioCounter.withAudio === audioCounter.total ? (
                            <button
                                onClick={(e) => {
                                    e.stopPropagation();
                                    if (onStageClick) onStageClick(project, PipelineStage.SUBTITLES);
                                }}
                                className="flex items-center gap-1.5 px-3 py-1 rounded-lg bg-emerald-600 text-white border border-emerald-500 hover:bg-emerald-700 transition-all shadow-sm animate-pulse"
                                title="Áudios completos! Clique para gerar legendas."
                            >
                                <Subtitles size={12} />
                                <span className="text-[10px] font-bold uppercase tracking-wider">Avançar</span>
                            </button>
                        ) : (
                            <div 
                                className="flex items-center gap-1.5 px-2 py-0.5 rounded bg-purple-50 text-purple-600 border border-purple-100"
                                title={`${audioCounter.withAudio} de ${audioCounter.total} áudios gerados`}
                            >
                                <Mic size={10} />
                                <span className="text-[10px] font-bold tracking-wider uppercase">
                                    Áudios {audioCounter.withAudio}/{audioCounter.total}
                                </span>
                            </div>
                        )}
                    </div>
                )}
            </div>

            {/* Error message */}
            {project.status === 'error' && project.errorMessage && (
                <div
                    className="mt-2 text-sm text-red-500 hover:text-red-600 cursor-pointer transition-colors group/error"
                    onClick={(e) => {
                        e.stopPropagation();
                        if (onViewError) onViewError(project);
                    }}
                >
                    <p className="line-clamp-2 leading-tight italic">
                        {project.errorMessage}
                    </p>
                    <span className="text-[10px] font-bold uppercase mt-1.5 flex items-center gap-1 opacity-60 group-hover/error:opacity-100 transition-opacity">
                        <AlertTriangle size={10} /> Ver log completo e opções →
                    </span>
                </div>
            )}
        </div>
    );
}
