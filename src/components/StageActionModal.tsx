import React, { useState } from 'react';
import { PipelineStage, STAGE_META, PIPELINE_STAGES_ORDER } from '../types';
import { X, Zap, Upload, ChevronRight, FileText, AlertTriangle } from 'lucide-react';

interface StageActionModalProps {
    isOpen: boolean;
    onClose: () => void;
    currentStage: PipelineStage;
    projectCount: number;
    onSubmitAuto: () => void;
    onSubmitManual: (input: string | File) => void;
}

export default function StageActionModal({
    isOpen,
    onClose,
    currentStage,
    projectCount,
    onSubmitAuto,
    onSubmitManual,
}: StageActionModalProps) {
    const [mode, setMode] = useState<'auto' | 'manual'>('auto');
    const [manualText, setManualText] = useState('');
    const [manualFile, setManualFile] = useState<File | null>(null);

    if (!isOpen) return null;

    const currentMeta = STAGE_META[currentStage];
    const nextIdx = PIPELINE_STAGES_ORDER.indexOf(currentStage) + 1;
    const nextStage = PIPELINE_STAGES_ORDER[nextIdx];
    const nextMeta = nextStage ? STAGE_META[nextStage] : null;

    if (!nextMeta) return null;

    // Determine what type of manual input this stage expects
    const stageInputType = getManualInputType(nextStage);

    const handleSubmit = () => {
        if (mode === 'auto') {
            onSubmitAuto();
        } else {
            if (stageInputType === 'file' && manualFile) {
                onSubmitManual(manualFile);
            } else if (manualText.trim()) {
                onSubmitManual(manualText.trim());
            }
        }
        setManualText('');
        setManualFile(null);
    };

    const isSubmitDisabled = mode === 'manual'
        && (stageInputType === 'file' ? !manualFile : !manualText.trim());

    return (
        <div className="fixed inset-0 z-[9998] flex items-center justify-center bg-black/30 backdrop-blur-sm" onClick={onClose}>
            <div
                className="bg-white rounded-2xl shadow-2xl border border-[#E2E8F0] w-full max-w-lg mx-4 overflow-hidden"
                onClick={e => e.stopPropagation()}
                style={{ animation: 'fade-in 0.2s ease-out' }}
            >
                {/* Header */}
                <div className="flex items-center justify-between px-5 py-4 border-b border-[#E2E8F0]">
                    <div className="flex items-center gap-3">
                        <div className="flex items-center gap-1.5 text-xs font-medium">
                            <span
                                className="px-2 py-0.5 rounded-md"
                                style={{ backgroundColor: currentMeta.bgColor, color: currentMeta.color }}
                            >
                                {currentMeta.label}
                            </span>
                            <ChevronRight className="w-3 h-3 text-[#94A3B8]" />
                            <span
                                className="px-2 py-0.5 rounded-md"
                                style={{ backgroundColor: nextMeta.bgColor, color: nextMeta.color }}
                            >
                                {nextMeta.label}
                            </span>
                        </div>
                    </div>
                    <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-400">
                        <X className="w-4 h-4" />
                    </button>
                </div>

                {/* Mode Switcher */}
                <div className="px-5 pt-4">
                    <div className="flex gap-2 p-1 bg-[#F1F5F9] rounded-xl">
                        <button
                            onClick={() => setMode('auto')}
                            className={`flex-1 flex items-center justify-center gap-2 py-2.5 rounded-lg text-xs font-semibold transition-all ${mode === 'auto'
                                    ? 'bg-white text-primary shadow-sm'
                                    : 'text-[#64748B] hover:text-[#0F172A]'
                                }`}
                        >
                            <Zap className="w-3.5 h-3.5" />
                            Automático
                        </button>
                        <button
                            onClick={() => setMode('manual')}
                            className={`flex-1 flex items-center justify-center gap-2 py-2.5 rounded-lg text-xs font-semibold transition-all ${mode === 'manual'
                                    ? 'bg-white text-primary shadow-sm'
                                    : 'text-[#64748B] hover:text-[#0F172A]'
                                }`}
                        >
                            <Upload className="w-3.5 h-3.5" />
                            Manual
                        </button>
                    </div>
                </div>

                {/* Content */}
                <div className="px-5 py-4">
                    {mode === 'auto' ? (
                        <div className="text-center py-4">
                            <Zap className="w-8 h-8 mx-auto mb-3" style={{ color: nextMeta.color }} />
                            <p className="text-sm font-medium text-[#0F172A] mb-1">
                                Processar {projectCount} {projectCount === 1 ? 'projeto' : 'projetos'} automaticamente
                            </p>
                            <p className="text-xs text-[#64748B]">
                                A API configurada será usada para avançar para <strong>{nextMeta.label}</strong>
                            </p>
                        </div>
                    ) : (
                        <div>
                            <p className="text-xs text-[#64748B] mb-3">
                                {stageInputType === 'file'
                                    ? `Faça upload do arquivo para avançar para ${nextMeta.label}`
                                    : `Cole o conteúdo para avançar para ${nextMeta.label}`
                                }
                            </p>

                            {stageInputType === 'file' ? (
                                <label className="flex flex-col items-center justify-center h-32 border-2 border-dashed border-[#E2E8F0] rounded-xl cursor-pointer hover:border-primary/50 hover:bg-[#F8FAFC] transition-colors">
                                    <Upload className="w-6 h-6 text-[#94A3B8] mb-2" />
                                    <span className="text-xs text-[#64748B]">
                                        {manualFile ? manualFile.name : 'Clique ou arraste o arquivo'}
                                    </span>
                                    <input
                                        type="file"
                                        className="hidden"
                                        accept={getAcceptTypes(nextStage)}
                                        onChange={e => setManualFile(e.target.files?.[0] || null)}
                                    />
                                </label>
                            ) : (
                                <textarea
                                    className="w-full h-32 bg-[#F8FAFC] border border-[#E2E8F0] rounded-xl px-3 py-2.5 text-sm text-[#0F172A] placeholder:text-[#94A3B8] resize-none focus:border-primary focus:ring-1 focus:ring-primary/20 transition-colors"
                                    placeholder={getPlaceholder(nextStage)}
                                    value={manualText}
                                    onChange={e => setManualText(e.target.value)}
                                />
                            )}
                        </div>
                    )}
                </div>

                {/* Footer */}
                <div className="flex items-center justify-between px-5 py-3 border-t border-[#E2E8F0] bg-[#F8FAFC]">
                    <button
                        onClick={onClose}
                        className="px-4 py-2 text-xs font-medium text-[#64748B] hover:text-[#0F172A] transition-colors"
                    >
                        Cancelar
                    </button>
                    <button
                        onClick={handleSubmit}
                        disabled={isSubmitDisabled}
                        className="flex items-center gap-2 px-5 py-2.5 text-xs font-semibold text-white bg-primary hover:opacity-90 rounded-xl transition-all disabled:opacity-40"
                    >
                        {mode === 'auto' ? <Zap className="w-3.5 h-3.5" /> : <Upload className="w-3.5 h-3.5" />}
                        {mode === 'auto' ? 'Iniciar Processamento' : 'Enviar e Avançar'}
                    </button>
                </div>
            </div>
        </div>
    );
}

function getManualInputType(stage: PipelineStage): 'text' | 'file' {
    switch (stage) {
        case PipelineStage.AUDIO:
        case PipelineStage.AUDIO_COMPRESS:
        case PipelineStage.VIDEO:
        case PipelineStage.THUMBNAIL:
            return 'file';
        default:
            return 'text';
    }
}

function getAcceptTypes(stage: PipelineStage): string {
    switch (stage) {
        case PipelineStage.AUDIO:
        case PipelineStage.AUDIO_COMPRESS:
            return 'audio/*,.mp3,.wav,.m4a,.ogg';
        case PipelineStage.VIDEO:
            return 'video/*,.mp4,.webm,.mov';
        case PipelineStage.THUMBNAIL:
            return 'image/*,.png,.jpg,.jpeg,.webp';
        default:
            return '*/*';
    }
}

function getPlaceholder(stage: PipelineStage): string {
    switch (stage) {
        case PipelineStage.SCRIPT:
            return 'Cole o roteiro reescrito aqui...';
        case PipelineStage.SUBTITLES:
            return 'Cole o conteúdo SRT das legendas aqui...';
        case PipelineStage.REFERENCE:
            return 'Cole a transcrição da referência aqui...';
        default:
            return 'Cole o conteúdo aqui...';
    }
}
