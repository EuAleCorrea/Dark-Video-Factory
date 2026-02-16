import React from 'react';
import { X, Send, Eye, Cpu, FileText, ArrowRight } from 'lucide-react';

export interface PromptPreviewData {
    stage: 'P1' | 'P2';
    stageLabel: string;
    modelId: string;
    provider: string;
    isCustomPrompt: boolean;
    systemPrompt: string;
    userPrompt: string;
    inputLength: number;
}

interface PromptDebugModalProps {
    isOpen: boolean;
    data: PromptPreviewData | null;
    onConfirm: () => void;
    onCancel: () => void;
}

export default function PromptDebugModal({ isOpen, data, onConfirm, onCancel }: PromptDebugModalProps) {
    if (!isOpen || !data) return null;

    const stageColor = data.stage === 'P1'
        ? { bg: 'bg-blue-500', light: 'bg-blue-50', text: 'text-blue-700', border: 'border-blue-200' }
        : { bg: 'bg-purple-500', light: 'bg-purple-50', text: 'text-purple-700', border: 'border-purple-200' };

    return (
        <div
            className="fixed inset-0 z-[12000] flex items-center justify-center bg-black/70 backdrop-blur-md p-4"
            onClick={onCancel}
        >
            <div
                className="bg-white rounded-3xl shadow-2xl w-full max-w-5xl max-h-[92vh] flex flex-col overflow-hidden animate-in fade-in zoom-in-95 duration-200"
                onClick={e => e.stopPropagation()}
            >
                {/* Header */}
                <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between bg-slate-50/80">
                    <div className="flex items-center gap-3">
                        <div className={`w-10 h-10 ${stageColor.bg} rounded-xl flex items-center justify-center text-white shadow-md`}>
                            <Eye size={20} />
                        </div>
                        <div>
                            <h3 className="text-lg font-bold text-slate-900 flex items-center gap-2">
                                🔍 Debug Prompt — {data.stage}
                                <span className={`text-xs px-2 py-0.5 rounded-full ${stageColor.light} ${stageColor.text} font-bold`}>
                                    {data.stageLabel}
                                </span>
                            </h3>
                            <p className="text-xs text-slate-500">
                                Revise o prompt antes de enviar para a IA
                            </p>
                        </div>
                    </div>
                    <button onClick={onCancel} className="p-2 rounded-xl hover:bg-slate-200/60 text-slate-400 transition-colors">
                        <X size={18} />
                    </button>
                </div>

                {/* Meta Info Bar */}
                <div className="px-6 py-3 bg-slate-50 border-b border-slate-100 flex items-center gap-6 text-xs">
                    <div className="flex items-center gap-1.5">
                        <Cpu size={13} className="text-slate-400" />
                        <span className="text-slate-500">Modelo:</span>
                        <span className="font-bold text-slate-800">{data.modelId}</span>
                    </div>
                    <div className="flex items-center gap-1.5">
                        <ArrowRight size={13} className="text-slate-400" />
                        <span className="text-slate-500">Provider:</span>
                        <span className="font-bold text-slate-800">{data.provider}</span>
                    </div>
                    <div className="flex items-center gap-1.5">
                        <FileText size={13} className="text-slate-400" />
                        <span className="text-slate-500">Prompt:</span>
                        <span className={`font-bold ${data.isCustomPrompt ? 'text-emerald-600' : 'text-orange-500'}`}>
                            {data.isCustomPrompt ? '✅ Customizado' : '⚠️ Default (padrão)'}
                        </span>
                    </div>
                    <div className="flex items-center gap-1.5">
                        <span className="text-slate-500">Input:</span>
                        <span className="font-bold text-slate-800">{data.inputLength.toLocaleString()} chars</span>
                    </div>
                </div>

                {/* Content */}
                <div className="flex-1 overflow-y-auto p-6 space-y-6">
                    {/* SYSTEM PROMPT */}
                    <section>
                        <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-[0.15em] mb-2 flex items-center gap-2">
                            <span className={`w-2 h-2 rounded-full ${stageColor.bg}`} />
                            SYSTEM PROMPT (Instruções para a IA)
                        </h4>
                        <div className={`rounded-2xl border ${stageColor.border} overflow-hidden`}>
                            <pre className={`p-4 text-sm text-slate-800 whitespace-pre-wrap font-mono leading-relaxed ${stageColor.light} max-h-[250px] overflow-y-auto custom-scrollbar`}>
                                {data.systemPrompt}
                            </pre>
                        </div>
                    </section>

                    {/* USER PROMPT */}
                    <section>
                        <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-[0.15em] mb-2 flex items-center gap-2">
                            <span className="w-2 h-2 rounded-full bg-emerald-500" />
                            USER PROMPT (Dados enviados — {data.stage === 'P1' ? 'Transcrição' : 'Output P1'})
                        </h4>
                        <div className="rounded-2xl border border-emerald-200 overflow-hidden">
                            <pre className="p-4 text-sm text-slate-800 whitespace-pre-wrap font-mono leading-relaxed bg-emerald-50/50 max-h-[350px] overflow-y-auto custom-scrollbar">
                                {data.userPrompt}
                            </pre>
                        </div>
                    </section>
                </div>

                {/* Footer */}
                <div className="px-6 py-4 bg-slate-50 border-t border-slate-100 flex items-center justify-between">
                    <p className="text-xs text-slate-400">
                        Clique em <strong>Enviar para IA</strong> para prosseguir com a geração
                    </p>
                    <div className="flex items-center gap-3">
                        <button
                            onClick={onCancel}
                            className="px-5 py-2.5 bg-slate-200 text-slate-700 font-semibold rounded-2xl hover:bg-slate-300 transition-all active:scale-95"
                        >
                            Cancelar
                        </button>
                        <button
                            onClick={onConfirm}
                            className={`px-6 py-2.5 ${stageColor.bg} text-white font-semibold rounded-2xl hover:opacity-90 transition-all shadow-md active:scale-95 flex items-center gap-2`}
                        >
                            <Send size={16} />
                            Enviar para IA ({data.stage})
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
}
