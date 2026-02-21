import React, { useRef, useState } from 'react';
import { JobStatus, StoryboardSegment } from '../types';
import { Clock, Image as ImageIcon, MessageSquare, Edit3, Split, Trash2, AlertCircle, RefreshCw, Play, Pause, Zap, CheckSquare, Square } from 'lucide-react';

interface StoryboardProps {
    segments: StoryboardSegment[];
    isEditable: boolean;
    onUpdate: (id: number, text: string, prompt: string) => void;
    onSplit?: (id: number) => void;
    onDelete?: (id: number) => void;
    onRegenerate?: (id: number) => void;
    onGenerate?: (ids: number[]) => void;
    generatingIds?: number[];
    onImageClick?: (url: string, text: string) => void;
}

const Storyboard: React.FC<StoryboardProps> = ({
    segments,
    isEditable,
    onUpdate,
    onSplit,
    onDelete,
    onRegenerate,
    onGenerate,
    generatingIds = [],
    onImageClick
}) => {
    const audioRef = useRef<HTMLAudioElement | null>(null);
    const [isPlaying, setIsPlaying] = useState(false);
    const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());

    // Try to find the master audio URL which is attached to the first segment in our mock orchestrator
    const masterAudioUrl = segments.length > 0 ? segments[0].assets?.audioUrl : undefined;

    const toggleAudio = () => {
        if (!audioRef.current || !masterAudioUrl) return;

        if (isPlaying) {
            audioRef.current.pause();
        } else {
            audioRef.current.play();
        }
        setIsPlaying(!isPlaying);
    };

    const handleAudioEnded = () => setIsPlaying(false);

    const toggleSelect = (id: number) => {
        const next = new Set(selectedIds);
        if (next.has(id)) next.delete(id);
        else next.add(id);
        setSelectedIds(next);
    };

    const selectAll = () => setSelectedIds(new Set(segments.map(s => s.id)));
    const deselectAll = () => setSelectedIds(new Set());

    const handleBatchGenerate = () => {
        if (selectedIds.size > 0 && onGenerate) {
            onGenerate(Array.from(selectedIds));
        }
    };

    if (!segments || segments.length === 0) return null;

    return (
        <div className="bg-white border border-[#E2E8F0] rounded-xl p-6 mt-6 shadow-sm">
            {/* Header Area */}
            <div className="flex flex-col gap-4 mb-6">
                <div className="flex justify-between items-center">
                    <div className="flex items-center gap-3">
                        <h3 className="text-sm font-bold text-[#64748B] uppercase tracking-wider flex items-center gap-2">
                            <ImageIcon size={16} />
                            Storyboard & Prompts Visuais
                        </h3>
                        {masterAudioUrl && (
                            <button
                                onClick={toggleAudio}
                                className="flex items-center gap-2 px-3 py-1 bg-[#F1F5F9] hover:bg-[#E2E8F0] rounded-full border border-[#E2E8F0] text-primary text-xs font-bold transition"
                            >
                                {isPlaying ? <Pause size={12} /> : <Play size={12} />}
                                {isPlaying ? 'Pausar Áudio' : 'Ouvir Áudio'}
                            </button>
                        )}
                        <audio ref={audioRef} src={masterAudioUrl} onEnded={handleAudioEnded} className="hidden" />
                    </div>

                    {isEditable && (
                        <span className="text-xs text-primary bg-teal-50 px-2 py-1 rounded border border-teal-200 flex items-center gap-1">
                            <Edit3 size={10} /> Modo Revisão: Editável
                        </span>
                    )}
                </div>

                {/* Batch Actions */}
                {isEditable && (
                    <div className="flex items-center justify-between p-3 bg-slate-50 border border-slate-200 rounded-2xl h-[56px]">
                        <div className="flex items-center gap-4">
                            <button
                                onClick={() => {
                                    if (selectedIds.size === segments.length) deselectAll();
                                    else selectAll();
                                }}
                                className="group flex items-center gap-3"
                            >
                                <div className={`relative w-10 h-5 rounded-full transition-colors duration-300 flex items-center px-1 ${selectedIds.size === segments.length ? 'bg-primary' : 'bg-slate-300'}`}>
                                    <div className={`w-3.5 h-3.5 bg-white rounded-full shadow-sm transition-transform duration-300 transform ${selectedIds.size === segments.length ? 'translate-x-4.5' : 'translate-x-0'}`} />
                                </div>
                                <span className="text-[10px] font-bold text-slate-500 group-hover:text-primary transition uppercase tracking-widest">
                                    Marcar Todas
                                </span>
                            </button>
                        </div>

                        {selectedIds.size > 0 && (
                            <button
                                onClick={handleBatchGenerate}
                                disabled={generatingIds.length > 0}
                                className={`flex items-center gap-2 px-4 py-1.5 text-xs font-bold rounded-xl shadow-lg transition-all ${generatingIds.length > 0 ? 'bg-slate-100 text-slate-400 cursor-not-allowed' : 'bg-primary text-white shadow-teal-500/20 hover:scale-105 active:scale-95'}`}
                            >
                                <Zap size={14} fill="currentColor" />
                                {`GERAR ${selectedIds.size} ${selectedIds.size === 1 ? 'IMAGEM' : 'IMAGENS'}`}
                            </button>
                        )}
                    </div>
                )}
            </div>

            <div className="space-y-4 max-h-[500px] overflow-y-auto pr-2 custom-scrollbar">
                {segments.map((seg) => {
                    const isTooLong = seg.duration > 8;
                    const isTooShort = seg.duration < 2;
                    const isSelected = selectedIds.has(seg.id);
                    const isGenerating = generatingIds.includes(seg.id);

                    return (
                        <div
                            key={seg.id}
                            className={`bg-[#F8FAFC] border rounded-2xl p-4 flex flex-col gap-4 relative overflow-hidden group transition-all duration-300 ${isEditable ? (isSelected ? 'border-primary ring-2 ring-primary/10 bg-white' : 'border-[#E2E8F0] hover:border-teal-200') : 'border-[#E2E8F0]'}`}
                        >
                            {/* Selection Overlay for Editable Mode */}
                            {isEditable && (
                                <button
                                    onClick={() => toggleSelect(seg.id)}
                                    className={`absolute top-4 left-4 z-10 p-1.5 rounded-lg transition-all ${isSelected ? 'bg-primary text-white' : 'bg-white text-slate-300 border border-slate-200 opacity-0 group-hover:opacity-100'}`}
                                >
                                    {isSelected ? <CheckSquare size={16} /> : <Square size={16} />}
                                </button>
                            )}

                            <div className="flex flex-col md:flex-row gap-4 items-start pl-0">
                                {/* Column 1: Time Indicator & Warnings (Left) */}
                                <div className={`flex flex-col gap-2 md:w-44 shrink-0 transition-all ${isEditable ? 'md:pl-10' : ''}`}>
                                    <div className="flex items-center gap-2 text-primary font-mono text-xs font-bold bg-teal-50 px-3 py-1.5 rounded h-fit self-start border border-teal-200 whitespace-nowrap">
                                        <Clock size={12} />
                                        {seg.timeRange.split('-').map(t => t.trim().split('.')[0]).join(' - ')}
                                    </div>

                                    {isEditable && (isTooLong || isTooShort) && (
                                        <div className={`text-[10px] flex items-center gap-1 px-2 py-1 rounded border ${isTooLong ? 'text-amber-600 bg-amber-50 border-amber-200' : 'text-blue-600 bg-blue-50 border-blue-200'}`}>
                                            <AlertCircle size={10} />
                                            {isTooLong ? 'Ritmo Lento' : 'Muito Rápido'}
                                        </div>
                                    )}
                                </div>

                                {/* Column 2: Content (Center) */}
                                <div className="flex-1 space-y-3">
                                    {/* Script Text */}
                                    <div className="flex gap-3">
                                        <MessageSquare size={14} className="text-[#94A3B8] shrink-0 mt-2" />
                                        <div className="flex-1">
                                            <label className="text-[10px] text-[#64748B] font-bold uppercase mb-1 block">Roteiro (Locução)</label>
                                            {isEditable ? (
                                                <textarea
                                                    className="w-full bg-white border border-[#E2E8F0] rounded-xl p-3 text-sm text-[#0F172A] focus:border-primary outline-none resize-none min-h-[120px]"
                                                    rows={5}
                                                    value={seg.scriptText}
                                                    onChange={(e) => onUpdate(seg.id, e.target.value, seg.visualPrompt)}
                                                />
                                            ) : (
                                                <p className="text-sm text-[#0F172A] font-medium leading-relaxed">"{seg.scriptText}"</p>
                                            )}
                                        </div>
                                    </div>
                                    {isGenerating && (
                                        <div className="flex items-center gap-2 pl-8 pt-1">
                                            <RefreshCw size={12} className="animate-spin text-slate-400" />
                                            <span className="text-slate-500 font-medium text-xs animate-pulse">
                                                Processando imagem...
                                            </span>
                                        </div>
                                    )}
                                </div>

                                {/* Column 3: Image Preview (Right) */}
                                <div className="flex flex-col gap-2 shrink-0">
                                    <div
                                        className={`w-24 h-36 bg-slate-100 rounded-2xl border border-slate-200 overflow-hidden relative group/img shrink-0 shadow-sm transition-all hover:scale-[1.02] ${seg.assets?.imageUrl ? 'cursor-pointer ring-primary/20 hover:ring-2' : ''}`}
                                        onClick={(e) => {
                                            if (seg.assets?.imageUrl && !isGenerating) {
                                                e.stopPropagation();
                                                onImageClick?.(seg.assets.imageUrl, seg.scriptText);
                                            }
                                        }}
                                    >
                                        {/* Imagem ou Placeholder */}
                                        <div className="w-full h-full flex items-center justify-center">
                                            {seg.assets?.imageUrl ? (
                                                <img
                                                    src={seg.assets.imageUrl}
                                                    alt="Generated Asset"
                                                    className="w-full h-full object-cover"
                                                />
                                            ) : (
                                                <div className="flex flex-col items-center gap-2 text-slate-300">
                                                    <ImageIcon size={24} strokeWidth={1.5} />
                                                    {!isGenerating && <span className="text-[8px] font-bold uppercase tracking-tighter">Sem Imagem</span>}
                                                </div>
                                            )}
                                        </div>

                                        {/* Overlay de Hover (apenas se tiver imagem e não estiver gerando) */}
                                        {seg.assets?.imageUrl && !isGenerating && (
                                            <div className="absolute inset-0 bg-black/0 group-hover/img:bg-black/40 transition-all flex items-center justify-center pointer-events-none">
                                                <Zap size={20} className="text-white opacity-0 group-hover/img:opacity-100 transition-all transform scale-150" />
                                            </div>
                                        )}

                                        {/* Overlay de Geração (isGenerating) - Prioridade Total */}
                                        {isGenerating && (
                                            <div className="absolute inset-0 bg-slate-900/40 backdrop-blur-[2px] flex flex-col items-center justify-center gap-2 z-30">
                                                <RefreshCw size={24} className="animate-spin text-white" />
                                                <span className="text-[10px] font-black text-white tracking-widest animate-pulse">CRIANDO...</span>
                                            </div>
                                        )}
                                    </div>

                                    {isEditable && onGenerate && (
                                        <button
                                            onClick={() => onGenerate([seg.id])}
                                            disabled={isGenerating}
                                            className={`w-full flex items-center justify-center gap-1.5 py-2 rounded-xl text-[10px] font-black uppercase tracking-tighter transition-all active:scale-95 shadow-lg ${isGenerating ? 'bg-slate-200 text-slate-500 cursor-not-allowed border border-slate-300' : 'bg-slate-900 text-white hover:bg-primary shadow-slate-900/10'}`}
                                        >
                                            <Zap size={10} fill="currentColor" />
                                            Gerar
                                        </button>
                                    )}
                                </div>
                            </div>

                            {/* Duration Badge & Actions */}
                            <div className="flex justify-between items-center border-t border-[#E2E8F0] pt-2 mt-2">
                                <div className="text-[10px] font-bold text-[#64748B] bg-[#F1F5F9] px-2 py-0.5 rounded">
                                    Duração: {seg.duration}s
                                </div>

                                {isEditable && (
                                    <div className="flex gap-2">
                                        <button
                                            onClick={() => onSplit && onSplit(seg.id)}
                                            className="flex items-center gap-1 text-[10px] bg-[#F1F5F9] hover:bg-[#E2E8F0] text-[#64748B] hover:text-[#0F172A] px-2 py-1 rounded border border-[#E2E8F0] transition"
                                            title="Dividir segmento ao meio"
                                        >
                                            <Split size={12} /> Dividir
                                        </button>
                                        <button
                                            onClick={() => onDelete && onDelete(seg.id)}
                                            className="flex items-center gap-1 text-[10px] bg-red-50 hover:bg-red-100 text-red-500 hover:text-red-600 px-2 py-1 rounded border border-red-200 transition"
                                            title="Excluir segmento"
                                        >
                                            <Trash2 size={12} /> Excluir
                                        </button>
                                    </div>
                                )}
                            </div>
                        </div>
                    );
                })}
            </div>
        </div>
    );
};

export default Storyboard;