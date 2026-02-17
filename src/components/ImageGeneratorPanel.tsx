import React, { useState, useRef } from 'react';
import {
    Image as ImageIcon,
    Sparkles,
    Download,
    Trash2,
    Loader2,
    Layout,
    Layers,
    ArrowUp,
    Settings2,
    Check,
    ChevronRight,
    Search,
    RefreshCw,
    X,
    ZoomIn,
    AlertTriangle,
    CheckCircle2,
    Info
} from 'lucide-react';
import { IMAGE_MODELS, getImageProvider, getImageModel } from '../services/imageProviders';
import { EngineConfig } from '../types';
import { save } from '@tauri-apps/plugin-dialog';
import { invoke } from '@tauri-apps/api/core';

interface GeneratedImage {
    id: string;
    url: string;
    prompt: string;
    aspectRatio: string;
    timestamp: number;
}

interface ImageGeneratorPanelProps {
    config: EngineConfig;
}

export const ImageGeneratorPanel: React.FC<ImageGeneratorPanelProps> = ({ config }) => {
    const [prompt, setPrompt] = useState('');
    const [isGenerating, setIsGenerating] = useState(false);
    const [images, setImages] = useState<GeneratedImage[]>([]);
    const [aspectRatio, setAspectRatio] = useState<"16:9" | "9:16">("16:9");
    const [numImages, setNumImages] = useState(1);
    const [error, setError] = useState<string | null>(null);
    const [lightboxImage, setLightboxImage] = useState<GeneratedImage | null>(null);
    const [selectedModel, setSelectedModel] = useState(IMAGE_MODELS[0].id);

    // Status Modal
    const [statusModal, setStatusModal] = useState<{
        open: boolean;
        type: 'progress' | 'success' | 'error';
        title: string;
        logs: string[];
    }>({ open: false, type: 'progress', title: '', logs: [] });
    const statusLogsRef = useRef<string[]>([]);

    const addStatusLog = (msg: string) => {
        statusLogsRef.current = [...statusLogsRef.current, msg];
        setStatusModal(prev => ({ ...prev, logs: [...statusLogsRef.current] }));
    };

    const handleGenerate = async () => {
        if (!prompt.trim()) return;

        setIsGenerating(true);
        setError(null);
        statusLogsRef.current = [];
        const modelInfo = getImageModel(selectedModel);
        setStatusModal({
            open: true,
            type: 'progress',
            title: `Gerando via ${modelInfo?.label ?? selectedModel}...`,
            logs: []
        });

        try {
            // Map aspect ratio to dimensions
            let width = 1024;
            let height = 1024;

            if (aspectRatio === "16:9") {
                width = 1792;
                height = 1024;
            } else if (aspectRatio === "9:16") {
                width = 1024;
                height = 1792;
            }

            // Resolve modelo e provider via registry
            const model = getImageModel(selectedModel);
            if (!model) {
                throw new Error(`Modelo "${selectedModel}" não encontrado.`);
            }

            const apiKey = config.apiKeys[model.apiKeyField];
            if (!apiKey) {
                throw new Error(`Chave de API para ${model.badge} não configurada. Vá em Configurações.`);
            }

            addStatusLog(`🔑 Usando provider: ${model.badge}`);
            addStatusLog(`📐 Dimensões: ${width}x${height} (${aspectRatio})`);
            addStatusLog(`🎯 Variações: ${numImages}`);

            const provider = getImageProvider(selectedModel);
            const result = await provider.generate(prompt, width, height, numImages, apiKey, addStatusLog);
            const resultUrls = result.urls;

            const newGeneratedImages: GeneratedImage[] = resultUrls.map(url => ({
                id: Math.random().toString(36).substr(2, 9),
                url: url,
                prompt: prompt,
                aspectRatio: aspectRatio,
                timestamp: Date.now()
            }));

            if (newGeneratedImages.length === 0) {
                throw new Error("Nenhuma imagem foi gerada.");
            }

            setImages(prev => [...newGeneratedImages, ...prev]);
            setStatusModal(prev => ({
                ...prev,
                type: 'success',
                title: 'Geração concluída!',
                logs: [...prev.logs, `✅ ${newGeneratedImages.length} imagem(ns) gerada(s) com sucesso!`]
            }));
        } catch (err) {
            console.error("Erro na geração:", err);
            const errorMsg = err instanceof Error ? err.message : "Erro desconhecido ao gerar imagens.";
            setError(errorMsg);
            setStatusModal(prev => ({
                ...prev,
                type: 'error',
                title: 'Falha na geração',
                logs: [...prev.logs, `❌ ${errorMsg}`]
            }));
        } finally {
            setIsGenerating(false);
        }
    };

    const handleDownload = async (image: GeneratedImage) => {
        try {
            // For remote URLs, we need to fetch the blob first
            const response = await fetch(image.url);
            const blob = await response.blob();
            const arrayBuffer = await blob.arrayBuffer();
            const byteArray = new Uint8Array(arrayBuffer);

            const filePath = await save({
                filters: [{ name: 'Images', extensions: ['png'] }],
                defaultPath: `generated-${image.id}.png`
            });

            if (filePath) {
                await invoke('write_file', { path: filePath, content: Array.from(byteArray) });
            }
        } catch (err) {
            console.error("Erro ao salvar:", err);
            alert("Erro ao salvar imagem: " + (err instanceof Error ? err.message : "Erro desconhecido"));
        }
    };

    const handleRemove = (id: string) => {
        setImages(prev => prev.filter(img => img.id !== id));
    };

    return (
        <div className="flex-1 flex flex-col h-full bg-[#F8FAFC] overflow-hidden p-6 gap-6 font-sans">
            {/* Main Content Area */}
            <div className="flex-1 flex flex-col min-h-0 gap-6">

                {/* Header Card - Estilo ElevenLabs */}
                <header className="bg-white rounded-[2rem] shadow-sm border border-slate-200 px-8 h-20 flex items-center justify-between shrink-0">
                    <div className="flex items-center gap-3">
                        <div className="p-2 bg-emerald-50 rounded-xl">
                            <ImageIcon className="w-5 h-5 text-emerald-600" />
                        </div>
                        <h1 className="text-lg font-bold text-slate-800">Gerador de Imagens AI</h1>
                        <div className="px-2 py-0.5 rounded-full bg-emerald-100 text-[10px] font-bold text-emerald-700 uppercase tracking-wider ml-2">
                            {getImageModel(selectedModel)?.label ?? selectedModel} ({getImageModel(selectedModel)?.badge})
                        </div>
                    </div>

                    <div className="flex items-center gap-4">
                        <div className="flex items-center gap-2 px-3 py-1.5 bg-slate-50 rounded-full border border-slate-100 text-xs font-medium text-slate-600">
                            <span className="text-emerald-500">●</span>
                            Pronto para criar
                        </div>
                    </div>
                </header>

                {/* Editor Area */}
                <div className="shrink-0 flex flex-col bg-white rounded-[2rem] shadow-sm border border-slate-200 overflow-hidden h-[280px]">
                    <div className="flex-1 flex flex-col relative">
                        <textarea
                            value={prompt}
                            onChange={(e) => setPrompt(e.target.value)}
                            placeholder="Descreva a cena cinematográfica que você tem em mente... Use detalhes como iluminação, estilo artístico e composição."
                            className="w-full h-full p-8 md:p-12 text-lg md:text-xl text-slate-800 placeholder:text-slate-300 resize-none outline-none !border-none !shadow-none !ring-0 bg-transparent font-medium leading-relaxed custom-scrollbar focus:bg-slate-50/50 hover:bg-slate-50/20 transition-colors cursor-default caret-emerald-600"
                            spellCheck={false}
                        />
                    </div>

                    {/* Integrated Command Bar */}
                    <div className="flex items-center justify-between px-8 py-6 border-t-0">
                        <div className="flex items-center gap-3">
                            <div className="flex items-center bg-slate-100 rounded-xl p-1">
                                <button
                                    onClick={() => setAspectRatio("16:9")}
                                    className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-2 ${aspectRatio === '16:9' ? 'bg-white text-slate-800 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
                                >
                                    <Layout size={14} /> 16:9
                                </button>
                                <button
                                    onClick={() => setAspectRatio("9:16")}
                                    className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-2 ${aspectRatio === '9:16' ? 'bg-white text-slate-800 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
                                >
                                    <div className="w-3.5 h-3.5 border-2 border-current rounded-[2px]" /> 9:16
                                </button>
                            </div>

                            <div className="h-4 w-px bg-slate-200" />

                            <div className="flex items-center gap-2 text-xs font-bold text-slate-500">
                                <Layers size={14} />
                                <span className="mr-1">Variações:</span>
                                <select
                                    value={numImages}
                                    onChange={(e) => setNumImages(Number(e.target.value))}
                                    className="bg-slate-50 border-none rounded-lg px-2 py-1 text-xs cursor-pointer focus:ring-1 focus:ring-emerald-500 outline-none"
                                >
                                    <option value={1}>1</option>
                                    <option value={2}>2</option>
                                    <option value={4}>4</option>
                                </select>
                            </div>

                            <div className="h-4 w-px bg-slate-200" />

                            <div className="flex items-center gap-2 text-xs font-bold text-slate-500">
                                <Sparkles size={14} />
                                <span className="mr-1">Modelo:</span>
                                <select
                                    value={selectedModel}
                                    onChange={(e) => setSelectedModel(e.target.value)}
                                    className="bg-slate-50 border-none rounded-lg px-2 py-1 text-xs cursor-pointer focus:ring-1 focus:ring-emerald-500 outline-none"
                                >
                                    {IMAGE_MODELS.map(m => (
                                        <option key={m.id} value={m.id}>{m.label}</option>
                                    ))}
                                </select>
                            </div>
                        </div>

                        <div className="flex items-center gap-3">
                            {error && (
                                <button
                                    onClick={() => setStatusModal(prev => ({ ...prev, open: true }))}
                                    className="text-red-500 text-[10px] font-bold max-w-[250px] truncate hover:underline cursor-pointer"
                                    title="Clique para ver detalhes"
                                >
                                    ⚠️ {error} (ver detalhes)
                                </button>
                            )}
                            <button
                                onClick={handleGenerate}
                                disabled={!prompt.trim() || isGenerating}
                                className="px-8 py-3 bg-[#0D9488] text-white rounded-full font-bold text-sm hover:bg-[#0F766E] disabled:opacity-50 disabled:cursor-not-allowed transition-all shadow-lg shadow-emerald-900/10 flex items-center gap-2"
                            >
                                {isGenerating ? (
                                    <>
                                        <Loader2 size={16} className="animate-spin" />
                                        Gerando...
                                    </>
                                ) : (
                                    <>
                                        Gerar imagens
                                        <ArrowUp size={16} className="stroke-[3]" />
                                    </>
                                )}
                            </button>
                        </div>
                    </div>
                </div>

                {/* Gallery Area - Bottom Scrollable */}
                <div className="overflow-y-auto flex-1 custom-scrollbar min-h-0 pb-10">
                    <div className="w-full">
                        <div className="flex items-center justify-between mb-6">
                            <h2 className="text-sm font-bold text-slate-400 uppercase tracking-widest">Suas Criações</h2>
                            {images.length > 0 && (
                                <button
                                    onClick={() => setImages([])}
                                    className="text-[10px] font-bold text-slate-400 hover:text-red-500 transition-colors uppercase"
                                >
                                    Limpar Tudo
                                </button>
                            )}
                        </div>

                        {images.length > 0 ? (
                            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-8 pb-10">
                                {images.map(image => (
                                    <div
                                        key={image.id}
                                        className="group relative bg-white border border-slate-200 rounded-[2rem] overflow-hidden shadow-sm hover:shadow-xl transition-all duration-300 cursor-pointer"
                                        onClick={() => setLightboxImage(image)}
                                    >
                                        <div className={`${image.aspectRatio === '16:9' ? 'aspect-video' : 'aspect-[9/16]'} bg-slate-50 overflow-hidden`}>
                                            <img
                                                src={image.url}
                                                alt="Imagem gerada"
                                                className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-110"
                                            />
                                        </div>

                                        {/* Actions Overlay */}
                                        <div className="absolute inset-0 bg-slate-900/30 opacity-0 group-hover:opacity-100 transition-opacity backdrop-blur-[2px] flex items-center justify-center gap-3">
                                            <button
                                                onClick={(e) => { e.stopPropagation(); setLightboxImage(image); }}
                                                className="bg-white hover:bg-emerald-50 text-slate-800 hover:text-emerald-600 p-4 rounded-full shadow-2xl scale-90 group-hover:scale-100 transition-all duration-300"
                                            >
                                                <ZoomIn size={20} />
                                            </button>
                                            <button
                                                onClick={(e) => { e.stopPropagation(); handleDownload(image); }}
                                                className="bg-white hover:bg-emerald-50 text-slate-800 hover:text-emerald-600 p-4 rounded-full shadow-2xl scale-90 group-hover:scale-100 transition-all duration-300 delay-75"
                                            >
                                                <Download size={20} />
                                            </button>
                                            <button
                                                onClick={(e) => { e.stopPropagation(); handleRemove(image.id); }}
                                                className="bg-white hover:bg-red-50 text-slate-800 hover:text-red-500 p-4 rounded-full shadow-2xl scale-90 group-hover:scale-100 transition-all duration-300 delay-150"
                                            >
                                                <Trash2 size={20} />
                                            </button>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        ) : (
                            <div className="bg-white border-2 border-dashed border-slate-200 rounded-[2rem] p-16 flex flex-col items-center justify-center text-center">
                                <div className="w-16 h-16 bg-slate-50 rounded-2xl flex items-center justify-center mb-6">
                                    <ImageIcon className="w-8 h-8 text-slate-300" />
                                </div>
                                <h3 className="text-lg font-bold text-slate-800 mb-2">Inicie sua primeira criação</h3>
                                <p className="text-sm text-slate-400 max-w-xs leading-relaxed">As imagens geradas aparecerão aqui. Use o editor acima para começar.</p>
                            </div>
                        )}
                    </div>
                </div>
            </div>

            {/* Lightbox Modal */}
            {lightboxImage && (
                <div
                    className="fixed inset-0 z-50 bg-black/90 flex items-center justify-center p-4 animate-in fade-in duration-200"
                    onClick={() => setLightboxImage(null)}
                >
                    {/* Close button */}
                    <button
                        onClick={() => setLightboxImage(null)}
                        className="absolute top-6 right-6 bg-white/10 hover:bg-white/20 text-white p-3 rounded-full transition-colors z-10"
                    >
                        <X size={24} />
                    </button>

                    {/* Action buttons */}
                    <div className="absolute bottom-8 flex items-center gap-3 z-10">
                        <button
                            onClick={(e) => { e.stopPropagation(); handleDownload(lightboxImage); }}
                            className="bg-white/10 hover:bg-white/20 text-white px-5 py-3 rounded-full transition-colors flex items-center gap-2 text-sm font-medium backdrop-blur-sm"
                        >
                            <Download size={16} /> Download
                        </button>
                        <button
                            onClick={(e) => { e.stopPropagation(); handleRemove(lightboxImage.id); setLightboxImage(null); }}
                            className="bg-white/10 hover:bg-red-500/50 text-white px-5 py-3 rounded-full transition-colors flex items-center gap-2 text-sm font-medium backdrop-blur-sm"
                        >
                            <Trash2 size={16} /> Remover
                        </button>
                    </div>

                    {/* Image */}
                    <img
                        src={lightboxImage.url}
                        alt="Imagem em tamanho completo"
                        className="max-w-[90vw] max-h-[85vh] object-contain rounded-lg shadow-2xl"
                        onClick={(e) => e.stopPropagation()}
                    />
                </div>
            )}

            {/* Status Modal */}
            {statusModal.open && (
                <div className="fixed inset-0 z-[60] bg-black/60 flex items-center justify-center p-4 animate-in fade-in duration-200">
                    <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg overflow-hidden">
                        {/* Header */}
                        <div className={`px-6 py-4 flex items-center gap-3 ${statusModal.type === 'progress' ? 'bg-blue-50 text-blue-700' :
                            statusModal.type === 'success' ? 'bg-emerald-50 text-emerald-700' :
                                'bg-red-50 text-red-700'
                            }`}>
                            {statusModal.type === 'progress' && <Loader2 size={20} className="animate-spin" />}
                            {statusModal.type === 'success' && <CheckCircle2 size={20} />}
                            {statusModal.type === 'error' && <AlertTriangle size={20} />}
                            <h3 className="font-bold text-base flex-1">{statusModal.title}</h3>
                            {statusModal.type !== 'progress' && (
                                <button
                                    onClick={() => setStatusModal(prev => ({ ...prev, open: false }))}
                                    className="p-1 hover:bg-black/10 rounded-full transition"
                                >
                                    <X size={16} />
                                </button>
                            )}
                        </div>

                        {/* Logs */}
                        <div className="px-6 py-4 h-[300px] overflow-y-auto space-y-1.5">
                            {statusModal.logs.map((log, i) => (
                                <div key={i} className="text-sm text-slate-700 font-mono flex items-start gap-2">
                                    <span className="text-slate-300 text-xs mt-0.5 select-none">{String(i + 1).padStart(2, '0')}</span>
                                    <span className="break-all">{log}</span>
                                </div>
                            ))}
                            {statusModal.type === 'progress' && statusModal.logs.length > 0 && (
                                <div className="text-sm text-blue-400 font-mono flex items-center gap-2 animate-pulse">
                                    <Loader2 size={12} className="animate-spin" />
                                    Processando...
                                </div>
                            )}
                        </div>

                        {/* Footer */}
                        <div className="px-6 py-4 border-t border-slate-100 flex justify-end">
                            <button
                                onClick={() => setStatusModal(prev => ({ ...prev, open: false }))}
                                disabled={statusModal.type === 'progress'}
                                className={`px-6 py-2.5 rounded-full font-bold text-sm text-white transition ${statusModal.type === 'progress'
                                        ? 'bg-slate-300 cursor-not-allowed'
                                        : statusModal.type === 'success'
                                            ? 'bg-emerald-600 hover:bg-emerald-500'
                                            : 'bg-red-600 hover:bg-red-500'
                                    }`}
                            >
                                {statusModal.type === 'progress' ? 'Aguarde...' : 'Fechar'}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};
