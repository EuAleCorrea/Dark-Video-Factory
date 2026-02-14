import React from 'react';
import { PipelineStage, STAGE_META, PIPELINE_STAGES_ORDER } from '../types';
import { Zap, Upload, Trash2, ChevronRight, X } from 'lucide-react';

interface BatchActionBarProps {
    selectedCount: number;
    selectedStage: PipelineStage | null;
    onAdvanceAuto: () => void;
    onAdvanceManual: () => void;
    onDelete: () => void;
    onClearSelection: () => void;
}

export default function BatchActionBar({
    selectedCount,
    selectedStage,
    onAdvanceAuto,
    onAdvanceManual,
    onDelete,
    onClearSelection,
}: BatchActionBarProps) {
    if (selectedCount === 0) return null;

    const nextStage = selectedStage
        ? PIPELINE_STAGES_ORDER[PIPELINE_STAGES_ORDER.indexOf(selectedStage) + 1]
        : null;
    const nextMeta = nextStage ? STAGE_META[nextStage] : null;
    const currentMeta = selectedStage ? STAGE_META[selectedStage] : null;
    const isLastStage = selectedStage === PipelineStage.PUBLISH_THUMB;

    return (
        <div
            className="fixed bottom-0 left-0 right-0 z-50 border-t border-[#E2E8F0] bg-white/95 backdrop-blur-xl shadow-[0_-4px_24px_rgba(0,0,0,0.06)]"
            style={{ animation: 'fade-in 0.2s ease-out' }}
        >
            <div className="flex items-center justify-between px-8 py-4 max-w-full">
                {/* Left: Selection info */}
                <div className="flex items-center gap-3">
                    <button
                        onClick={onClearSelection}
                        className="p-2 rounded-lg hover:bg-slate-100 text-slate-400 hover:text-slate-600 transition-colors"
                    >
                        <X className="w-5 h-5" />
                    </button>
                    <div className="flex items-center gap-2.5">
                        <span className="text-base font-semibold text-[#0F172A]">{selectedCount}</span>
                        <span className="text-base text-[#64748B]">
                            {selectedCount === 1 ? 'projeto selecionado' : 'projetos selecionados'}
                        </span>
                        {currentMeta && (
                            <span
                                className="text-sm font-medium px-2.5 py-1 rounded-lg"
                                style={{ backgroundColor: currentMeta.bgColor, color: currentMeta.color }}
                            >
                                {currentMeta.label}
                            </span>
                        )}
                    </div>
                </div>

                {/* Right: Actions */}
                <div className="flex items-center gap-3">
                    <button
                        onClick={onDelete}
                        className="flex items-center gap-2 px-4 py-2.5 text-sm font-medium text-red-500 bg-red-50 hover:bg-red-100 rounded-xl transition-colors"
                    >
                        <Trash2 className="w-4 h-4" />
                        Excluir
                    </button>

                    {!isLastStage && nextMeta && (
                        <>
                            <button
                                onClick={onAdvanceManual}
                                className="flex items-center gap-2 px-5 py-2.5 text-sm font-medium text-[#0F172A] bg-[#F1F5F9] hover:bg-[#E2E8F0] rounded-xl transition-colors"
                            >
                                <Upload className="w-4 h-4" />
                                Manual
                                <ChevronRight className="w-3.5 h-3.5 text-[#94A3B8]" />
                                <span style={{ color: nextMeta.color }}>{nextMeta.shortLabel}</span>
                            </button>

                            <button
                                onClick={onAdvanceAuto}
                                className="flex items-center gap-2 px-5 py-2.5 text-sm font-semibold text-white bg-primary hover:opacity-90 rounded-xl transition-colors"
                            >
                                <Zap className="w-4 h-4" />
                                Automático
                                <ChevronRight className="w-3.5 h-3.5 opacity-60" />
                                <span className="opacity-80">{nextMeta.shortLabel}</span>
                            </button>
                        </>
                    )}
                </div>
            </div>
        </div>
    );
}
