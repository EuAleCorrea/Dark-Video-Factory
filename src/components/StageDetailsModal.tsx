import React from 'react';
import { VideoProject, PipelineStage, STAGE_META, ReferenceStageData } from '../types';
import { X, BookOpen, FileText, Calendar, Hash, Type, Info, ExternalLink, MessageSquare, Code, Play } from 'lucide-react';
import { openUrl } from '@tauri-apps/plugin-opener';
import VideoPlayerModal from './VideoPlayerModal';

interface StageDetailsModalProps {
    isOpen: boolean;
    onClose: () => void;
    project: VideoProject | null;
    stage: PipelineStage | null;
}

export default function StageDetailsModal({ isOpen, onClose, project, stage }: StageDetailsModalProps) {
    const [isVideoPlayerOpen, setIsVideoPlayerOpen] = React.useState(false);

    if (!isOpen || !project || !stage) return null;

    const data = project.stageData[stage as keyof typeof project.stageData];
    const meta = STAGE_META[stage];

    const handleExternalLink = async (e: React.MouseEvent, url: string) => {
        e.preventDefault();
        try {
            await openUrl(url);
        } catch (err) {
            console.error('Failed to open external link:', err);
        }
    };

    const renderReferenceDetails = (refData: ReferenceStageData) => {
        if (!refData) return null;

        return (
            <div className="p-6 space-y-8">
                {/* Top Grid: Info + Thumbnail */}
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

                {/* Transcript */}
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

                {/* Video Player Modal (Internal Overlay) */}
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
                {/* Header Tags/SEO */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <StatCard icon={Type} label="Contagem" value={`${scriptData.wordCount} palavras`} color="blue" />
                    <StatCard icon={Calendar} label="Gerado em" value={scriptData.generationSnapshot?.generatedAt ? new Date(scriptData.generationSnapshot.generatedAt).toLocaleDateString() : '—'} color="purple" />
                    <StatCard icon={Hash} label="Tags" value={`${scriptData.tags?.length || 0} etiquetas`} color="emerald" />
                </div>

                {/* SEO Section */}
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

                {/* Script Text */}
                <section>
                    <h4 className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-3">Roteiro Final (Magnético)</h4>
                    <div className="bg-slate-50 border border-slate-200 rounded-3xl p-6 shadow-inner">
                        <div className="text-slate-800 leading-relaxed text-lg whitespace-pre-wrap max-h-[600px] overflow-y-auto pr-4 custom-scrollbar font-serif">
                            {scriptData.text || 'Nenhum roteiro gerado.'}
                        </div>
                    </div>
                </section>

                {/* Description & Tags */}
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

                {/* Snapshot Technical Info */}
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

    const renderContent = () => {
        switch (stage) {
            case PipelineStage.REFERENCE:
                return renderReferenceDetails(project.stageData.reference as ReferenceStageData);
            case PipelineStage.SCRIPT:
                return renderScriptDetails(project.stageData.script);
            default:
                return (
                    <div className="p-8 text-center text-slate-500">
                        <Info className="w-12 h-12 mx-auto mb-3 opacity-20" />
                        <p>Detalhes ainda não disponíveis para este estágio.</p>
                    </div>
                );
        }
    };

    return (
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
                <div className="px-6 py-4 bg-slate-50 border-t border-slate-100 flex justify-end">
                    <button
                        onClick={onClose}
                        className="px-6 py-2.5 bg-slate-900 text-white font-semibold rounded-2xl hover:bg-slate-800 transition-all shadow-md active:scale-95"
                    >
                        Fechar Visualização
                    </button>
                </div>
            </div>
        </div>
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
