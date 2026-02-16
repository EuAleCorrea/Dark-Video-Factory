import React, { useState } from 'react';
import {
    Mic, Zap, Play, Settings2, ChevronDown, Check, Download,
    Loader2, Maximize2, X, Plus, Clock, Copy, Globe, User, ChevronRight, AlertTriangle, Bookmark, Search
} from 'lucide-react';
import { generateSpeech } from '../services/geminiService';
import { invoke } from '@tauri-apps/api/core';
import { save } from '@tauri-apps/plugin-dialog';
import { EngineConfig } from '../types';

/** Encapsula PCM raw em um WAV válido para o browser reproduzir */
function createWavFromPcm(pcmData: Uint8Array, sampleRate: number, numChannels: number, bitsPerSample: number): ArrayBuffer {
    const byteRate = sampleRate * numChannels * (bitsPerSample / 8);
    const blockAlign = numChannels * (bitsPerSample / 8);
    const headerSize = 44;
    const buffer = new ArrayBuffer(headerSize + pcmData.length);
    const view = new DataView(buffer);

    // RIFF header
    writeString(view, 0, 'RIFF');
    view.setUint32(4, 36 + pcmData.length, true);
    writeString(view, 8, 'WAVE');

    // fmt sub-chunk
    writeString(view, 12, 'fmt ');
    view.setUint32(16, 16, true);
    view.setUint16(20, 1, true); // PCM
    view.setUint16(22, numChannels, true);
    view.setUint32(24, sampleRate, true);
    view.setUint32(28, byteRate, true);
    view.setUint16(32, blockAlign, true);
    view.setUint16(34, bitsPerSample, true);

    // data sub-chunk
    writeString(view, 36, 'data');
    view.setUint32(40, pcmData.length, true);

    const output = new Uint8Array(buffer);
    output.set(pcmData, headerSize);
    return buffer;
}

function writeString(view: DataView, offset: number, str: string) {
    for (let i = 0; i < str.length; i++) {
        view.setUint8(offset + i, str.charCodeAt(i));
    }
}

interface GoogleTTSPanelProps {
    config: EngineConfig;
    onClose: () => void;
}

const GOOGLE_VOICES = [
    { id: 'Zephyr', label: 'Zephyr', description: 'Bright, energetic and modern', tags: ['conversational', 'male'] },
    { id: 'Kore', label: 'Kore', description: 'Energetic, youthful and confident', tags: ['news', 'female'] },
    { id: 'Puck', label: 'Puck', description: 'Upbeat, playful and youthful', tags: ['conversational', 'male'] },
    { id: 'Aoede', label: 'Aoede', description: 'Clear, conversational and thoughtful', tags: ['meditation', 'female'] },
    { id: 'Charon', label: 'Charon', description: 'Smooth, assured and approachable', tags: ['narrative', 'male'] },
    { id: 'Fenrir', label: 'Fenrir', description: 'Rugged, bold and dramatic', tags: ['dramatic', 'male'] },
    { id: 'Leda', label: 'Leda', description: 'Composed, professional and calm', tags: ['narrative', 'female'] },
    { id: 'Orus', label: 'Orus', description: 'Firm, clear and direct', tags: ['news', 'male'] },
    { id: 'Achernar', label: 'Achernar', description: 'Clear, mid-range and friendly', tags: ['commercial', 'male'] },
    { id: 'Achird', label: 'Achird', description: 'Youthful, clear and inquisitive', tags: ['conversational', 'female'] },
    { id: 'Algenib', label: 'Algenib', description: 'Warm, confident and experienced', tags: ['narrative', 'female'] },
    { id: 'Alnilam', label: 'Alnilam', description: 'Energetic, commercial and direct', tags: ['promo', 'male'] },
    { id: 'Autonoe', label: 'Autonoe', description: 'Mature, resonant and wise', tags: ['documentary', 'male'] },
    { id: 'Callirrhoe', label: 'Callirrhoe', description: 'Confident, professional and articulate', tags: ['business', 'female'] },
    { id: 'Despina', label: 'Despina', description: 'Warm, inviting and smooth', tags: ['lifestyle', 'female'] },
    { id: 'Enceladus', label: 'Enceladus', description: 'Energetic, enthusiastic and exciting', tags: ['promo', 'male'] },
    { id: 'Laomedeia', label: 'Laomedeia', description: 'Clear, inquisitive and engaging', tags: ['e-learning', 'female'] },
    { id: 'Pulcherrima', label: 'Pulcherrima', description: 'Bright, youthful and very upbeat', tags: ['youth', 'female'] },
    { id: 'Rasalgethi', label: 'Rasalgethi', description: 'Conversational, quirky and thoughtful', tags: ['podcast', 'male'] },
    { id: 'Sadachbia', label: 'Sadachbia', description: 'Deeper, cool and laid-back', tags: ['narrative', 'male'] },
    { id: 'Sadaltager', label: 'Sadaltager', description: 'Reliable, steady and informative', tags: ['news', 'male'] },
    { id: 'Schedar', label: 'Schedar', description: 'Gentle, warm and narrative', tags: ['storytelling', 'female'] },
    { id: 'Sulafat', label: 'Sulafat', description: 'Strong, resonant and authoritative', tags: ['authority', 'male'] },
    { id: 'Zubenelgenubi', label: 'Zubenelgenubi', description: 'Unique, textured and characterful', tags: ['character', 'male'] },
];

export const GoogleTTSPanel: React.FC<GoogleTTSPanelProps> = ({ config, onClose }) => {
    const [text, setText] = useState('');
    const [styleInstructions, setStyleInstructions] = useState('');
    const [selectedVoiceId, setSelectedVoiceId] = useState('Zephyr');
    const [isGenerating, setIsGenerating] = useState(false);
    const [audioUrl, setAudioUrl] = useState<string | null>(null);
    const [audioBytes, setAudioBytes] = useState<Uint8Array | null>(null);
    const [error, setError] = useState<string | null>(null);
    const [favorites, setFavorites] = useState<Set<string>>(new Set());
    const [viewMode, setViewMode] = useState<'all' | 'favorites'>('all');
    const [isVoiceSelectorOpen, setIsVoiceSelectorOpen] = useState(false);
    const [voiceSearch, setVoiceSearch] = useState('');

    // Load favorites
    React.useEffect(() => {
        const saved = localStorage.getItem('google_tts_favorites');
        if (saved) setFavorites(new Set(JSON.parse(saved)));
    }, []);

    // Save favorites
    React.useEffect(() => {
        localStorage.setItem('google_tts_favorites', JSON.stringify(Array.from(favorites)));
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

    const handleGenerate = async () => {
        if (!text.trim()) return;
        setIsGenerating(true);
        setError(null);
        setAudioUrl(null);
        setAudioBytes(null);

        try {
            const fullText = styleInstructions ? `${styleInstructions}\n\n${text}` : text;
            const base64Audio = await generateSpeech(fullText, selectedVoiceId, config);

            if (base64Audio) {
                // 1. Gemini TTS retorna PCM raw (24kHz, 16-bit, mono)
                const pcmBytes = Uint8Array.from(atob(base64Audio), c => c.charCodeAt(0));
                const wavBuffer = createWavFromPcm(pcmBytes, 24000, 1, 16);
                const wavBytes = new Uint8Array(wavBuffer);

                // 2. Converter WAV → MP3 via FFmpeg (Tauri)
                try {
                    const tempBase = await invoke<string>('get_temp_dir');
                    const sep = tempBase.includes('\\') ? '\\' : '/';
                    const ts = Date.now();
                    const inputPath = `${tempBase}${sep}tts_${ts}.wav`;
                    const outputPath = `${tempBase}${sep}tts_${ts}.mp3`;

                    // Gravar WAV em temp
                    await invoke('write_file', { path: inputPath, content: Array.from(wavBytes) });

                    // FFmpeg: WAV → MP3
                    const result = await invoke<{ success: boolean; stderr: string }>('run_ffmpeg', {
                        args: ['-y', '-i', inputPath, '-codec:a', 'libmp3lame', '-b:a', '192k', '-ar', '44100', '-ac', '1', outputPath]
                    });

                    if (result.success) {
                        // Ler MP3 convertido
                        const mp3Data = await invoke<number[]>('read_file', { path: outputPath });
                        const mp3Bytes = new Uint8Array(mp3Data);
                        setAudioBytes(mp3Bytes);
                        const blob = new Blob([mp3Bytes], { type: 'audio/mpeg' });
                        const url = URL.createObjectURL(blob);
                        setAudioUrl(url);
                        console.log(`[TTS] ✅ WAV→MP3 convertido (${(wavBytes.length / 1024).toFixed(0)}KB → ${(mp3Bytes.length / 1024).toFixed(0)}KB)`);
                    } else {
                        // Fallback: se FFmpeg falhar, usa WAV direto
                        console.warn('[TTS] FFmpeg falhou, usando WAV:', result.stderr);
                        const blob = new Blob([wavBuffer], { type: 'audio/wav' });
                        const url = URL.createObjectURL(blob);
                        setAudioUrl(url);
                    }

                    // Limpeza
                    invoke('delete_file_cmd', { path: inputPath }).catch(() => { });
                    invoke('delete_file_cmd', { path: outputPath }).catch(() => { });
                } catch (ffmpegErr) {
                    // Fallback: se Tauri/FFmpeg não disponível, usa WAV direto
                    console.warn('[TTS] FFmpeg indisponível, usando WAV:', ffmpegErr);
                    const blob = new Blob([wavBuffer], { type: 'audio/wav' });
                    const url = URL.createObjectURL(blob);
                    setAudioUrl(url);
                }
            }
        } catch (err: any) {
            console.error('[GoogleTTS] Erro:', err);
            setError(err.message || 'Erro ao gerar áudio');
        } finally {
            setIsGenerating(false);
        }
    };

    const handleDownload = async () => {
        if (!audioBytes) return;
        try {
            const filePath = await save({
                defaultPath: `google_tts_${selectedVoiceId}_${Date.now()}.mp3`,
                filters: [{ name: 'Audio MP3', extensions: ['mp3'] }]
            });
            if (!filePath) return; // usuário cancelou
            await invoke('write_file', { path: filePath, content: Array.from(audioBytes) });
            console.log(`[TTS] Arquivo salvo: ${filePath}`);
        } catch (err: any) {
            console.error('[TTS] Erro ao baixar:', err);
        }
    };

    return (
        <div className="flex h-full w-full bg-[#F8FAFC] relative font-sans text-[#0F172A] p-6 gap-6 overflow-hidden">

            {/* ================= MAIN AREA (LEFT) ================= */}
            <div className="flex-1 flex flex-col h-full overflow-hidden gap-6">

                {/* Header Card */}
                <header className="bg-white rounded-[2rem] shadow-sm border border-slate-200 px-8 h-20 flex items-center justify-between shrink-0">
                    <div className="flex items-center gap-2">
                        <button onClick={onClose} className="p-2 -ml-2 hover:bg-slate-50 rounded-full transition-colors text-slate-400 hover:text-slate-800">
                            <ChevronRight className="rotate-180 w-5 h-5" />
                        </button>
                        <h1 className="text-lg font-semibold text-slate-800">Google TTS Playground</h1>
                    </div>
                    <div className="flex items-center gap-3">
                        <div className="flex items-center gap-2 px-3 py-1.5 bg-blue-50 rounded-full border border-blue-100 text-xs font-medium text-blue-600">
                            <span className="text-blue-500">●</span>
                            Gemini 2.5 Pro Preview
                        </div>
                    </div>
                </header>

                {/* Style Instructions Card */}
                <div className="bg-white rounded-[2rem] shadow-sm border border-slate-200 px-8 py-8 shrink-0 relative flex flex-col justify-center">
                    <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-4 block w-full">Instruções de Estilo</label>
                    <textarea
                        value={styleInstructions}
                        onChange={(e) => setStyleInstructions(e.target.value)}
                        placeholder="Ex: Leia em um tom caloroso e amigável..."
                        className="w-full bg-slate-50/50 rounded-xl px-4 border-none outline-none resize-none text-sm text-slate-700 caret-blue-600 font-medium placeholder:text-slate-300 transition-colors focus:bg-slate-50 h-[42px] leading-[42px] overflow-hidden"
                        rows={1}
                    />
                </div>

                {/* Editor Card */}
                <div className="flex-1 flex flex-col bg-white rounded-[2rem] shadow-sm border border-slate-200 overflow-hidden relative">

                    {/* Main Text Area */}
                    <div className="flex-1 overflow-hidden relative group">
                        <textarea
                            value={text}
                            onChange={(e) => setText(e.target.value)}
                            className="w-full h-full p-8 md:p-12 text-lg md:text-xl text-slate-800 placeholder:text-slate-300 resize-none outline-none border-none bg-white font-medium leading-relaxed custom-scrollbar cursor-default caret-blue-600 focus:bg-slate-50/50 hover:bg-slate-50/20 transition-colors"
                            placeholder="Comece a escrever ou cole o texto aqui para gerar fala..."
                            spellCheck={false}
                        />

                        {/* ERROR ALERT */}
                        {error && (
                            <div className="absolute top-4 left-1/2 -translate-x-1/2 z-20 w-[90%] p-4 bg-red-50 border border-red-100 rounded-2xl flex items-center gap-3 text-red-600 text-sm shadow-xl animate-in fade-in zoom-in-95">
                                <AlertTriangle size={18} />
                                <span>{error}</span>
                                <button onClick={() => setError(null)} className="ml-auto p-1 hover:bg-red-100 rounded-full transition-colors"><X size={14} /></button>
                            </div>
                        )}

                        {/* Action Floating Bar */}
                        <div className="absolute bottom-8 right-8 flex items-center gap-3 z-10">
                            <button
                                onClick={() => setText('')}
                                className={`px-4 py-2 text-sm font-medium text-slate-400 hover:text-slate-600 transition-colors ${!text && 'opacity-0 pointer-events-none'}`}
                            >
                                Limpar
                            </button>
                            <button
                                onClick={handleGenerate}
                                disabled={!text.trim() || isGenerating}
                                className="px-8 py-4 bg-black text-white rounded-full font-semibold text-sm hover:opacity-90 disabled:opacity-50 disabled:cursor-not-allowed transition-all shadow-lg shadow-black/10 flex items-center gap-2"
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

                        {/* Audio Player Floating Bar */}
                        {audioUrl && (
                            <div className="absolute bottom-8 left-8 right-auto flex items-center gap-4 p-4 bg-white/90 backdrop-blur-md rounded-2xl border border-slate-200 shadow-xl z-20 animate-in slide-in-from-bottom-5 duration-300">
                                <audio key={audioUrl} src={audioUrl} controls controlsList="nodownload" className="h-8 w-64" autoPlay />
                                <div className="h-8 w-[1px] bg-slate-200" />
                                <button
                                    onClick={handleDownload}
                                    className="flex items-center gap-2 text-sm font-medium text-slate-700 hover:text-emerald-600 transition-colors"
                                >
                                    <Download size={16} />
                                    <span>Baixar MP3</span>
                                </button>
                            </div>
                        )}
                    </div>
                </div>
            </div>

            {/* ================= SETTINGS SIDEBAR (RIGHT) ================= */}
            <aside className="w-[400px] shrink-0 flex flex-col h-full z-20 bg-white rounded-[2rem] shadow-sm border border-slate-200 overflow-hidden">
                <div className="flex items-center px-6 pt-6 pb-2 border-b border-transparent">
                    <button className="pb-3 px-1 text-sm font-semibold text-black border-b-2 border-black">Configurações</button>
                    <button className="pb-3 px-6 text-sm font-medium text-slate-400 hover:text-slate-600 cursor-not-allowed">Histórico</button>
                </div>

                <div className="flex-1 overflow-y-auto p-6 flex flex-col gap-8 custom-scrollbar">

                    {/* Model Info Card */}
                    <div className="px-5 py-4 rounded-2xl bg-gradient-to-r from-blue-600 to-blue-400 text-white shadow-lg shadow-blue-100/50">
                        <div className="flex items-center gap-2">
                            <Zap size={16} className="fill-white" />
                            <h3 className="font-bold text-sm tracking-wide">Gemini 2.5 Pro TTS</h3>
                        </div>
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
                                    <div className="w-8 h-8 rounded-full bg-slate-100 flex items-center justify-center text-slate-600 font-bold text-xs ring-2 ring-white shadow-sm">
                                        {GOOGLE_VOICES.find(v => v.id === selectedVoiceId)?.label.charAt(0)}
                                    </div>
                                    <div className="flex flex-col items-start">
                                        <span className="text-sm font-semibold text-slate-800">
                                            {GOOGLE_VOICES.find(v => v.id === selectedVoiceId)?.label}
                                        </span>
                                        <span className="text-xs text-slate-400 lowercase">google • core voice</span>
                                    </div>
                                </div>
                                <ChevronRight className="w-4 h-4 text-slate-400 group-hover:text-slate-600 transition-colors" />
                            </button>

                            {/* === POPOVER FOR VOICE SELECTION === */}
                            {isVoiceSelectorOpen && (
                                <>
                                    <div className="fixed inset-0 z-40 bg-black/5" onClick={() => setIsVoiceSelectorOpen(false)} />
                                    <div className="absolute top-full left-0 w-[380px] -ml-[20px] mt-2 bg-white rounded-2xl shadow-2xl border border-slate-100 z-50 flex flex-col overflow-hidden animate-in fade-in zoom-in-95 duration-200">
                                        <div className="p-4 border-b border-slate-100 overflow-hidden shrink-0">
                                            <div className="flex items-center gap-2 mb-3">
                                                <button onClick={() => setIsVoiceSelectorOpen(false)}>
                                                    <ChevronRight className="rotate-180 w-4 h-4 text-slate-400" />
                                                </button>
                                                <span className="font-semibold text-slate-800">Selecione uma voz</span>
                                            </div>

                                            {/* Filter Tabs */}
                                            <div className="flex gap-4 mb-3 text-sm">
                                                <button
                                                    onClick={() => setViewMode('all')}
                                                    className={`pb-2 border-b-2 transition-colors font-medium ${viewMode === 'all' ? 'border-blue-600 text-black' : 'border-transparent text-slate-400'}`}
                                                >
                                                    Explorar
                                                </button>
                                                <button
                                                    onClick={() => setViewMode('favorites')}
                                                    className={`pb-2 border-b-2 transition-colors font-medium ${viewMode === 'favorites' ? 'border-blue-600 text-black' : 'border-transparent text-slate-400'}`}
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

                                        <div className="max-h-[280px] overflow-y-auto p-2 custom-scrollbar">
                                            {GOOGLE_VOICES
                                                .filter(v => (viewMode === 'all' || favorites.has(v.id)) &&
                                                    v.label.toLowerCase().includes(voiceSearch.toLowerCase()))
                                                .map(voice => (
                                                    <div
                                                        key={voice.id}
                                                        onClick={() => { setSelectedVoiceId(voice.id); setIsVoiceSelectorOpen(false); }}
                                                        className={`group flex items-center justify-between p-2 rounded-lg cursor-pointer transition-colors ${selectedVoiceId === voice.id ? 'bg-slate-50' : 'hover:bg-slate-50'}`}
                                                    >
                                                        <div className="flex items-center gap-3 overflow-hidden">
                                                            <div className={`w-8 h-8 shrink-0 rounded-full flex items-center justify-center text-xs font-bold ${selectedVoiceId === voice.id ? 'bg-blue-100 text-blue-600' : 'bg-slate-100 text-slate-500'}`}>
                                                                {voice.label.charAt(0)}
                                                            </div>
                                                            <div className="flex flex-col overflow-hidden">
                                                                <span className={`text-sm truncate ${selectedVoiceId === voice.id ? 'font-bold text-black' : 'font-medium text-slate-700'}`}>
                                                                    {voice.label} - {voice.description.split(',')[0]}
                                                                </span>
                                                                <span className="text-xs text-slate-400 truncate">google • {voice.tags.join(', ')}</span>
                                                            </div>
                                                        </div>
                                                        <div className="flex items-center gap-2">
                                                            <button
                                                                onClick={(e) => toggleFavorite(e, voice.id)}
                                                                className={`p-1.5 hover:bg-slate-200 rounded-md transition-all ${favorites.has(voice.id) ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'}`}
                                                            >
                                                                <Bookmark className={`w-3.5 h-3.5 ${favorites.has(voice.id) ? 'fill-amber-500 text-amber-500' : 'text-slate-400'}`} />
                                                            </button>
                                                        </div>
                                                    </div>
                                                ))}

                                            {viewMode === 'favorites' && favorites.size === 0 && (
                                                <div className="p-12 text-center text-sm text-slate-400 flex flex-col items-center gap-2">
                                                    <Bookmark size={24} className="text-slate-200" />
                                                    <span>Nenhuma voz favoritada</span>
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                </>
                            )}
                        </div>
                    </div>

                    {/* Model Settings sliders stub */}
                    <div className="flex flex-col gap-6 opacity-40 grayscale pointer-events-none">
                        <div className="flex flex-col gap-3">
                            <div className="flex justify-between items-end">
                                <label className="text-sm font-medium text-slate-800">Temperatura</label>
                                <span className="text-xs text-slate-400">0.7</span>
                            </div>
                            <div className="relative h-6 flex items-center">
                                <div className="w-full h-1 bg-slate-200 rounded-full overflow-hidden">
                                    <div className="w-[70%] h-full bg-slate-400" />
                                </div>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Footer */}
                <div className="p-6 border-t border-slate-100 bg-slate-50/50">
                    <div className="flex items-center gap-2 text-[10px] font-bold text-slate-400 bg-white p-4 rounded-2xl border border-slate-200">
                        <Globe size={14} className="text-blue-500" />
                        <span>Conexão: Gemini API (Cloud)</span>
                        <div className="ml-auto flex items-center gap-1.5">
                            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                            <span className="text-emerald-600 uppercase">Live</span>
                        </div>
                    </div>
                </div>
            </aside>

            <style>{`
        .custom-scrollbar::-webkit-scrollbar {
            width: 6px;
        }
        .custom-scrollbar::-webkit-scrollbar-track {
            background: transparent;
        }
        .custom-scrollbar::-webkit-scrollbar-thumb {
            background: #E2E8F0;
            border-radius: 10px;
        }
        .custom-scrollbar::-webkit-scrollbar-thumb:hover {
            background: #CBD5E1;
        }
      `}</style>
        </div>
    );
};
