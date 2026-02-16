import React from 'react';
import { VideoProject, STAGE_META } from '../types';
import { X, AlertTriangle, Copy, RefreshCw, Terminal, Clock, Box } from 'lucide-react';

interface ErrorDetailModalProps {
    isOpen: boolean;
    onClose: () => void;
    project: VideoProject | null;
    onResetStage?: (projectId: string) => void;
}

export default function ErrorDetailModal({ isOpen, onClose, project, onResetStage }: ErrorDetailModalProps) {
    const [copied, setCopied] = React.useState(false);

    if (!isOpen || !project) return null;

    const meta = STAGE_META[project.currentStage];
    const errorMessage = project.errorMessage || 'Erro desconhecido durante o processamento.';

    const handleCopy = () => {
        navigator.clipboard.writeText(`PROJETO: ${project.title}\nESTÁGIO: ${meta.label}\nERRO: ${errorMessage}`);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
    };

    return (
        <div className="fixed inset-0 z-[10000] flex items-center justify-center bg-slate-900/80 backdrop-blur-md p-4 animate-in fade-in duration-300" onClick={onClose}>
            <div
                className="bg-white rounded-[2rem] shadow-2xl w-full max-w-2xl flex flex-col overflow-hidden animate-in zoom-in-95 duration-200"
                onClick={e => e.stopPropagation()}
            >
                {/* Header Estilizado - Alerta */}
                <div className="bg-red-50 border-b border-red-100 px-8 py-6 flex items-center justify-between">
                    <div className="flex items-center gap-4">
                        <div className="w-12 h-12 rounded-2xl bg-red-100 flex items-center justify-center text-red-600 shadow-sm">
                            <AlertTriangle size={24} />
                        </div>
                        <div>
                            <h3 className="text-xl font-bold text-red-900">Falha no Processamento</h3>
                            <p className="text-sm text-red-700/70 font-medium">Ocorreu um erro no estágio de {meta.label}</p>
                        </div>
                    </div>
                    <button
                        onClick={onClose}
                        className="p-2 rounded-xl hover:bg-red-100 text-red-400 transition-colors"
                    >
                        <X size={20} />
                    </button>
                </div>

                <div className="p-8 space-y-6 flex-1 overflow-y-auto custom-scrollbar">
                    {/* Project Info */}
                    <div className="grid grid-cols-2 gap-4">
                        <InfoItem icon={Box} label="Projeto" value={project.title} />
                        <InfoItem icon={Clock} label="Data da Falha" value={new Date(project.updatedAt).toLocaleString()} />
                    </div>

                    {/* Error Content */}
                    <section>
                        <div className="flex items-center justify-between mb-2">
                            <h4 className="text-xs font-bold text-slate-400 uppercase tracking-widest flex items-center gap-2">
                                <Terminal size={14} /> Log de Erro Completo
                            </h4>
                            <button
                                onClick={handleCopy}
                                className="text-xs font-bold text-slate-500 hover:text-primary flex items-center gap-1.5 transition-colors"
                            >
                                {copied ? <><Box size={12} /> Copiado!</> : <><Copy size={12} /> Copiar Log</>}
                            </button>
                        </div>
                        <div className="bg-slate-900 rounded-2xl p-6 shadow-inner border border-slate-800">
                            <pre className="text-sm text-red-400 font-mono whitespace-pre-wrap leading-relaxed">
                                {errorMessage}
                            </pre>
                        </div>
                    </section>

                    {/* Help Note */}
                    <div className="bg-amber-50 rounded-2xl p-4 border border-amber-100 flex gap-3">
                        <AlertTriangle size={18} className="text-amber-500 flex-shrink-0 mt-0.5" />
                        <p className="text-xs text-amber-800 leading-relaxed">
                            <strong>Dica Técnica:</strong> Verifique sua conexão com a internet e se as chaves de API nas Configurações estão corretas. Se o erro persistir, tente "Resetar Estágio" para limpar dados corrompidos.
                        </p>
                    </div>
                </div>

                {/* Footer Actions */}
                <div className="px-8 py-6 bg-slate-50 border-t border-slate-100 flex flex-col sm:flex-row gap-3">
                    {onResetStage && (
                        <button
                            onClick={() => {
                                if (confirm('Isso limpará os dados deste estágio e voltará o status para "Pronto". Deseja continuar?')) {
                                    onResetStage(project.id);
                                    onClose();
                                }
                            }}
                            className="flex-1 flex items-center justify-center gap-2 px-6 py-3 bg-white border border-red-200 text-red-600 font-bold rounded-2xl hover:bg-red-50 transition-all active:scale-95 shadow-sm"
                        >
                            <RefreshCw size={18} />
                            Resetar Estágio
                        </button>
                    )}
                    <button
                        onClick={onClose}
                        className="flex-1 px-6 py-3 bg-slate-900 text-white font-bold rounded-2xl hover:bg-slate-800 transition-all shadow-lg active:scale-95"
                    >
                        Fechar Janela
                    </button>
                </div>
            </div>
        </div>
    );
}

function InfoItem({ icon: Icon, label, value }: { icon: any, label: string, value: string }) {
    return (
        <div className="bg-slate-50 rounded-2xl p-4 border border-slate-100">
            <div className="flex items-center gap-2 text-slate-400 mb-1">
                <Icon size={14} />
                <span className="text-[10px] font-bold uppercase tracking-wider">{label}</span>
            </div>
            <p className="text-sm font-bold text-slate-700 line-clamp-1">{value}</p>
        </div>
    );
}
