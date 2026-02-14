import React from 'react';
import { VideoProject, StageMeta, PipelineStage, StageDataMap, PIPELINE_STAGES_ORDER } from '../types';
import {
    CheckCircle, AlertTriangle, Loader2, Clock, CheckCircle2, Circle, Hourglass,
    Trash2, BookOpen, FileText, Mic, Volume2, Subtitles, ImageIcon, Film, Upload, ImagePlus, Send
} from 'lucide-react';

interface ProjectCardProps {
    project: VideoProject;
    stageMeta: StageMeta;
    isSelected: boolean;
    onToggleSelect: () => void;
    onClick: () => void;
    onDelete: () => void;
}

const STATUS_CONFIG: Record<string, { icon: any; label: string; color: string; bg: string }> = {
    ready: { icon: CheckCircle, label: 'Pronto', color: '#10B981', bg: '#ECFDF5' },
    pending: { icon: Hourglass, label: 'Pendente', color: '#F59E0B', bg: '#FFFBEB' },
    processing: { icon: Loader2, label: 'Processando', color: '#8B5CF6', bg: '#F5F3FF' },
    waiting: { icon: Clock, label: 'Aguardando', color: '#64748B', bg: '#F1F5F9' },
    error: { icon: AlertTriangle, label: 'Erro', color: '#EF4444', bg: '#FEF2F2' },
    review: { icon: CheckCircle, label: '✅ Pronto', color: '#10B981', bg: '#ECFDF5' },
};

// Mapping of PipelineStage to the StageDataMap key
const STAGE_DATA_KEY: Record<PipelineStage, keyof StageDataMap> = {
    [PipelineStage.REFERENCE]: 'reference',
    [PipelineStage.SCRIPT]: 'script',
    [PipelineStage.AUDIO]: 'audio',
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
    [PipelineStage.AUDIO]: { icon: Mic, tooltip: 'Áudio' },
    [PipelineStage.AUDIO_COMPRESS]: { icon: Volume2, tooltip: 'Compressão' },
    [PipelineStage.SUBTITLES]: { icon: Subtitles, tooltip: 'Legendas' },
    [PipelineStage.IMAGES]: { icon: ImageIcon, tooltip: 'Imagens' },
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

export default function ProjectCard({ project, stageMeta, isSelected, onToggleSelect, onClick, onDelete }: ProjectCardProps) {
    const effectiveStatus = getEffectiveStatus(project);
    const statusConf = STATUS_CONFIG[effectiveStatus] || STATUS_CONFIG.waiting;
    const StatusIcon = statusConf.icon;
    const thumbnail = project.stageData.reference?.thumbnailUrl;
    const completedStages = getCompletedStages(project);

    return (
        <div
            className={`
        relative bg-white border rounded-xl p-4 cursor-pointer transition-all duration-200
        hover:shadow-md hover:-translate-y-0.5 group
        ${isSelected
                    ? 'border-primary shadow-sm ring-2 ring-primary/20'
                    : 'border-[#E2E8F0] hover:border-[#CBD5E1]'
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
                <div className="mb-3 rounded-lg overflow-hidden border border-gray-100">
                    <img
                        src={thumbnail}
                        alt=""
                        className="w-full aspect-video object-cover"
                        loading="lazy"
                    />
                </div>
            )}

            {/* Title */}
            <h4 className="text-base font-semibold text-[#0F172A] line-clamp-2 leading-snug mb-2.5 pl-7">
                {project.title}
            </h4>

            {/* Footer: Status + Date */}
            <div className="flex items-center justify-between">
                <div
                    className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-sm font-medium"
                    style={{ backgroundColor: statusConf.bg, color: statusConf.color }}
                >
                    <StatusIcon className={`w-3.5 h-3.5 ${project.status === 'processing' ? 'animate-spin' : ''}`} />
                    {statusConf.label}
                </div>

                <span className="text-sm text-[#94A3B8]">
                    {new Date(project.updatedAt).toLocaleDateString('pt-BR')}
                </span>
            </div>

            {/* Stage Icons Bar — abaixo da data */}
            <div className="flex items-center gap-1.5 mt-2.5 pt-2.5 border-t border-gray-100">
                {/* Lixeira (sempre presente) */}
                <button
                    onClick={(e) => { e.stopPropagation(); onDelete(); }}
                    className="p-1.5 rounded-md text-gray-400 hover:text-red-500 hover:bg-red-50 transition-colors"
                    title="Remover do pipeline"
                >
                    <Trash2 size={15} />
                </button>

                {/* Separador */}
                {completedStages.length > 0 && (
                    <div className="w-px h-4 bg-gray-200" />
                )}

                {/* Ícones das etapas concluídas */}
                {completedStages.map((stage) => {
                    const stageInfo = STAGE_ICON_MAP[stage];
                    const StageIcon = stageInfo.icon;
                    return (
                        <button
                            key={stage}
                            onClick={(e) => { e.stopPropagation(); /* TODO: popup de detalhamento */ }}
                            className="p-1.5 rounded-md text-emerald-500 bg-emerald-50 hover:bg-emerald-100 transition-colors"
                            title={stageInfo.tooltip}
                        >
                            <StageIcon size={14} />
                        </button>
                    );
                })}
            </div>

            {/* Error message */}
            {project.status === 'error' && project.errorMessage && (
                <p className="mt-2 text-sm text-red-500 line-clamp-1">{project.errorMessage}</p>
            )}
        </div>
    );
}
