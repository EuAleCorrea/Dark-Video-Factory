import React, { useState, useEffect, useCallback } from 'react';
import { ChannelProfile, VideoFormat, SubtitleConfig, ChannelPrompt, EngineConfig } from '../types';
import { Plus, Save, Trash2, Youtube, Music, Type, Mic, Link, Check, X, Loader2, Cpu, AlertTriangle } from 'lucide-react';
import { PersistenceService } from '../services/PersistenceService';
import { getAvailableModels, LLMModelOption } from '../services/llmModelService';

interface Notification {
    id: string;
    type: 'success' | 'error';
    message: string;
}

interface ProfileEditorProps {
    persistence: PersistenceService;
    profiles: ChannelProfile[];
    config: EngineConfig;
    onSave: (profile: ChannelProfile) => void;
    onDelete: (id: string) => void;
}

const defaultVisuals = `monochrome, cinematic lighting, high contrast, realistic texture, 8k render, dark atmosphere`;

const BGM_OPTIONS = [
    { id: 'dark_ambient', label: 'Dark Ambient & Drone' },
    { id: 'epic_orchestral', label: 'Epic Orchestral / War' },
    { id: 'lofi_chill', label: 'Lo-Fi Chillhop' },
    { id: 'cyberpunk_synth', label: 'Cyberpunk Synthwave' },
    { id: 'corporate_upbeat', label: 'Corporate Upbeat' },
    { id: 'horror_tension', label: 'Horror Tension' }
];

const VOICE_OPTIONS = [
    { id: 'Kore', label: 'Kore (Feminino, Suave)' },
    { id: 'Puck', label: 'Puck (Masculino, Energético)' },
    { id: 'Charon', label: 'Charon (Masculino, Profundo)' },
    { id: 'Fenrir', label: 'Fenrir (Masculino, Intenso)' },
    { id: 'Zephyr', label: 'Zephyr (Feminino, Calmo)' },
    { id: 'Aoede', label: 'Aoede (Feminino, Expressivo)' }
];

const FONTS = ['Montserrat ExtraBold', 'Roboto Slab', 'Bebas Neue', 'Courier New', 'Arial Black'];

const DEFAULT_SUBTITLE_CONFIG: SubtitleConfig = {
    fontName: 'Montserrat ExtraBold',
    fontSize: 100,
    primaryColor: '#FFFFFF',
    outlineColor: '#000000',
    backgroundColor: '#000000',
    alignment: 'BOTTOM'
};

const ProfileEditor: React.FC<ProfileEditorProps> = ({ persistence, profiles, config, onSave, onDelete }) => {
    const [editingId, setEditingId] = useState<string | null>(null);
    const [name, setName] = useState('');
    const [format, setFormat] = useState<VideoFormat>(VideoFormat.SHORTS);
    const [visuals, setVisuals] = useState(defaultVisuals);
    const [voice, setVoice] = useState('Kore');
    const [bgm, setBgm] = useState('dark_ambient');
    const [subs, setSubs] = useState<SubtitleConfig>(DEFAULT_SUBTITLE_CONFIG);
    const [ytConnected, setYtConnected] = useState(false);
    const [isConnecting, setIsConnecting] = useState(false);
    const [promptVersions, setPromptVersions] = useState<ChannelPrompt[]>([]);
    const [newPromptText, setNewPromptText] = useState('');
    const [newStructurePromptText, setNewStructurePromptText] = useState('');
    const [isLoadingPrompts, setIsLoadingPrompts] = useState(false);
    const [notifications, setNotifications] = useState<Notification[]>([]);

    // LLM Model Selection
    const [selectedModel, setSelectedModel] = useState<string>('');
    const [selectedProvider, setSelectedProvider] = useState<'GEMINI' | 'OPENAI' | 'OPENROUTER'>('GEMINI');
    const [availableModels, setAvailableModels] = useState<LLMModelOption[]>([]);
    const [isLoadingModels, setIsLoadingModels] = useState(false);

    // Confirmation Dialog
    const [showConfirmDialog, setShowConfirmDialog] = useState(false);
    const [pendingAction, setPendingAction] = useState<(() => Promise<void>) | null>(null);

    // Fetch models on mount or when config changes
    useEffect(() => {
        const fetchModels = async () => {
            setIsLoadingModels(true);
            try {
                const models = await getAvailableModels(config);
                setAvailableModels(models);
            } catch (e) {
                console.error('Erro ao buscar modelos:', e);
            } finally {
                setIsLoadingModels(false);
            }
        };
        fetchModels();
    }, [config]);

    const addNotification = (type: 'success' | 'error', message: string) => {
        const id = Math.random().toString(36).substring(7);
        setNotifications(prev => [...prev, { id, type, message }]);
        setTimeout(() => {
            setNotifications(prev => prev.filter(n => n.id !== id));
        }, 3000);
    };

    const startNew = () => {
        setEditingId('NEW');
        setName('');
        setFormat(VideoFormat.SHORTS);
        setVisuals(defaultVisuals);
        setVoice('Kore');
        setBgm('dark_ambient');
        setSubs(DEFAULT_SUBTITLE_CONFIG);
        setYtConnected(false);
    };

    const loadProfile = async (p: ChannelProfile) => {
        setEditingId(p.id);
        setName(p.name);
        setFormat(p.format);
        setVisuals(p.visualStyle);
        setVoice(p.voiceProfile);
        setBgm(p.bgmTheme || 'dark_ambient');
        setSubs(p.subtitleStyle || DEFAULT_SUBTITLE_CONFIG);
        setYtConnected(p.youtubeCredentials);
        setSelectedModel(p.scriptingModel || '');
        setSelectedProvider(p.scriptingProvider || 'GEMINI');

        setIsLoadingPrompts(true);
        try {
            const prompts = await persistence.loadChannelPrompts(p.id);
            setPromptVersions(prompts);

            const active = prompts.find(pr => pr.id === p.activePromptId);
            if (active) {
                setNewPromptText(active.promptText);
                setNewStructurePromptText(active.structurePromptText || '');
            }
        } catch (e) {
            console.error("Erro ao carregar prompts:", e);
        } finally {
            setIsLoadingPrompts(false);
        }
    };

    const doCreateNewPrompt = async () => {
        if (!newPromptText || !editingId || editingId === 'NEW') return;

        setIsLoadingPrompts(true);
        try {
            const created = await persistence.createChannelPrompt(editingId, newPromptText, newStructurePromptText);

            if (created) {
                setPromptVersions(prev => [created, ...prev.map(p => ({ ...p, isActive: false }))]);

                const currentProfile = profiles.find(p => p.id === editingId);
                if (currentProfile) {
                    onSave({
                        ...currentProfile,
                        activePromptId: created.id
                    });
                }
                addNotification('success', 'Nova versão do prompt salva com sucesso!');
            }
        } catch (e) {
            console.error("Erro ao salvar prompt:", e);
            addNotification('error', 'Erro ao salvar nova versão do prompt.');
        } finally {
            setIsLoadingPrompts(false);
        }
    };

    const handleCreateNewPrompt = () => {
        if (!newPromptText || !editingId || editingId === 'NEW') return;
        setShowConfirmDialog(true);
        setPendingAction(() => doCreateNewPrompt);
    };

    const confirmAction = async () => {
        setShowConfirmDialog(false);
        if (pendingAction) await pendingAction();
        setPendingAction(null);
    };

    const cancelAction = () => {
        setShowConfirmDialog(false);
        setPendingAction(null);
    };

    const handleModelChange = (modelId: string) => {
        const model = availableModels.find(m => m.id === modelId);
        if (model) {
            setSelectedModel(model.id);
            setSelectedProvider(model.provider);
        }
    };

    const handleSave = () => {
        if (!name) return;
        const newProfile: ChannelProfile = {
            id: editingId === 'NEW' ? crypto.randomUUID() : editingId!,
            name,
            format,
            llmPersona: '',
            visualStyle: visuals,
            voiceProfile: voice,
            bgmTheme: bgm,
            subtitleStyle: subs,
            youtubeCredentials: ytConnected,
            activePromptId: promptVersions.find(p => p.isActive)?.id,
            scriptingModel: selectedModel || undefined,
            scriptingProvider: selectedProvider || undefined,
        };
        onSave(newProfile);
        setEditingId(null);
        addNotification('success', 'Perfil salvo com sucesso!');
    };

    const toggleYoutubeConnection = () => {
        if (ytConnected) {
            // Manter confirm nativo por ser uma ação destrutiva crítica, ou podemos fazer overlay depois se o usuário preferir
            if (confirm('Desconectar canal do YouTube? Os uploads automáticos pararão.')) {
                setYtConnected(false);
                addNotification('success', 'Canal desconectado.');
            }
        } else {
            setIsConnecting(true);
            // Simula o delay do popup OAuth
            setTimeout(() => {
                setIsConnecting(false);
                setYtConnected(true);
                addNotification('success', 'Canal YouTube conectado com sucesso!');
            }, 2000);
        }
    };

    const handleSubChange = (field: keyof SubtitleConfig, value: any) => {
        setSubs(prev => ({ ...prev, [field]: value }));
    };

    if (editingId) {
        return (
            <div className="bg-white p-6 rounded-xl border border-[#E2E8F0] shadow-sm">
                <div className="flex justify-between items-center mb-6 border-b border-[#E2E8F0] pb-4">
                    <h3 className="text-xl font-bold text-[#0F172A] flex items-center gap-2">
                        {editingId === 'NEW' ? 'Criar Novo Perfil' : 'Editar Perfil'}
                    </h3>
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                    {/* LEFT COLUMN: Configurações Core */}
                    <div className="space-y-6">
                        <section className="space-y-5">
                            <div>
                                <label className="block text-xs font-bold text-[#64748B] uppercase tracking-wider mb-1.5">Nome do Canal</label>
                                <input
                                    className="w-full bg-[#F8FAFC] border border-[#E2E8F0] rounded-lg px-4 py-2.5 text-[#0F172A] focus:border-primary outline-none transition"
                                    value={name}
                                    onChange={e => setName(e.target.value)}
                                    placeholder="ex: Canal Mistério BR"
                                />
                            </div>

                            {/* YOUTUBE OAUTH SIMULATION */}
                            <div className={`border rounded-lg p-5 transition-all duration-500 ${ytConnected ? 'bg-teal-50 border-teal-200' : 'bg-[#F8FAFC] border-[#E2E8F0]'}`}>
                                <div className="flex justify-between items-center mb-3">
                                    <span className="text-xs font-bold text-[#0F172A] flex items-center gap-2">
                                        <Youtube size={16} className={ytConnected ? 'text-red-500' : 'text-[#94A3B8]'} />
                                        Integração YouTube Data API v3
                                    </span>
                                    {ytConnected && <span className="text-[10px] bg-emerald-100 text-emerald-700 px-2 py-0.5 rounded border border-emerald-200">AUTORIZADO</span>}
                                </div>

                                <button
                                    onClick={toggleYoutubeConnection}
                                    disabled={isConnecting}
                                    className={`w-full py-2.5 rounded text-xs font-bold transition flex items-center justify-center gap-2 relative overflow-hidden ${ytConnected
                                        ? 'bg-[#F1F5F9] text-[#64748B] hover:text-[#0F172A] border border-[#E2E8F0]'
                                        : 'bg-[#0F172A] text-white hover:bg-[#1E293B] border border-transparent'
                                        }`}
                                >
                                    {isConnecting ? (
                                        <>
                                            <Loader2 size={14} className="animate-spin text-[#64748B]" />
                                            <span className="text-[#64748B]">Autenticando...</span>
                                        </>
                                    ) : ytConnected ? (
                                        "Revogar Acesso"
                                    ) : (
                                        <>
                                            <img src="https://www.gstatic.com/firebasejs/ui/2.0.0/images/auth/google.svg" className="w-4 h-4" alt="G" />
                                            Sign in with Google
                                        </>
                                    )}
                                </button>
                            </div>

                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-xs font-bold text-[#64748B] uppercase tracking-wider mb-1.5">Formato</label>
                                    <select
                                        className="w-full bg-[#F8FAFC] border border-[#E2E8F0] rounded-lg px-3 py-2.5 text-[#0F172A] focus:border-primary outline-none text-xs"
                                        value={format}
                                        onChange={e => setFormat(e.target.value as VideoFormat)}
                                    >
                                        <option value={VideoFormat.SHORTS}>SHORTS (9:16)</option>
                                        <option value={VideoFormat.LONG_FORM}>LANDSCAPE (16:9)</option>
                                    </select>
                                </div>
                                <div>
                                    <label className="block text-xs font-bold text-[#64748B] uppercase tracking-wider mb-1.5">Voz Neural</label>
                                    <select
                                        className="w-full bg-[#F8FAFC] border border-[#E2E8F0] rounded-lg px-3 py-2.5 text-[#0F172A] focus:border-primary outline-none text-xs"
                                        value={voice}
                                        onChange={e => setVoice(e.target.value)}
                                    >
                                        {VOICE_OPTIONS.map(opt => (
                                            <option key={opt.id} value={opt.id}>{opt.label}</option>
                                        ))}
                                    </select>
                                </div>
                            </div>

                            <div>
                                <label className="block text-xs font-bold text-[#64748B] uppercase tracking-wider mb-1.5">Trilha Sonora</label>
                                <select
                                    className="w-full bg-[#F8FAFC] border border-[#E2E8F0] rounded-lg px-3 py-2.5 text-[#0F172A] focus:border-primary outline-none text-xs"
                                    value={bgm}
                                    onChange={e => setBgm(e.target.value)}
                                >
                                    {BGM_OPTIONS.map(opt => (
                                        <option key={opt.id} value={opt.id}>{opt.label}</option>
                                    ))}
                                </select>
                            </div>

                            {/* LLM MODEL SELECTOR */}
                            <div className="bg-gradient-to-br from-blue-50 to-indigo-50 border border-blue-200 rounded-lg p-4">
                                <label className="text-xs font-bold text-[#64748B] uppercase tracking-wider mb-2 flex items-center gap-2">
                                    <Cpu size={14} className="text-blue-600" />
                                    Modelo LLM (Roteiro)
                                    {isLoadingModels && <Loader2 size={12} className="animate-spin text-blue-500" />}
                                </label>
                                <select
                                    className="w-full bg-white border border-blue-200 rounded-lg px-3 py-2.5 text-[#0F172A] focus:border-blue-500 outline-none text-xs mt-1"
                                    value={selectedModel}
                                    onChange={e => handleModelChange(e.target.value)}
                                    disabled={isLoadingModels}
                                >
                                    <option value="">Padrão do Motor (Gemini Flash)</option>
                                    {availableModels.map(m => (
                                        <option key={m.id} value={m.id}>
                                            {m.isFree ? '🆓 ' : '💰 '}{m.name} ({m.provider})
                                        </option>
                                    ))}
                                </select>
                                {selectedModel && (
                                    <p className="text-[9px] text-blue-600 mt-1.5 font-mono">
                                        {selectedProvider} → {selectedModel}
                                    </p>
                                )}
                            </div>

                            {/* Subtitles Mini Config */}
                            <div className="bg-[#F8FAFC] border border-[#E2E8F0] rounded-lg p-4">
                                <label className="block text-[10px] font-bold text-[#64748B] uppercase tracking-wider mb-3">Estilo das Legendas</label>
                                <div className="flex gap-3">
                                    <div className="flex-1">
                                        <input type="color" value={subs.primaryColor} onChange={e => handleSubChange('primaryColor', e.target.value)} className="w-full h-8 rounded bg-transparent border-0 cursor-pointer" />
                                    </div>
                                    <select
                                        className="flex-[2] bg-white border border-[#E2E8F0] rounded px-2 text-xs text-[#0F172A] outline-none"
                                        value={subs.fontName}
                                        onChange={e => handleSubChange('fontName', e.target.value)}
                                    >
                                        {FONTS.map(f => <option key={f} value={f}>{f}</option>)}
                                    </select>
                                </div>
                            </div>

                            <div>
                                <label className="block text-xs font-bold text-[#64748B] uppercase tracking-wider mb-1.5">Direção de Arte (Prompt FLUX.1)</label>
                                <textarea
                                    className="w-full h-24 bg-[#F8FAFC] border border-[#E2E8F0] rounded-lg px-4 py-3 text-[#0F172A] focus:border-primary outline-none text-[10px] resize-none leading-relaxed font-mono"
                                    value={visuals}
                                    onChange={e => setVisuals(e.target.value)}
                                    placeholder="Estilo visual para geração de imagens..."
                                />
                            </div>
                        </section>
                    </div>

                    {/* RIGHT COLUMN: Prompts do Canal & Histórico */}
                    <div className="space-y-6 flex flex-col h-full">
                        <section className="flex-1 flex flex-col bg-[#F8FAFC] rounded-xl border border-[#E2E8F0] p-5">
                            <div className="flex items-center justify-between mb-3 text-xs font-bold text-[#64748B] uppercase tracking-wider">
                                <span>P1 — Prompt de Reescrita Magnética</span>
                                {isLoadingPrompts && <Loader2 size={12} className="animate-spin text-primary" />}
                            </div>

                            <textarea
                                className="w-full min-h-[180px] bg-white border border-[#E2E8F0] rounded-lg px-4 py-4 text-[#0F172A] focus:border-primary outline-none text-xs resize-none leading-relaxed shadow-sm font-mono custom-scrollbar"
                                placeholder="Cole aqui o prompt magnético de reescrita (P1)..."
                                value={newPromptText}
                                onChange={e => setNewPromptText(e.target.value)}
                            />

                            <div className="flex items-center justify-between mt-4 mb-3 text-xs font-bold text-[#64748B] uppercase tracking-wider">
                                <span>P2 — Prompt de Estruturação Viral</span>
                            </div>

                            <textarea
                                className="w-full min-h-[140px] bg-white border border-indigo-100 rounded-lg px-4 py-4 text-[#0F172A] focus:border-indigo-400 outline-none text-xs resize-none leading-relaxed shadow-sm font-mono custom-scrollbar"
                                placeholder="Cole aqui o prompt de estruturação viral (P2)...\nGera: título, descrição, thumb_text, tags"
                                value={newStructurePromptText}
                                onChange={e => setNewStructurePromptText(e.target.value)}
                            />

                            <div className="mt-4 flex flex-col gap-3">
                                <div className="flex justify-between items-center bg-[#F1F5F9] p-3 rounded-lg border border-[#E2E8F0]">
                                    <p className="text-[10px] text-[#94A3B8] leading-tight pr-4">
                                        Ao salvar, uma nova versão será criada com ambos os prompts. Apenas vídeos <strong>futuros</strong> usarão a nova versão.
                                    </p>
                                    <button
                                        disabled={isLoadingPrompts || !newPromptText || editingId === 'NEW'}
                                        onClick={handleCreateNewPrompt}
                                        className="whitespace-nowrap px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-md text-[10px] font-black uppercase tracking-widest flex items-center gap-2 transition disabled:opacity-30 shadow-lg shadow-emerald-900/20"
                                    >
                                        <Save size={12} /> Salvar V{promptVersions.length + 1}
                                    </button>
                                </div>

                                {editingId === 'NEW' && (
                                    <p className="text-[10px] text-amber-600 bg-amber-50 p-2 rounded border border-amber-200 text-center font-mono uppercase">
                                        ⚠️ Salve o perfil primeiro para gerenciar versões de prompt.
                                    </p>
                                )}
                            </div>

                            {/* HISTÓRICO COMPACTO */}
                            <div className="mt-6 border-t border-[#E2E8F0] pt-4">
                                <label className="block text-[10px] font-bold text-[#64748B] uppercase tracking-widest mb-3">Histórico de Versões</label>
                                <div className="max-h-40 overflow-y-auto space-y-1 pr-2 custom-scrollbar">
                                    {promptVersions.map((v, i) => (
                                        <div key={v.id} className={`p-2 rounded border flex items-center justify-between transition ${v.isActive ? 'bg-teal-50 border-teal-200' : 'bg-[#F8FAFC] border-[#E2E8F0]'}`}>
                                            <div className="flex-1 min-w-0 pr-4">
                                                <div className="flex items-center gap-2">
                                                    <span className={`text-[9px] font-black px-1 rounded ${v.isActive ? 'bg-primary text-white' : 'bg-[#E2E8F0] text-[#64748B]'}`}>
                                                        V{promptVersions.length - i}
                                                    </span>
                                                    <span className="text-[9px] text-[#94A3B8] font-mono">{new Date(v.createdAt).toLocaleDateString()}</span>
                                                    {v.isActive && <span className="text-[8px] text-primary font-black uppercase">Ativo</span>}
                                                </div>
                                            </div>
                                            {!v.isActive && (
                                                <button
                                                    onClick={() => {
                                                        setNewPromptText(v.promptText);
                                                        setNewStructurePromptText(v.structurePromptText || '');
                                                    }}
                                                    className="text-[9px] font-bold text-[#64748B] hover:text-primary transition"
                                                >
                                                    REUSAR
                                                </button>
                                            )}
                                        </div>
                                    ))}
                                </div>
                            </div>
                        </section>
                    </div>
                </div>

                <div className="flex justify-end gap-3 mt-8 pt-6 border-t border-[#E2E8F0]">
                    <button onClick={() => setEditingId(null)} className="px-6 py-2.5 text-[#64748B] hover:text-[#0F172A] text-xs font-bold transition">CANCELAR</button>
                    <button onClick={handleSave} className="px-8 py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg text-xs font-bold flex items-center gap-2 transition shadow-lg shadow-emerald-900/20">
                        <Save size={16} /> SALVAR PERFIL
                    </button>
                </div>

                {/* CONFIRMATION DIALOG */}
                {showConfirmDialog && (
                    <div className="fixed inset-0 bg-black/50 z-[999] flex items-center justify-center backdrop-blur-sm" onClick={cancelAction}>
                        <div className="bg-white rounded-xl border border-[#E2E8F0] p-6 max-w-md w-full mx-4 shadow-2xl" onClick={e => e.stopPropagation()}>
                            <div className="flex items-center gap-3 mb-4">
                                <div className="w-10 h-10 rounded-full bg-amber-100 border border-amber-200 flex items-center justify-center">
                                    <AlertTriangle size={20} className="text-amber-600" />
                                </div>
                                <h4 className="text-lg font-bold text-[#0F172A]">Aplicar nova versão?</h4>
                            </div>
                            <p className="text-sm text-[#64748B] mb-6 leading-relaxed">
                                Esta configuração será aplicada apenas para <strong>novos vídeos</strong> gerados daqui em diante. Vídeos já processados mantêm a configuração original.
                            </p>
                            <div className="flex justify-end gap-3">
                                <button
                                    onClick={cancelAction}
                                    className="px-5 py-2.5 text-[#64748B] hover:text-[#0F172A] text-xs font-bold transition rounded-lg border border-[#E2E8F0] hover:bg-[#F1F5F9]"
                                >
                                    CANCELAR
                                </button>
                                <button
                                    onClick={confirmAction}
                                    className="px-5 py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg text-xs font-bold flex items-center gap-2 transition shadow-lg shadow-emerald-900/20"
                                >
                                    <Check size={14} /> SIM, APLICAR
                                </button>
                            </div>
                        </div>
                    </div>
                )}
            </div>
        );
    }

    return (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <button
                onClick={startNew}
                className="flex flex-col items-center justify-center h-40 border-2 border-dashed border-[#CBD5E1] rounded-xl hover:border-primary/40 hover:bg-teal-50/50 transition group"
            >
                <div className="w-12 h-12 rounded-full bg-teal-50 flex items-center justify-center mb-3 group-hover:scale-110 transition border border-teal-200">
                    <Plus className="text-primary" />
                </div>
                <span className="text-[#64748B] text-xs font-bold uppercase tracking-wider">Novo Perfil</span>
            </button>

            {profiles.map(p => (
                <div key={p.id} className="bg-white border border-[#E2E8F0] p-5 rounded-xl hover:border-[#CBD5E1] transition relative group shadow-sm">
                    <div className="flex justify-between items-start mb-4">
                        <div className="flex items-center gap-3">
                            <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-[#F1F5F9] to-[#E2E8F0] border border-[#CBD5E1] flex items-center justify-center text-sm font-bold text-[#0F172A]">
                                {p.name.substring(0, 2).toUpperCase()}
                            </div>
                            <div>
                                <h4 className="font-bold text-[#0F172A] text-sm mb-1">{p.name}</h4>
                                <span className="text-[10px] font-bold text-[#64748B] px-1.5 py-0.5 bg-[#F1F5F9] rounded border border-[#E2E8F0] uppercase tracking-wide">{p.format}</span>
                            </div>
                        </div>
                        <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition translate-x-2 group-hover:translate-x-0">
                            <button onClick={() => loadProfile(p)} className="p-2 hover:bg-[#F1F5F9] rounded text-[#94A3B8] hover:text-primary transition"><Save size={16} /></button>
                            <button onClick={() => onDelete(p.id)} className="p-2 hover:bg-red-50 rounded text-[#94A3B8] hover:text-red-500 transition"><Trash2 size={16} /></button>
                        </div>
                    </div>

                    <div className="space-y-3 mb-4">
                        <div className="flex items-center gap-2 text-xs text-[#94A3B8]">
                            <Mic size={12} className="text-blue-500" />
                            <span className="font-medium text-[#334155]">{VOICE_OPTIONS.find(v => v.id === p.voiceProfile)?.label || p.voiceProfile}</span>
                        </div>
                        <div className="flex items-center gap-2 text-xs text-[#94A3B8]">
                            <Music size={12} className="text-violet-500" />
                            <span className="font-medium text-[#334155] truncate w-40">{BGM_OPTIONS.find(v => v.id === p.bgmTheme)?.label || p.bgmTheme}</span>
                        </div>
                    </div>

                    <div className="pt-3 border-t border-[#E2E8F0] flex items-center gap-2 text-[10px] font-bold tracking-wider">
                        {p.youtubeCredentials ? (
                            <span className="flex items-center gap-1.5 text-emerald-700 bg-emerald-50 px-2 py-1 rounded border border-emerald-200"><Check size={10} strokeWidth={3} /> YOUTUBE LINKED</span>
                        ) : (
                            <span className="flex items-center gap-1.5 text-[#94A3B8] bg-[#F1F5F9] px-2 py-1 rounded border border-[#E2E8F0]"><X size={10} strokeWidth={3} /> UNLINKED</span>
                        )}
                    </div>
                </div>
            ))}

            {/* NOTIFICATIONS OVERLAY */}
            <div className="fixed top-6 right-6 z-[1000] flex flex-col gap-3 pointer-events-none">
                {notifications.map(n => (
                    <div
                        key={n.id}
                        className={`px-4 py-3 rounded-lg border shadow-lg flex items-center gap-3 animate-in slide-in-from-right duration-300 pointer-events-auto min-w-[300px] ${n.type === 'success'
                            ? 'bg-emerald-50 border-emerald-200 text-emerald-800'
                            : 'bg-red-50 border-red-200 text-red-800'
                            }`}
                    >
                        {n.type === 'success' ? <Check size={18} /> : <X size={18} />}
                        <span className="text-xs font-bold uppercase tracking-wide">{n.message}</span>
                    </div>
                ))}
            </div>
        </div>
    );
};

export default ProfileEditor;