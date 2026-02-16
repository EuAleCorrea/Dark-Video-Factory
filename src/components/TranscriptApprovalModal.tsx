import React, { useState, useEffect, useCallback } from 'react';
import { X, CheckCircle, XCircle, FileText, Loader2, ChevronDown, ChevronUp, CheckCircle2 } from 'lucide-react';
import { VideoProject, EngineConfig } from '../types';

type TranscriptStatus = 'pending' | 'loading' | 'done' | 'error';

interface ProjectTranscript {
    project: VideoProject;
    status: TranscriptStatus;
    transcript: string;
    metadata?: any;
    error?: string;
    progress: number;
    expanded: boolean;
}

interface TranscriptApprovalModalProps {
    projects: VideoProject[];
    config: EngineConfig;
    onApproveAll: (results: { project: VideoProject; transcript: string; metadata: any }[]) => void;
    onReject: () => void;
    onClose: () => void;
}

const TranscriptApprovalModal: React.FC<TranscriptApprovalModalProps> = ({ projects, config, onApproveAll, onReject, onClose }) => {
    const [items, setItems] = useState<ProjectTranscript[]>(() =>
        projects.map(p => ({
            project: p,
            status: 'pending',
            transcript: '',
            progress: 0,
            expanded: false,
        }))
    );

    const allDone = items.every(i => i.status === 'done');
    const anyLoading = items.some(i => i.status === 'loading' || i.status === 'pending');
    const doneCount = items.filter(i => i.status === 'done').length;
    const errorCount = items.filter(i => i.status === 'error').length;

    // Fetch all transcripts in parallel on mount
    useEffect(() => {
        const apifyKey = config.apiKeys.apify;

        const fetchOne = async (index: number, project: VideoProject) => {
            if (!apifyKey) {
                setItems(prev => prev.map((item, i) => i === index ? { ...item, status: 'error', error: 'Token APIFY não configurado' } : item));
                return;
            }

            const videoId = project.stageData.reference?.videoId;
            if (!videoId) {
                setItems(prev => prev.map((item, i) => i === index ? { ...item, status: 'error', error: 'Video ID não encontrado' } : item));
                return;
            }

            // Set loading
            setItems(prev => prev.map((item, i) => i === index ? { ...item, status: 'loading' } : item));

            // Simulate progress
            const interval = setInterval(() => {
                setItems(prev => prev.map((item, i) => {
                    if (i !== index || item.status !== 'loading') return item;
                    return { ...item, progress: Math.min(item.progress + Math.random() * 10, 90) };
                }));
            }, 1500);

            try {
                const { transcribeVideo } = await import('../lib/youtubeMock');
                const result = await transcribeVideo(videoId, apifyKey);
                clearInterval(interval);
                setItems(prev => prev.map((item, i) => i === index ? {
                    ...item,
                    status: 'done',
                    transcript: result.transcript,
                    metadata: result.metadata,
                    progress: 100,
                } : item));
            } catch (e) {
                clearInterval(interval);
                setItems(prev => prev.map((item, i) => i === index ? {
                    ...item,
                    status: 'error',
                    error: (e as Error).message,
                    progress: 0,
                } : item));
            }
        };

        // Launch all in parallel
        projects.forEach((p, i) => fetchOne(i, p));
    }, []);

    const toggleExpand = (index: number) => {
        setItems(prev => prev.map((item, i) => i === index ? { ...item, expanded: !item.expanded } : item));
    };

    const handleApproveAll = () => {
        const results = items
            .filter(i => i.status === 'done')
            .map(i => ({ project: i.project, transcript: i.transcript, metadata: i.metadata }));
        onApproveAll(results);
    };

    const globalProgress = items.length > 0
        ? Math.round(items.reduce((sum, i) => sum + i.progress, 0) / items.length)
        : 0;

    return (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
            <div className="bg-white rounded-2xl shadow-2xl w-full max-w-4xl max-h-[90vh] flex flex-col overflow-hidden">

                {/* Header */}
                <div className="flex items-center justify-between px-6 py-4 border-b border-[#E2E8F0] bg-gradient-to-r from-blue-50 to-white shrink-0">
                    <div className="flex items-center gap-3">
                        <div className="bg-blue-100 p-2 rounded-full">
                            <FileText size={20} className="text-blue-600" />
                        </div>
                        <div>
                            <h2 className="text-lg font-bold text-[#0F172A]">
                                {anyLoading ? 'Transcrevendo Vídeos...' : `${doneCount} Transcrições Prontas`}
                            </h2>
                            <p className="text-sm text-[#64748B]">
                                {items.length} vídeo{items.length > 1 ? 's' : ''} selecionado{items.length > 1 ? 's' : ''}
                                {errorCount > 0 && <span className="text-red-500 ml-2">· {errorCount} erro{errorCount > 1 ? 's' : ''}</span>}
                            </p>
                        </div>
                    </div>
                    <button onClick={onClose} className="text-[#94A3B8] hover:text-[#64748B] transition p-1">
                        <X size={20} />
                    </button>
                </div>

                {/* Global Progress */}
                {anyLoading && (
                    <div className="px-6 py-3 border-b border-[#E2E8F0] bg-[#FAFBFC] shrink-0">
                        <div className="flex items-center justify-between mb-1.5">
                            <span className="text-xs text-[#64748B] font-medium flex items-center gap-2">
                                <Loader2 size={12} className="animate-spin text-blue-500" />
                                Progresso geral
                            </span>
                            <span className="text-xs text-blue-600 font-bold">{globalProgress}%</span>
                        </div>
                        <div className="w-full bg-[#E2E8F0] rounded-full h-1.5">
                            <div
                                className="bg-gradient-to-r from-blue-500 to-blue-400 h-full rounded-full transition-all duration-500"
                                style={{ width: `${globalProgress}%` }}
                            />
                        </div>
                    </div>
                )}

                {/* Video List (YT Studio style) */}
                <div className="flex-1 overflow-y-auto divide-y divide-[#E2E8F0]">
                    {items.map((item, index) => {
                        const thumb = item.project.stageData.reference?.thumbnailUrl;
                        const channelName = item.project.stageData.reference?.channelName;

                        return (
                            <div key={item.project.id} className="group">
                                {/* Row */}
                                <div
                                    className={`flex items-center gap-4 px-6 py-3 hover:bg-[#F8FAFC] cursor-pointer transition ${item.expanded ? 'bg-[#F8FAFC]' : ''
                                        }`}
                                    onClick={() => item.status === 'done' && toggleExpand(index)}
                                >
                                    {/* Thumbnail */}
                                    <div className="w-24 h-14 rounded-lg overflow-hidden bg-gray-100 shrink-0 relative">
                                        {thumb ? (
                                            <img src={thumb} alt="" className="w-full h-full object-cover" />
                                        ) : (
                                            <div className="w-full h-full flex items-center justify-center text-gray-400">
                                                <FileText size={20} />
                                            </div>
                                        )}
                                        {/* Duration badge placeholder */}
                                    </div>

                                    {/* Info */}
                                    <div className="flex-1 min-w-0">
                                        <h4 className="text-sm font-semibold text-[#0F172A] line-clamp-1">
                                            {item.project.title}
                                        </h4>
                                        <div className="flex items-center gap-2 mt-0.5">
                                            {channelName && (
                                                <p className="text-xs text-[#94A3B8]">{channelName}</p>
                                            )}
                                            {item.metadata?._apifyAccount && (
                                                <span className="text-[10px] font-mono bg-blue-50 text-blue-600 px-1.5 py-0.5 rounded">
                                                    @{item.metadata._apifyAccount}
                                                </span>
                                            )}
                                        </div>
                                    </div>

                                    {/* Status Badge */}
                                    <div className="shrink-0 flex items-center gap-2">
                                        {item.status === 'pending' && (
                                            <span className="text-xs text-[#94A3B8] bg-[#F1F5F9] px-2.5 py-1 rounded-full font-medium">
                                                Na fila
                                            </span>
                                        )}
                                        {item.status === 'loading' && (
                                            <div className="flex items-center gap-2">
                                                <div className="w-20 bg-[#E2E8F0] rounded-full h-1.5">
                                                    <div
                                                        className="bg-blue-500 h-full rounded-full transition-all duration-500"
                                                        style={{ width: `${item.progress}%` }}
                                                    />
                                                </div>
                                                <Loader2 size={14} className="text-blue-500 animate-spin" />
                                            </div>
                                        )}
                                        {item.status === 'done' && (
                                            <span className="text-xs text-emerald-600 bg-emerald-50 px-2.5 py-1 rounded-full font-medium flex items-center gap-1">
                                                <CheckCircle2 size={12} /> Pronto
                                            </span>
                                        )}
                                        {item.status === 'error' && (
                                            <span className="text-xs text-red-600 bg-red-50 px-2.5 py-1 rounded-full font-medium">
                                                Erro
                                            </span>
                                        )}

                                        {/* Expand arrow */}
                                        {item.status === 'done' && (
                                            <button className="text-[#94A3B8] hover:text-[#64748B]">
                                                {item.expanded ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                                            </button>
                                        )}
                                    </div>
                                </div>

                                {/* Expanded Transcript */}
                                {item.expanded && item.status === 'done' && (
                                    <div className="px-6 pb-4">
                                        <div className="ml-28 bg-[#F1F5F9] border border-[#E2E8F0] rounded-xl p-4 max-h-48 overflow-y-auto">
                                            <pre className="whitespace-pre-wrap text-xs text-[#334155] leading-relaxed font-sans">
                                                {item.transcript}
                                            </pre>
                                        </div>
                                        <p className="ml-28 text-[10px] text-[#94A3B8] mt-1.5">
                                            {item.transcript.length} caracteres · {item.transcript.split(/\s+/).length} palavras
                                        </p>
                                    </div>
                                )}

                                {/* Error message */}
                                {item.status === 'error' && item.error && (
                                    <div className="px-6 pb-3">
                                        <p className="ml-28 text-xs text-red-500">{item.error}</p>
                                    </div>
                                )}
                            </div>
                        );
                    })}
                </div>

                {/* Footer Actions */}
                <div className="flex items-center justify-between px-6 py-4 border-t border-[#E2E8F0] bg-[#FAFBFC] shrink-0">
                    <div className="text-sm text-[#64748B]">
                        {doneCount}/{items.length} concluído{doneCount !== 1 ? 's' : ''}
                    </div>
                    <div className="flex items-center gap-3">
                        <button
                            onClick={onReject}
                            className="flex items-center gap-2 px-5 py-2.5 rounded-lg border border-red-200 text-red-600 font-semibold hover:bg-red-50 transition text-sm"
                        >
                            <XCircle size={16} />
                            {anyLoading ? 'Cancelar' : 'Rejeitar'}
                        </button>
                        <button
                            onClick={handleApproveAll}
                            disabled={!allDone || doneCount === 0}
                            className="flex items-center gap-2 px-6 py-2.5 rounded-lg bg-emerald-600 text-white font-semibold hover:bg-emerald-500 transition text-sm shadow-lg shadow-emerald-200 disabled:opacity-40 disabled:cursor-not-allowed disabled:shadow-none"
                        >
                            <CheckCircle size={16} />
                            Aprovar Todos ({doneCount})
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default TranscriptApprovalModal;
