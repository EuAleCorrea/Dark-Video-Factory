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
    <div className="bg-slate-900 border border-slate-800 rounded-xl p-6 mt-6">
      <div className="flex justify-between items-center mb-4">
        <div className="flex items-center gap-3">
            <h3 className="text-sm font-bold text-slate-400 uppercase tracking-wider flex items-center gap-2">
                <ImageIcon size={16} />
                Storyboard & Prompts Visuais
            </h3>
            {masterAudioUrl && (
                <button 
                    onClick={toggleAudio}
                    className="flex items-center gap-2 px-3 py-1 bg-slate-800 hover:bg-slate-700 rounded-full border border-slate-700 text-emerald-400 text-xs font-bold transition"
                >
                    {isPlaying ? <Pause size={12} /> : <Play size={12} />}
                    {isPlaying ? 'Pausar Áudio' : 'Ouvir Áudio'}
                </button>
            )}
            <audio ref={audioRef} src={masterAudioUrl} onEnded={handleAudioEnded} className="hidden" />
        </div>
        
        {isEditable && (
            <span className="text-xs text-emerald-400 bg-emerald-950/30 px-2 py-1 rounded border border-emerald-900 flex items-center gap-1">
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
            <div key={seg.id} className={`bg-slate-950 border rounded-lg p-4 flex flex-col gap-4 relative overflow-hidden group transition ${isEditable ? 'border-emerald-900/50 hover:border-emerald-500/50' : 'border-slate-800'}`}>
                <div className="flex flex-col md:flex-row gap-4">
                    {/* Time Indicator & Image Preview */}
                    <div className="flex flex-col gap-2 md:w-32 shrink-0">
                        <div className="flex items-center gap-2 text-emerald-500 font-mono text-xs font-bold bg-emerald-950/30 px-3 py-1.5 rounded h-fit self-start border border-emerald-900/50">
                            <Clock size={12} />
                            {seg.timeRange}
                        </div>
                        
                        {/* Image Preview Slot */}
                        <div className="w-24 h-36 bg-slate-900 rounded border border-slate-800 overflow-hidden relative group/img">
                            {seg.assets?.imageUrl ? (
                                <>
                                    <img src={seg.assets.imageUrl} alt="Generated Asset" className="w-full h-full object-cover" />
                                    {/* Regenerate Button Overlay */}
                                    {!isEditable && onRegenerate && (
                                        <div className="absolute inset-0 bg-black/60 flex items-center justify-center opacity-0 group-hover/img:opacity-100 transition">
                                            <button 
                                                onClick={(e) => { e.stopPropagation(); onRegenerate(seg.id); }}
                                                className="p-1.5 bg-slate-800 rounded-full hover:bg-emerald-600 text-white transition"
                                                title="Regenerar Imagem"
                                            >
                                                <RefreshCw size={14} />
                                            </button>
                                        </div>
                                    )}
                                </>
                            ) : (
                                <div className="w-full h-full flex items-center justify-center text-slate-700">
                                    <ImageIcon size={20} />
                                </div>
                            )}
                        </div>

                        {isEditable && (isTooLong || isTooShort) && (
                            <div className={`text-[10px] flex items-center gap-1 px-2 py-1 rounded border ${isTooLong ? 'text-amber-400 bg-amber-950/30 border-amber-900/50' : 'text-blue-400 bg-blue-950/30 border-blue-900/50'}`}>
                                <AlertCircle size={10} />
                                {isTooLong ? 'Ritmo Lento' : 'Muito Rápido'}
                            </div>
                        )}
                    </div>

                    {/* Content */}
                    <div className="flex-1 space-y-3">
                    {/* Script Text */}
                    <div className="flex gap-3">
                        <MessageSquare size={14} className="text-slate-500 shrink-0 mt-2" />
                        <div className="flex-1">
                            <label className="text-[10px] text-slate-600 font-bold uppercase mb-1 block">Roteiro (Locução)</label>
                            {isEditable ? (
                                <textarea 
                                    className="w-full bg-slate-900 border border-slate-700 rounded p-2 text-sm text-slate-300 focus:border-emerald-500 outline-none resize-none"
                                    rows={2}
                                    value={seg.scriptText}
                                    onChange={(e) => onUpdate(seg.id, e.target.value, seg.visualPrompt)}
                                />
                            ) : (
                                <p className="text-sm text-slate-300 font-medium leading-relaxed">"{seg.scriptText}"</p>
                            )}
                        </div>
                    </div>

                    {/* Visual Prompt */}
                    <div className="bg-slate-900 rounded border border-slate-800 p-3">
                        <span className="text-[10px] text-slate-500 font-bold uppercase block mb-1">Prompt Visual (Flux.1)</span>
                        {isEditable ? (
                            <textarea 
                                className="w-full bg-slate-950 border border-slate-700 rounded p-2 text-xs text-slate-400 font-mono focus:border-emerald-500 outline-none resize-none"
                                rows={3}
                                value={seg.visualPrompt}
                                onChange={(e) => onUpdate(seg.id, seg.scriptText, e.target.value)}
                            />
                        ) : (
                            <p className="text-xs text-slate-400 font-mono break-words">{seg.visualPrompt}</p>
                        )}
                    </div>
                    </div>
                </div>

                {/* Duration Badge & Actions */}
                <div className="flex justify-between items-center border-t border-slate-900 pt-2 mt-2">
                    <div className="text-[10px] font-bold text-slate-600 bg-slate-900 px-2 py-0.5 rounded">
                        Duração: {seg.duration}s
                    </div>
                    
                    {isEditable && (
                        <div className="flex gap-2">
                            <button 
                                onClick={() => onSplit && onSplit(seg.id)}
                                className="flex items-center gap-1 text-[10px] bg-slate-900 hover:bg-slate-800 text-slate-400 hover:text-white px-2 py-1 rounded border border-slate-800 transition"
                                title="Dividir segmento ao meio"
                            >
                                <Split size={12} /> Dividir
                            </button>
                            <button 
                                onClick={() => onDelete && onDelete(seg.id)}
                                className="flex items-center gap-1 text-[10px] bg-red-950/20 hover:bg-red-900/40 text-red-500 hover:text-red-400 px-2 py-1 rounded border border-red-900/30 transition"
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