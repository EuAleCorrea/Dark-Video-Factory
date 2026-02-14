import React, { useRef, useState } from 'react';
import { JobStatus, StoryboardSegment } from '../types';
import { Clock, Image as ImageIcon, MessageSquare, Edit3, Split, Trash2, AlertCircle, RefreshCw, Play, Pause, Volume2 } from 'lucide-react';

interface StoryboardProps {
    segments: StoryboardSegment[];
    isEditable: boolean;
    onUpdate: (id: number, text: string, prompt: string) => void;
    onSplit?: (id: number) => void;
    onDelete?: (id: number) => void;
    onRegenerate?: (id: number) => void;
}

const Storyboard: React.FC<StoryboardProps> = ({ segments, isEditable, onUpdate, onSplit, onDelete, onRegenerate }) => {
    const audioRef = useRef<HTMLAudioElement | null>(null);
    const [isPlaying, setIsPlaying] = useState(false);

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

    if (!segments || segments.length === 0) return null;

    return (
        <div className="bg-white border border-[#E2E8F0] rounded-xl p-6 mt-6 shadow-sm">
            <div className="flex justify-between items-center mb-4">
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

            <div className="space-y-4 max-h-[400px] overflow-y-auto pr-2 custom-scrollbar">
                {segments.map((seg) => {
                    // Duration Warning Logic
                    const isTooLong = seg.duration > 8;
                    const isTooShort = seg.duration < 2;

                    return (
                        <div key={seg.id} className={`bg-[#F8FAFC] border rounded-lg p-4 flex flex-col gap-4 relative overflow-hidden group transition ${isEditable ? 'border-teal-300 hover:border-primary' : 'border-[#E2E8F0]'}`}>
                            <div className="flex flex-col md:flex-row gap-4">
                                {/* Time Indicator & Image Preview */}
                                <div className="flex flex-col gap-2 md:w-32 shrink-0">
                                    <div className="flex items-center gap-2 text-primary font-mono text-xs font-bold bg-teal-50 px-3 py-1.5 rounded h-fit self-start border border-teal-200">
                                        <Clock size={12} />
                                        {seg.timeRange}
                                    </div>

                                    {/* Image Preview Slot */}
                                    <div className="w-24 h-36 bg-[#F1F5F9] rounded border border-[#E2E8F0] overflow-hidden relative group/img">
                                        {seg.assets?.imageUrl ? (
                                            <>
                                                <img src={seg.assets.imageUrl} alt="Generated Asset" className="w-full h-full object-cover" />
                                                {/* Regenerate Button Overlay */}
                                                {!isEditable && onRegenerate && (
                                                    <div className="absolute inset-0 bg-black/60 flex items-center justify-center opacity-0 group-hover/img:opacity-100 transition">
                                                        <button
                                                            onClick={(e) => { e.stopPropagation(); onRegenerate(seg.id); }}
                                                            className="p-1.5 bg-white/90 rounded-full hover:bg-primary text-[#64748B] hover:text-white transition"
                                                            title="Regenerar Imagem"
                                                        >
                                                            <RefreshCw size={14} />
                                                        </button>
                                                    </div>
                                                )}
                                            </>
                                        ) : (
                                            <div className="w-full h-full flex items-center justify-center text-[#CBD5E1]">
                                                <ImageIcon size={20} />
                                            </div>
                                        )}
                                    </div>

                                    {isEditable && (isTooLong || isTooShort) && (
                                        <div className={`text-[10px] flex items-center gap-1 px-2 py-1 rounded border ${isTooLong ? 'text-amber-600 bg-amber-50 border-amber-200' : 'text-blue-600 bg-blue-50 border-blue-200'}`}>
                                            <AlertCircle size={10} />
                                            {isTooLong ? 'Ritmo Lento' : 'Muito Rápido'}
                                        </div>
                                    )}
                                </div>

                                {/* Content */}
                                <div className="flex-1 space-y-3">
                                    {/* Script Text */}
                                    <div className="flex gap-3">
                                        <MessageSquare size={14} className="text-[#94A3B8] shrink-0 mt-2" />
                                        <div className="flex-1">
                                            <label className="text-[10px] text-[#64748B] font-bold uppercase mb-1 block">Roteiro (Locução)</label>
                                            {isEditable ? (
                                                <textarea
                                                    className="w-full bg-white border border-[#E2E8F0] rounded p-2 text-sm text-[#0F172A] focus:border-primary outline-none resize-none"
                                                    rows={2}
                                                    value={seg.scriptText}
                                                    onChange={(e) => onUpdate(seg.id, e.target.value, seg.visualPrompt)}
                                                />
                                            ) : (
                                                <p className="text-sm text-[#0F172A] font-medium leading-relaxed">"{seg.scriptText}"</p>
                                            )}
                                        </div>
                                    </div>

                                    {/* Visual Prompt */}
                                    <div className="bg-white rounded border border-[#E2E8F0] p-3">
                                        <span className="text-[10px] text-[#94A3B8] font-bold uppercase block mb-1">Prompt Visual (Flux.1)</span>
                                        {isEditable ? (
                                            <textarea
                                                className="w-full bg-[#F8FAFC] border border-[#E2E8F0] rounded p-2 text-xs text-[#64748B] font-mono focus:border-primary outline-none resize-none"
                                                rows={3}
                                                value={seg.visualPrompt}
                                                onChange={(e) => onUpdate(seg.id, seg.scriptText, e.target.value)}
                                            />
                                        ) : (
                                            <p className="text-xs text-[#64748B] font-mono break-words">{seg.visualPrompt}</p>
                                        )}
                                    </div>
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