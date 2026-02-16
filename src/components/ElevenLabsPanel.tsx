import React, { useState, useEffect } from 'react';
import { Mic, Zap, Play, Search, AlertTriangle, RefreshCw, Settings2, Bookmark, ChevronRight, X, ChevronDown, Check, Download, Loader2 } from 'lucide-react';
import { ElevenLabsService } from '../services/ElevenLabsService';
import { ElevenLabsVoice, ElevenLabsModel, ElevenLabsUser, ElevenLabsSettings } from '../types';

interface ElevenLabsPanelProps {
    apiKey: string;
    onClose: () => void;
}

export const ElevenLabsPanel: React.FC<ElevenLabsPanelProps> = ({ apiKey, onClose }) => {
    const [service] = useState(new ElevenLabsService(apiKey));
    const [voices, setVoices] = useState<ElevenLabsVoice[]>([]);
    const [models, setModels] = useState<ElevenLabsModel[]>([]);
    const [user, setUser] = useState<ElevenLabsUser | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    // States
    const [selectedVoiceId, setSelectedVoiceId] = useState<string>('');
    const [selectedModelId, setSelectedModelId] = useState<string>('eleven_multilingual_v2');
    const [text, setText] = useState<string>('');
    const [settings, setSettings] = useState<ElevenLabsSettings>({
        stability: 0.5,
        similarity_boost: 0.75,
    });

    // UI States
    const [isVoiceSelectorOpen, setIsVoiceSelectorOpen] = useState(false);
    const [isModelSelectorOpen, setIsModelSelectorOpen] = useState(false);
    const [voiceSearch, setVoiceSearch] = useState('');
    const [favorites, setFavorites] = useState<Set<string>>(new Set());
    const [viewMode, setViewMode] = useState<'all' | 'favorites'>('all');
    const [audioUrl, setAudioUrl] = useState<string | null>(null);
    const [isGenerating, setIsGenerating] = useState(false);

    // Load Data
    useEffect(() => {
        const loadData = async () => {
            if (!apiKey) {
                setError('API Key não configurada.');
                setLoading(false);
                return;
            }

            try {
                setLoading(true);
                const [voicesData, modelsData, userData] = await Promise.all([
                    service.getVoices(),
                    service.getModels(),
                    service.getUserInfo()
                ]);

                setVoices(voicesData);
                setModels(modelsData);
                setUser(userData);

                // Load favorites from localStorage
                const savedFavs = localStorage.getItem('elevenlabs_favorites');
                if (savedFavs) {
                    setFavorites(new Set(JSON.parse(savedFavs)));
                }

                if (voicesData.length > 0) {
                    setSelectedVoiceId(voicesData[0].voice_id);
                }
            } catch (err: any) {
                setError(err.message || 'Erro ao carregar dados da Eleven Labs');
            } finally {
                setLoading(false);
            }
        };

        loadData();
    }, [apiKey, service]);

    // Save favorites when changed
    useEffect(() => {
        localStorage.setItem('elevenlabs_favorites', JSON.stringify(Array.from(favorites)));
    }, [favorites]);

    const toggleFavorite = (e: React.MouseEvent, voiceId: string) => {
        e.stopPropagation();
        setFavorites(prev => {
            const next = new Set(prev);
            if (next.has(voiceId)) next.delete(voiceId);
            else next.add(voiceId);
            return next;
        });
    };

    const handleProcess = async () => {
        if (!selectedVoiceId || !text.trim()) return;

        setIsGenerating(true);
        setError(null);
        setAudioUrl(null);

        try {
            const blob = await service.generateAudio(selectedVoiceId, text, selectedModelId, settings);
            const url = URL.createObjectURL(blob);
            setAudioUrl(url);

            // Atualizar créditos do usuário
            try {
                const updatedUser = await service.getUserInfo();
                setUser(updatedUser);
            } catch (userErr) {
                console.warn('Falha ao atualizar créditos:', userErr);
            }
        } catch (err: any) {
            setError(err.message || 'Erro ao gerar áudio');
        } finally {
            setIsGenerating(false);
        }
    };

    const handleDownload = () => {
        if (!audioUrl) return;
        const link = document.createElement('a');
        link.href = audioUrl;
        link.download = `elevenlabs_${selectedVoice?.name.replace(/\s+/g, '_') || 'audio'}_${Date.now()}.mp3`;
        document.body.appendChild(link);
        link.click();

        // Pequeno delay para garantir que o download inicie antes de remover o elemento
        setTimeout(() => {
            document.body.removeChild(link);
        }, 100);
    };

    const selectedVoice = voices.find(v => v.voice_id === selectedVoiceId);
    const selectedModel = models.find(m => m.model_id === selectedModelId);

    const filteredVoices = voices.filter(v => {
        const matchSearch = v.name.toLowerCase().includes(voiceSearch.toLowerCase()) ||
            v.category.toLowerCase().includes(voiceSearch.toLowerCase());
        if (viewMode === 'favorites') return matchSearch && favorites.has(v.voice_id);
        return matchSearch;
    });

    if (loading) return (
        <div className="flex-1 flex items-center justify-center bg-white">
            <div className="flex flex-col items-center gap-3">
                <div className="w-8 h-8 border-2 border-black border-t-transparent rounded-full animate-spin" />
                <span className="text-sm font-medium text-slate-500">Carregando Estúdio...</span>
            </div>
        </div>
    );

    return (
        <div className="flex h-full w-full bg-[#F8FAFC] relative font-sans text-[#0F172A] p-6 gap-6">

            {/* ================= MAIN AREA (LEFT) ================= */}
            <div className="flex-1 flex flex-col h-full overflow-hidden gap-6">

                {/* Header Card */}
                <header className="bg-white rounded-[2rem] shadow-sm border border-slate-200 px-8 h-20 flex items-center justify-between shrink-0">
                    {/* Left Header */}
                    <div className="flex items-center gap-2">
                        <button onClick={onClose} className="p-2 -ml-2 hover:bg-slate-50 rounded-full transition-colors text-slate-400 hover:text-slate-800">
                            <ChevronRight className="rotate-180 w-5 h-5" />
                        </button>
                        <h1 className="text-lg font-semibold text-slate-800">Texto para Fala</h1>
                    </div>
                    {/* Right Header */}
                    <div className="flex items-center gap-3">
                        {user && (
                            <div className="flex items-center gap-2 px-3 py-1.5 bg-slate-50 rounded-full border border-slate-100 text-xs font-medium text-slate-600">
                                <span className={user.subscription.character_count > user.subscription.character_limit ? "text-red-500" : "text-emerald-500"}>●</span>
                                {(user.subscription.character_limit - user.subscription.character_count).toLocaleString()} caracteres restantes
                            </div>
                        )}
                    </div>
                </header>

                {/* Editor Card */}
                <div className="flex-1 flex flex-col bg-white rounded-[2rem] shadow-sm border border-slate-200 overflow-hidden relative">

                    {/* Text Area */}
                    <div className="flex-1 overflow-hidden relative group">
                        <textarea
                            value={text}
                            onChange={(e) => setText(e.target.value)}
                            className="w-full h-full p-8 md:p-12 text-lg md:text-xl text-slate-800 placeholder:text-slate-300 resize-none outline-none border-none bg-white font-medium leading-relaxed custom-scrollbar cursor-default caret-blue-600 focus:bg-slate-50/50 hover:bg-slate-50/20 transition-colors"
                            placeholder="Comece a digitar aqui ou cole qualquer texto que você queira transformar em fala realista..."
                            spellCheck={false}
                        />
                        {/* Action Floating Bar */}
                        <div className="absolute bottom-8 right-8 flex items-center gap-3 transition-opacity duration-300 z-10">
                            <button
                                onClick={() => setText('')}
                                className={`px-4 py-2 text-sm font-medium text-slate-400 hover:text-slate-600 transition-colors ${!text && 'opacity-0 pointer-events-none'}`}
                            >
                                Limpar
                            </button>
                            <button
                                onClick={handleProcess}
                                disabled={!text.trim() || isGenerating}
                                className="px-6 py-3 bg-black text-white rounded-full font-medium text-sm hover:opacity-90 disabled:opacity-50 disabled:cursor-not-allowed transition-all shadow-lg shadow-black/10 flex items-center gap-2"
                            >
                                {isGenerating ? (
                                    <>
                                        <Loader2 size={16} className="animate-spin" />
                                        Gerando...
                                    </>
                                ) : (
                                    <>
                                        Gerar áudio
                                        <Zap size={16} className="fill-white" />
                                    </>
                                )}
                            </button>
                        </div>

                        {/* Audio Player Floating Bar (Shows when audio exists) */}
                        {audioUrl && (
                            <div className="absolute bottom-8 left-8 right-auto flex items-center gap-4 p-4 bg-white/90 backdrop-blur-md rounded-2xl border border-slate-200 shadow-xl z-20 animate-in slide-in-from-bottom-5 duration-300">
                                <audio controls src={audioUrl} className="h-8 w-64" />
                                <div className="h-8 w-[1px] bg-slate-200" />
                                <button
                                    onClick={handleDownload}
                                    className="flex items-center gap-2 text-sm font-medium text-slate-700 hover:text-emerald-600 transition-colors"
                                >
                                    <Download size={16} />
                                    <span>Download MP3</span>
                                </button>
                            </div>
                        )}
                    </div>
                </div>
            </div>


            {/* ================= SETTINGS SIDEBAR (RIGHT) ================= */}
            <aside className="w-[400px] shrink-0 flex flex-col h-full z-20 bg-white rounded-[2rem] shadow-sm border border-slate-200 overflow-hidden">
                {/* Tabs */}
                <div className="flex items-center px-4 pt-4 border-b border-transparent">
                    <button className="pb-3 px-1 text-sm font-semibold text-black border-b-2 border-black">Configurações</button>
                    <button className="pb-3 px-4 text-sm font-medium text-slate-400 hover:text-slate-600">Histórico</button>
                </div>

                <div className="flex-1 overflow-y-auto p-4 flex flex-col gap-8 custom-scrollbar">

                    {/* Studio Banner */}
                    <div className="p-4 rounded-xl bg-gradient-to-r from-blue-500 to-indigo-600 text-white relative overflow-hidden group cursor-pointer shadow-blue-200/50 shadow-lg">
                        <div className="relative z-10">
                            <div className="flex flex-col gap-1">
                                <h3 className="font-bold text-sm">Revisar Vozes</h3>
                                <p className="text-xs text-white/80 leading-relaxed">Verifique seu histórico de áudios gerados.</p>
                            </div>
                        </div>
                        <div className="absolute top-0 right-0 p-2 cursor-pointer opacity-0 group-hover:opacity-100 transition-opacity">
                            <X className="w-4 h-4 text-white/50 hover:text-white" />
                        </div>
                        {/* Decorative circles */}
                        <div className="absolute -bottom-4 -right-4 w-16 h-16 bg-white/10 rounded-full blur-xl" />
                    </div>

                    {/* Voice Selector */}
                    <div className="flex flex-col gap-2">
                        <label className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Voz</label>
                        <div className="relative">
                            <button
                                onClick={() => setIsVoiceSelectorOpen(true)}
                                className="w-full flex items-center justify-between p-3 bg-white border border-slate-200 rounded-xl hover:border-slate-300 transition-all group shadow-sm"
                            >
                                <div className="flex items-center gap-3">
                                    <div className="w-8 h-8 rounded-full bg-gradient-to-br from-purple-100 to-pink-100 flex items-center justify-center text-purple-600 font-bold text-xs ring-2 ring-white shadow-sm">
                                        {selectedVoice?.name.charAt(0)}
                                    </div>
                                    <div className="flex flex-col items-start">
                                        <span className="text-sm font-semibold text-slate-800">{selectedVoice?.name}</span>
                                        <span className="text-xs text-slate-400">{selectedVoice?.category || 'Gerado'}</span>
                                    </div>
                                </div>
                                <ChevronRight className="w-4 h-4 text-slate-400 group-hover:text-slate-600 transition-colors" />
                            </button>

                            {/* === POPOVER FOR VOICE SELECTION === */}
                            {isVoiceSelectorOpen && (
                                <>
                                    <div className="fixed inset-0 z-40 bg-black/5" onClick={() => setIsVoiceSelectorOpen(false)} />
                                    <div className="absolute top-full left-0 w-[380px] -ml-[20px] mt-2 bg-white rounded-2xl shadow-2xl border border-slate-100 z-50 flex flex-col overflow-hidden animate-in fade-in zoom-in-95 duration-200">
                                        <div className="p-4 border-b border-slate-100">
                                            <div className="flex items-center gap-2 mb-3">
                                                <button onClick={() => setIsVoiceSelectorOpen(false)}><ChevronRight className="rotate-180 w-4 h-4 text-slate-400" /></button>
                                                <span className="font-semibold text-slate-800">Selecione uma voz</span>
                                            </div>

                                            {/* Filter Tabs */}
                                            <div className="flex gap-4 mb-3 text-sm">
                                                <button
                                                    onClick={() => setViewMode('all')}
                                                    className={`pb-2 border-b-2 transition-colors font-medium ${viewMode === 'all' ? 'border-primary text-black' : 'border-transparent text-slate-400'}`}
                                                >
                                                    Explorar
                                                </button>
                                                <button
                                                    onClick={() => setViewMode('favorites')}
                                                    className={`pb-2 border-b-2 transition-colors font-medium ${viewMode === 'favorites' ? 'border-primary text-black' : 'border-transparent text-slate-400'}`}
                                                >
                                                    Minhas Vozes
                                                </button>
                                            </div>

                                            <div className="relative">
                                                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                                                <input
                                                    value={voiceSearch}
                                                    onChange={(e) => setVoiceSearch(e.target.value)}
                                                    className="w-full pl-9 pr-3 py-2 bg-slate-50 rounded-lg text-sm outline-none border border-transparent focus:border-slate-200 transition-all placeholder:text-slate-400"
                                                    placeholder="Comece a digitar para buscar..."
                                                    autoFocus
                                                />
                                            </div>
                                        </div>
                                        <div className="max-h-[300px] overflow-y-auto p-2">
                                            {filteredVoices.map(voice => (
                                                <div
                                                    key={voice.voice_id}
                                                    onClick={() => { setSelectedVoiceId(voice.voice_id); setIsVoiceSelectorOpen(false); }}
                                                    className={`group flex items-center justify-between p-2 rounded-lg cursor-pointer transition-colors ${selectedVoiceId === voice.voice_id ? 'bg-slate-50' : 'hover:bg-slate-50'}`}
                                                >
                                                    <div className="flex items-center gap-3 overflow-hidden">
                                                        <div className="w-8 h-8 shrink-0 rounded-full bg-slate-100 flex items-center justify-center text-xs font-bold text-slate-500">
                                                            {voice.name.charAt(0)}
                                                        </div>
                                                        <div className="flex flex-col overflow-hidden">
                                                            <span className={`text-sm truncate ${selectedVoiceId === voice.voice_id ? 'font-bold text-black' : 'font-medium text-slate-700'}`}>
                                                                {voice.name}
                                                            </span>
                                                            <span className="text-xs text-slate-400 truncate">{voice.category} • {Object.values(voice.labels || {}).slice(0, 2).join(', ')}</span>
                                                        </div>
                                                    </div>
                                                    <div className="flex items-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                                                        <button onClick={(e) => toggleFavorite(e, voice.voice_id)} className="p-1.5 hover:bg-slate-200 rounded-md">
                                                            <Bookmark className={`w-3.5 h-3.5 ${favorites.has(voice.voice_id) ? 'fill-black text-black' : 'text-slate-400'}`} />
                                                        </button>
                                                        {voice.preview_url && (
                                                            <button
                                                                onClick={(e) => {
                                                                    e.stopPropagation();
                                                                    new Audio(voice.preview_url).play();
                                                                }}
                                                                className="p-1.5 hover:bg-slate-200 rounded-md"
                                                            >
                                                                <Play className="w-3.5 h-3.5 fill-black text-black" />
                                                            </button>
                                                        )}
                                                    </div>
                                                </div>
                                            ))}
                                            {filteredVoices.length === 0 && (
                                                <div className="p-8 text-center text-sm text-slate-400">
                                                    Nenhuma voz encontrada
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                </>
                            )}
                        </div>
                    </div>

                    {/* Model Selector */}
                    <div className="flex flex-col gap-2">
                        <label className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Modelo</label>
                        <div className="relative">
                            <button
                                onClick={() => setIsModelSelectorOpen(!isModelSelectorOpen)}
                                className="w-full text-left p-0.5 rounded-xl bg-gradient-to-r from-purple-500 via-pink-500 to-orange-500 shadow-sm cursor-pointer hover:shadow-md transition-shadow"
                            >
                                <div className="bg-white rounded-[10px] p-3 flex items-center justify-between">
                                    <div className="flex items-center gap-2">
                                        <div className="px-1.5 py-0.5 rounded border border-slate-200 text-[10px] font-bold text-slate-600 bg-slate-50 uppercase tracking-tighter">V2</div>
                                        <span className="text-sm font-semibold text-slate-800 truncate max-w-[150px]">{selectedModel?.name || 'Multilingual V2'}</span>
                                    </div>
                                    <ChevronDown className={`w-4 h-4 text-slate-400 transition-transform ${isModelSelectorOpen ? 'rotate-180' : ''}`} />
                                </div>
                                {/* Promo Text inside gradient border container */}
                                <div className="px-3 py-1.5 flex items-center justify-between text-white text-[10px] font-semibold">
                                    <span>O Text to Speech mais expressivo</span>
                                </div>
                            </button>

                            {/* === POPOVER FOR MODEL SELECTION === */}
                            {isModelSelectorOpen && (
                                <>
                                    <div className="fixed inset-0 z-40 bg-black/5" onClick={() => setIsModelSelectorOpen(false)} />
                                    <div className="absolute top-full left-0 w-full mt-2 bg-white rounded-xl shadow-xl border border-slate-100 z-50 overflow-hidden animate-in fade-in zoom-in-95 duration-200">
                                        <div className="p-2 flex flex-col gap-1 max-h-[300px] overflow-y-auto custom-scrollbar">
                                            {models.map(model => (
                                                <button
                                                    key={model.model_id}
                                                    onClick={() => { setSelectedModelId(model.model_id); setIsModelSelectorOpen(false); }}
                                                    className={`w-full text-left p-3 rounded-lg flex items-center justify-between transition-colors ${selectedModelId === model.model_id ? 'bg-slate-50' : 'hover:bg-slate-50'}`}
                                                >
                                                    <div className="flex flex-col">
                                                        <span className={`text-sm ${selectedModelId === model.model_id ? 'font-bold text-black' : 'font-medium text-slate-700'}`}>
                                                            {model.name}
                                                        </span>
                                                        <span className="text-xs text-slate-400">{model.description}</span>
                                                    </div>
                                                    {selectedModelId === model.model_id && (
                                                        <Check className="w-4 h-4 text-emerald-500" />
                                                    )}
                                                </button>
                                            ))}
                                            {models.length === 0 && (
                                                <div className="p-4 text-center text-xs text-slate-400">Carregando modelos...</div>
                                            )}
                                        </div>
                                    </div>
                                </>
                            )}
                        </div>
                    </div>

                    {/* Sliders */}
                    <div className="flex flex-col gap-6 pt-2">
                        {/* Stability */}
                        <div className="flex flex-col gap-3 group">
                            <div className="flex justify-between items-end">
                                <label className="text-sm font-medium text-slate-800">Estabilidade</label>
                                <span className="text-xs text-slate-400 opacity-0 group-hover:opacity-100 transition-opacity">{(settings.stability * 100).toFixed(0)}%</span>
                            </div>
                            <div className="relative h-6 flex items-center">
                                <input
                                    type="range" min="0" max="1" step="0.01"
                                    value={settings.stability}
                                    onChange={(e) => setSettings({ ...settings, stability: parseFloat(e.target.value) })}
                                    className="absolute w-full h-1 bg-slate-200 rounded-full appearance-none cursor-pointer [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-4 [&::-webkit-slider-thumb]:h-4 [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-black [&::-webkit-slider-thumb]:shadow-lg hover:[&::-webkit-slider-thumb]:scale-110 transition-all"
                                />
                            </div>
                            <div className="flex justify-between text-[10px] font-semibold text-slate-400 uppercase tracking-wider">
                                <span>Mais variável</span>
                                <span>Mais estável</span>
                            </div>
                        </div>

                        {/* Similarity */}
                        <div className="flex flex-col gap-3 group">
                            <div className="flex justify-between items-end">
                                <label className="text-sm font-medium text-slate-800">Similaridade</label>
                                <span className="text-xs text-slate-400 opacity-0 group-hover:opacity-100 transition-opacity">{(settings.similarity_boost * 100).toFixed(0)}%</span>
                            </div>
                            <div className="relative h-6 flex items-center">
                                <input
                                    type="range" min="0" max="1" step="0.01"
                                    value={settings.similarity_boost}
                                    onChange={(e) => setSettings({ ...settings, similarity_boost: parseFloat(e.target.value) })}
                                    className="absolute w-full h-1 bg-slate-200 rounded-full appearance-none cursor-pointer [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-4 [&::-webkit-slider-thumb]:h-4 [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-black [&::-webkit-slider-thumb]:shadow-lg hover:[&::-webkit-slider-thumb]:scale-110 transition-all"
                                />
                            </div>
                            <div className="flex justify-between text-[10px] font-semibold text-slate-400 uppercase tracking-wider">
                                <span>Baixa</span>
                                <span>Alta</span>
                            </div>
                        </div>

                        {/* Exaggeration */}
                        <div className="flex flex-col gap-3 group opacity-50 hover:opacity-100 transition-opacity">
                            <div className="flex justify-between items-end">
                                <label className="text-sm font-medium text-slate-800">Exagero de Estilo</label>
                                <span className="text-xs px-1.5 py-0.5 bg-slate-100 rounded text-slate-500">Nenhum</span>
                            </div>
                            <div className="relative h-6 flex items-center">
                                <input
                                    type="range" min="0" max="1" step="0.01" defaultValue={0}
                                    className="absolute w-full h-1 bg-slate-200 rounded-full appearance-none cursor-pointer [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-4 [&::-webkit-slider-thumb]:h-4 [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-black [&::-webkit-slider-thumb]:shadow-lg"
                                />
                            </div>
                        </div>

                        {/* Speaker Boost Toggle */}
                        <div className="flex items-center justify-between pt-2">
                            <span className="text-sm font-medium text-slate-800">Boost de Orador</span>
                            <button
                                onClick={() => setSettings(s => ({ ...s, use_speaker_boost: !s.use_speaker_boost }))}
                                className={`w-10 h-6 rounded-full p-1 transition-colors ${settings.use_speaker_boost ? 'bg-black' : 'bg-slate-200'}`}
                            >
                                <div className={`w-4 h-4 bg-white rounded-full shadow-sm transition-transform ${settings.use_speaker_boost ? 'translate-x-4' : 'translate-x-0'}`} />
                            </button>
                        </div>
                    </div>

                    <div className="flex-1" /> {/* Spacer */}

                    <div className="flex justify-end gap-2 text-xs text-slate-400">
                        <button className="hover:text-black flex items-center gap-1"><RefreshCw size={10} /> Redefinir valores</button>
                    </div>
                </div>
            </aside>
        </div>
    );
};
