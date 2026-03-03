import React, { useState, useEffect } from 'react';
import {
    Search,
    Image as ImageIcon,
    Film,
    X,
    Download,
    Loader2,
    Camera,
    ChevronLeft,
    SearchX,
    ExternalLink,
    Check
} from 'lucide-react';
import { PexelsService, PexelsPhoto, PexelsVideo } from '../services/PexelsService';
import { EngineConfig } from '../types';

interface PexelsHubProps {
    config: EngineConfig;
    mode: 'hub' | 'picker';
    initialQuery?: string;
    onClose?: () => void;
    onSelect?: (url: string, type: 'IMAGE' | 'VIDEO', alt?: string) => void;
}

export const PexelsHub: React.FC<PexelsHubProps> = ({
    config,
    mode,
    initialQuery = '',
    onClose,
    onSelect
}) => {
    const [query, setQuery] = useState(initialQuery);
    const [tab, setTab] = useState<'PHOTOS' | 'VIDEOS'>('PHOTOS');
    const [loading, setLoading] = useState(false);
    const [photos, setPhotos] = useState<PexelsPhoto[]>([]);
    const [videos, setVideos] = useState<PexelsVideo[]>([]);
    const [error, setError] = useState<string | null>(null);
    const [translatedQuery, setTranslatedQuery] = useState<string>('');

    const apiKey = config.apiKeys.pexels || '';

    const handleSearch = async (e?: React.FormEvent) => {
        if (e) e.preventDefault();
        if (!query.trim() || !apiKey) return;

        setLoading(true);
        setError(null);

        try {
            // 1. Traduzir a busca para inglês usando Gemini
            const translated = await PexelsService.translateQuery(query, config);
            setTranslatedQuery(translated);

            // 2. Buscar usando a query traduzida
            if (tab === 'PHOTOS') {
                const res = await PexelsService.searchPhotos(translated, apiKey);
                setPhotos(res.photos || []);
            } else {
                const res = await PexelsService.searchVideos(translated, apiKey);
                setVideos(res.videos || []);
            }
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Erro ao buscar no Pexels');
        } finally {
            setLoading(false);
        }
    };

    // Re-trigger search when tab changes if there's a query
    useEffect(() => {
        if (query.trim() && apiKey) {
            handleSearch();
        }
    }, [tab]);

    // Initial search if query provided
    useEffect(() => {
        if (initialQuery.trim() && apiKey) {
            handleSearch();
        }
    }, []);

    const content = (
        <div className={`flex flex-col h-full bg-[#F8FAFC] overflow-hidden ${mode === 'picker' ? 'rounded-[2.5rem]' : ''}`}>
            {/* Header Area */}
            <div className={`px-8 py-6 bg-white border-b border-[#E2E8F0] shrink-0`}>
                <div className="flex items-center justify-between mb-8">
                    <div className="flex items-center gap-4">
                        {onClose && (
                            <button
                                onClick={onClose}
                                className="p-2 hover:bg-slate-100 rounded-xl text-slate-500 transition-colors mr-2"
                            >
                                <ChevronLeft size={20} />
                            </button>
                        )}
                        <div className="w-12 h-12 bg-slate-900 rounded-2xl flex items-center justify-center shadow-lg">
                            {tab === 'PHOTOS' ? <ImageIcon className="text-white w-6 h-6" /> : <Film className="text-white w-6 h-6" />}
                        </div>
                        <div>
                            <h2 className="text-2xl font-bold text-slate-900 tracking-tight">
                                {mode === 'hub' ? 'Pexels Hub' : 'Selecionar Mídia'}
                            </h2>
                            <p className="text-sm text-slate-500 font-medium tracking-wide">
                                {tab === 'PHOTOS' ? 'Imagens gratuitas de alta qualidade' : 'Vídeos cinemáticos gratuitos'}
                            </p>
                        </div>
                    </div>

                    <div className="flex items-center gap-3">
                        <div className="flex items-center bg-slate-100 rounded-2xl p-1 shadow-inner border border-slate-200">
                            <button
                                onClick={() => setTab('PHOTOS')}
                                className={`px-6 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-2 ${tab === 'PHOTOS' ? 'bg-white text-slate-900 shadow-sm border border-slate-200' : 'text-slate-500 hover:text-slate-900'}`}
                            >
                                <ImageIcon size={14} /> Fotos
                            </button>
                            <button
                                onClick={() => setTab('VIDEOS')}
                                className={`px-6 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-2 ${tab === 'VIDEOS' ? 'bg-white text-slate-900 shadow-sm border border-slate-200' : 'text-slate-500 hover:text-slate-900'}`}
                            >
                                <Film size={14} /> Vídeos
                            </button>
                        </div>
                        {mode === 'picker' && onClose && (
                            <button
                                onClick={onClose}
                                className="p-2 bg-slate-100 hover:bg-red-50 hover:text-red-500 rounded-xl text-slate-400 transition-all ml-2"
                            >
                                <X size={20} />
                            </button>
                        )}
                    </div>
                </div>

                {/* Sub-Header: Search & Stats */}
                <div className="flex flex-col md:flex-row gap-6 items-center">
                    <form onSubmit={handleSearch} className="relative w-full max-w-2xl group">
                        <input
                            type="text"
                            value={query}
                            onChange={(e) => setQuery(e.target.value)}
                            placeholder="Buscar por natureza, tecnologia, pessoas, arquitetura..."
                            className="w-full bg-slate-50 border border-slate-200 rounded-2xl px-6 py-4 pl-14 text-base font-medium text-slate-900 outline-none focus:bg-white focus:border-primary focus:ring-4 focus:ring-primary/5 transition-all shadow-sm"
                        />
                        <Search className="absolute left-5 top-4 text-slate-400 group-focus-within:text-primary transition-colors" size={22} />
                        <button
                            type="submit"
                            disabled={loading || !query.trim()}
                            className="absolute right-3 top-2 bottom-2 bg-slate-900 text-white rounded-xl px-8 text-sm font-bold hover:bg-primary transition-all disabled:opacity-50 active:scale-95 shadow-lg shadow-slate-900/10"
                        >
                            {loading ? <Loader2 size={18} className="animate-spin" /> : 'Buscar'}
                        </button>
                    </form>

                    <div className="flex items-center gap-8">
                        <div className="flex flex-col">
                            <span className="text-[10px] text-slate-400 font-bold uppercase tracking-widest leading-none mb-1">Resultados</span>
                            <span className="text-xl font-bold text-slate-700 leading-none">{tab === 'PHOTOS' ? photos.length : videos.length}</span>
                        </div>
                        <div className="w-px h-8 bg-slate-200" />
                        <div className="flex flex-col">
                            <span className="text-[10px] text-slate-400 font-bold uppercase tracking-widest leading-none mb-1">Status API</span>
                            <div className="flex items-center gap-1.5 leading-none">
                                <div className={`w-2 h-2 rounded-full ${apiKey ? 'bg-emerald-500' : 'bg-red-500'}`} />
                                <span className="text-sm font-bold text-slate-700">{apiKey ? 'Conectado' : 'Sem Chave'}</span>
                            </div>
                        </div>
                    </div>
                </div>

                {/* AI Translation Feedback */}
                {translatedQuery && translatedQuery.toLowerCase() !== query.toLowerCase() && (
                    <div className="mt-4 flex items-center gap-2 animate-in fade-in slide-in-from-top-1 duration-500">
                        <div className="bg-primary/10 text-primary px-3 py-1 rounded-lg flex items-center gap-2 border border-primary/20">
                            <span className="text-[10px] font-black uppercase tracking-widest">Busca Otimizada (AI):</span>
                            <span className="text-sm font-bold italic">"{translatedQuery}"</span>
                        </div>
                        <button
                            type="button"
                            onClick={() => {
                                setQuery(translatedQuery);
                                handleSearch();
                            }}
                            className="text-[10px] font-bold text-slate-400 hover:text-primary transition-colors"
                        >
                            Usar este termo
                        </button>
                    </div>
                )}
            </div>

            {/* Content Area */}
            <div className="flex-1 overflow-y-auto p-8 custom-scrollbar">
                {error && (
                    <div className="bg-red-50 border border-red-100 rounded-[2.5rem] p-12 text-center max-w-2xl mx-auto shadow-sm">
                        <div className="w-16 h-16 bg-red-100 rounded-3xl flex items-center justify-center text-red-500 mx-auto mb-6">
                            <SearchX size={32} />
                        </div>
                        <h3 className="text-xl font-bold text-red-900 mb-2">Ops! Algo deu errado</h3>
                        <p className="text-red-700 font-medium mb-6">{error}</p>
                        {!apiKey && (
                            <div className="bg-white/50 border border-red-200 rounded-2xl p-4 inline-block">
                                <p className="text-red-600 text-sm font-bold">Você precisa configurar sua Pexels API Key nas configurações para ver os resultados.</p>
                            </div>
                        )}
                    </div>
                )}

                {!loading && !error && photos.length === 0 && videos.length === 0 && (
                    <div className="h-full flex flex-col items-center justify-center text-center">
                        <div className="w-48 h-48 bg-white border border-slate-100 rounded-full flex items-center justify-center mb-8 shadow-2xl shadow-slate-200/50">
                            <ImageIcon size={64} className="text-slate-100" />
                        </div>
                        <h3 className="text-3xl font-black text-slate-900 mb-4 tracking-tight">Hub Criativo Pexels</h3>
                        <p className="text-slate-400 text-lg max-w-lg leading-relaxed font-medium">
                            Encontre milhares de recursos gratuitos. {mode === 'picker' ? 'Clique em uma mídia para selecioná-la.' : 'Imagens e vídeos podem ser abertos ou usados em seus projetos.'}
                        </p>
                    </div>
                )}

                {loading && (
                    <div className="h-full flex flex-col items-center justify-center">
                        <div className="relative">
                            <div className="w-16 h-16 border-4 border-primary/20 border-t-primary rounded-full animate-spin" />
                            <Loader2 size={24} className="absolute inset-0 m-auto text-primary animate-pulse" />
                        </div>
                        <p className="mt-6 text-sm font-black text-slate-400 uppercase tracking-[0.2em]">Otimizando e buscando...</p>
                    </div>
                )}

                {!loading && !error && (
                    <div className={`grid gap-8 ${mode === 'picker' ? 'grid-cols-2 md:grid-cols-3 lg:grid-cols-4' : 'grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5'}`}>
                        {tab === 'PHOTOS' ? (
                            photos.map(photo => (
                                <div
                                    key={photo.id}
                                    className="group relative aspect-[3/4] bg-white rounded-[2rem] overflow-hidden border border-slate-100 hover:shadow-2xl hover:shadow-primary/10 transition-all duration-500 cursor-pointer"
                                    onClick={() => {
                                        if (mode === 'picker' && onSelect) {
                                            onSelect(photo.src.large2x, 'IMAGE', photo.alt);
                                        } else {
                                            window.open(photo.url, '_blank');
                                        }
                                    }}
                                >
                                    <img
                                        src={photo.src.large}
                                        alt={photo.alt}
                                        className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-700"
                                    />

                                    {/* Overlay Info */}
                                    <div className="absolute inset-0 bg-gradient-to-t from-slate-950 via-slate-900/20 to-transparent opacity-0 group-hover:opacity-100 transition-all duration-500 p-6 flex flex-col justify-end">
                                        <div className="flex items-center gap-2 text-white/60 text-[10px] font-black uppercase tracking-widest mb-2">
                                            <Camera size={12} className="text-primary" /> {photo.photographer}
                                        </div>
                                        <div className="flex items-center justify-between">
                                            <span className="text-white text-sm font-bold truncate pr-4">{photo.alt || 'Cena Pexels'}</span>
                                            <div className="bg-white text-slate-900 p-2.5 rounded-2xl shadow-lg hover:bg-primary hover:text-white transition-all transform hover:scale-110">
                                                {mode === 'picker' ? <Check size={16} /> : <ExternalLink size={16} />}
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            ))
                        ) : (
                            videos.map(video => (
                                <div
                                    key={video.id}
                                    className="group relative aspect-[3/4] bg-white rounded-[2rem] overflow-hidden border border-slate-100 hover:shadow-2xl hover:shadow-primary/10 transition-all duration-500 cursor-pointer"
                                    onClick={() => {
                                        const hdFile = video.video_files.find(f => f.quality === 'hd') || video.video_files[0];
                                        if (mode === 'picker' && onSelect) {
                                            onSelect(hdFile.link, 'VIDEO', video.url);
                                        } else {
                                            window.open(hdFile.link, '_blank');
                                        }
                                    }}
                                >
                                    <img
                                        src={video.image}
                                        alt="Video thumbnail"
                                        className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-700"
                                    />

                                    {/* Video Duration Badge */}
                                    <div className="absolute top-4 right-4 bg-black/40 backdrop-blur-xl px-3 py-1 rounded-xl text-[10px] font-black text-white flex items-center gap-1.5 border border-white/10">
                                        <Film size={12} className="text-primary" /> {video.duration}s
                                    </div>

                                    {/* Overlay Info */}
                                    <div className="absolute inset-0 bg-gradient-to-t from-slate-950 via-slate-900/20 to-transparent opacity-0 group-hover:opacity-100 transition-all duration-500 p-6 flex flex-col justify-end">
                                        <div className="flex items-center gap-2 text-white/60 text-[10px] font-black uppercase tracking-widest mb-2">
                                            <Camera size={12} className="text-primary" /> {video.user.name}
                                        </div>
                                        <div className="flex items-center justify-between">
                                            <span className="text-white text-sm font-bold truncate pr-4">Cinematic Footage</span>
                                            <div className="bg-white text-slate-900 p-2.5 rounded-2xl shadow-lg hover:bg-primary hover:text-white transition-all transform hover:scale-110">
                                                {mode === 'picker' ? <Check size={16} /> : <ExternalLink size={16} />}
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            ))
                        )}
                    </div>
                )}
            </div>

            {/* Footer Status */}
            <div className="px-8 py-4 bg-white border-t border-slate-100 flex items-center justify-between shrink-0">
                <div className="flex items-center gap-6">
                    <p className="text-[10px] font-black text-slate-300 uppercase tracking-[0.2em] flex items-center gap-3">
                        powered by <span className="text-slate-400">Pexels Ecosystem</span>
                        <div className="w-1 h-1 rounded-full bg-slate-200" />
                        AI Search Enabled
                    </p>
                </div>
                <div className="flex items-center gap-4">
                    <div className="flex items-center gap-2 px-3 py-1 bg-emerald-50 text-emerald-600 border border-emerald-100 rounded-full">
                        <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                        <span className="text-[10px] font-black uppercase">Service Active</span>
                    </div>
                </div>
            </div>
        </div>
    );

    if (mode === 'picker') {
        return (
            <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 md:p-8 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-300">
                <div
                    className="w-full max-w-6xl h-full max-h-[90vh] shadow-2xl animate-in zoom-in-95 duration-300"
                    onClick={(e) => e.stopPropagation()}
                >
                    {content}
                </div>
            </div>
        );
    }

    return content;
};
