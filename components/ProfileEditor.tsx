import React, { useState } from 'react';
import { ChannelProfile, VideoFormat, SubtitleConfig } from '../types';
import { Plus, Save, Trash2, Youtube, Music, Type, Mic, Link, Check, X, Loader2 } from 'lucide-react';

interface ProfileEditorProps {
  profiles: ChannelProfile[];
  onSave: (profile: ChannelProfile) => void;
  onDelete: (id: string) => void;
}

const defaultPersona = `Você é um narrador misterioso explorando as profundezas da psicologia humana. Tom: Analítico, sombrio, intrigante. Use português do Brasil.`;
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

const ProfileEditor: React.FC<ProfileEditorProps> = ({ profiles, onSave, onDelete }) => {
  const [editingId, setEditingId] = useState<string | null>(null);
  const [name, setName] = useState('');
  const [format, setFormat] = useState<VideoFormat>(VideoFormat.SHORTS);
  const [persona, setPersona] = useState(defaultPersona);
  const [visuals, setVisuals] = useState(defaultVisuals);
  const [voice, setVoice] = useState('Kore');
  const [bgm, setBgm] = useState('dark_ambient');
  const [subs, setSubs] = useState<SubtitleConfig>(DEFAULT_SUBTITLE_CONFIG);
  const [ytConnected, setYtConnected] = useState(false);
  const [isConnecting, setIsConnecting] = useState(false);

  const startNew = () => {
    setEditingId('NEW');
    setName('');
    setFormat(VideoFormat.SHORTS);
    setPersona(defaultPersona);
    setVisuals(defaultVisuals);
    setVoice('Kore');
    setBgm('dark_ambient');
    setSubs(DEFAULT_SUBTITLE_CONFIG);
    setYtConnected(false);
  };

  const loadProfile = (p: ChannelProfile) => {
    setEditingId(p.id);
    setName(p.name);
    setFormat(p.format);
    setPersona(p.llmPersona);
    setVisuals(p.visualStyle);
    setVoice(p.voiceProfile);
    setBgm(p.bgmTheme || 'dark_ambient');
    setSubs(p.subtitleStyle || DEFAULT_SUBTITLE_CONFIG);
    setYtConnected(p.youtubeCredentials);
  };

  const handleSave = () => {
    if (!name) return;
    const newProfile: ChannelProfile = {
      id: editingId === 'NEW' ? crypto.randomUUID() : editingId!,
      name,
      format,
      llmPersona: persona,
      visualStyle: visuals,
      voiceProfile: voice,
      bgmTheme: bgm,
      subtitleStyle: subs,
      youtubeCredentials: ytConnected,
    };
    onSave(newProfile);
    setEditingId(null);
  };

  const toggleYoutubeConnection = () => {
      if (ytConnected) {
          if(confirm('Desconectar canal do YouTube? Os uploads automáticos pararão.')) {
             setYtConnected(false);
          }
      } else {
          setIsConnecting(true);
          // Simula o delay do popup OAuth
          setTimeout(() => {
              setIsConnecting(false);
              setYtConnected(true);
          }, 2000);
      }
  };

  const handleSubChange = (field: keyof SubtitleConfig, value: any) => {
      setSubs(prev => ({ ...prev, [field]: value }));
  };

  if (editingId) {
    return (
      <div className="bg-slate-900/50 p-6 rounded-xl border border-slate-700 backdrop-blur-sm shadow-2xl">
        <h3 className="text-xl font-bold text-white mb-6 flex items-center gap-2 border-b border-slate-800 pb-4">
            {editingId === 'NEW' ? 'Criar Novo Perfil' : 'Editar Perfil'}
        </h3>
        
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
            {/* LEFT COLUMN */}
            <div className="space-y-5">
                <div>
                    <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1.5">Nome do Canal</label>
                    <input 
                        className="w-full bg-slate-950 border border-slate-800 rounded-lg px-4 py-2.5 text-white focus:border-emerald-500 outline-none transition"
                        value={name}
                        onChange={e => setName(e.target.value)}
                        placeholder="ex: Canal Mistério BR"
                    />
                </div>
                
                {/* YOUTUBE OAUTH SIMULATION */}
                <div className={`border rounded-lg p-5 transition-all duration-500 ${ytConnected ? 'bg-emerald-950/20 border-emerald-900/50' : 'bg-slate-950 border-slate-800'}`}>
                    <div className="flex justify-between items-center mb-3">
                        <span className="text-xs font-bold text-slate-300 flex items-center gap-2">
                             <Youtube size={16} className={ytConnected ? 'text-red-500' : 'text-slate-500'} />
                             Integração YouTube Data API v3
                        </span>
                        {ytConnected && <span className="text-[10px] bg-emerald-500/20 text-emerald-400 px-2 py-0.5 rounded border border-emerald-500/30">AUTORIZADO</span>}
                    </div>
                    
                    <p className="text-[10px] text-slate-500 mb-4 leading-relaxed">
                        {ytConnected 
                            ? `Token de acesso válido. Permissões: youtube.upload, youtube.readonly. Expira em 59 min.` 
                            : "Conceda permissão para que o Dark Factory realize uploads automáticos e gerencie metadados."}
                    </p>

                    <button 
                        onClick={toggleYoutubeConnection}
                        disabled={isConnecting}
                        className={`w-full py-2.5 rounded text-xs font-bold transition flex items-center justify-center gap-2 relative overflow-hidden ${
                            ytConnected 
                                ? 'bg-slate-800 text-slate-400 hover:text-white border border-slate-700' 
                                : 'bg-white text-slate-900 hover:bg-slate-200 border border-transparent'
                        }`}
                    >
                        {isConnecting ? (
                            <>
                                <Loader2 size={14} className="animate-spin text-slate-900" /> 
                                <span className="text-slate-900">Autenticando...</span>
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

                <div>
                    <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1.5">Formato de Vídeo</label>
                    <div className="grid grid-cols-2 gap-3">
                        <button 
                            onClick={() => setFormat(VideoFormat.SHORTS)}
                            className={`py-3 rounded-lg text-xs font-bold border transition ${format === VideoFormat.SHORTS ? 'bg-emerald-600/20 border-emerald-500 text-emerald-400' : 'bg-slate-950 border-slate-800 text-slate-400 hover:bg-slate-900'}`}
                        >
                            SHORTS (9:16)
                        </button>
                        <button 
                            onClick={() => setFormat(VideoFormat.LONG_FORM)}
                            className={`py-3 rounded-lg text-xs font-bold border transition ${format === VideoFormat.LONG_FORM ? 'bg-emerald-600/20 border-emerald-500 text-emerald-400' : 'bg-slate-950 border-slate-800 text-slate-400 hover:bg-slate-900'}`}
                        >
                            LANDSCAPE (16:9)
                        </button>
                    </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                    <div>
                        <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1.5">Voz Neural</label>
                        <select 
                            className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2.5 text-white focus:border-emerald-500 outline-none text-xs"
                            value={voice}
                            onChange={e => setVoice(e.target.value)}
                        >
                            {VOICE_OPTIONS.map(opt => (
                                <option key={opt.id} value={opt.id}>{opt.label}</option>
                            ))}
                        </select>
                    </div>
                    <div>
                        <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1.5">Trilha Sonora</label>
                        <select 
                            className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2.5 text-white focus:border-emerald-500 outline-none text-xs"
                            value={bgm}
                            onChange={e => setBgm(e.target.value)}
                        >
                            {BGM_OPTIONS.map(opt => (
                                <option key={opt.id} value={opt.id}>{opt.label}</option>
                            ))}
                        </select>
                    </div>
                </div>
            </div>

            {/* RIGHT COLUMN */}
            <div className="space-y-5">
                <div>
                    <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1.5">Persona (Prompt do Sistema)</label>
                    <textarea 
                        className="w-full h-32 bg-slate-950 border border-slate-800 rounded-lg px-4 py-3 text-slate-300 focus:border-emerald-500 outline-none text-xs resize-none leading-relaxed"
                        value={persona}
                        onChange={e => setPersona(e.target.value)}
                    />
                </div>
                <div>
                    <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1.5">Direção de Arte (Prompt Flux.1)</label>
                    <textarea 
                        className="w-full h-32 bg-slate-950 border border-slate-800 rounded-lg px-4 py-3 text-slate-300 focus:border-emerald-500 outline-none text-xs resize-none leading-relaxed font-mono"
                        value={visuals}
                        onChange={e => setVisuals(e.target.value)}
                    />
                </div>

                {/* Subtitles Mini Config */}
                <div className="bg-slate-950 border border-slate-800 rounded-lg p-4">
                    <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-3">Estilo das Legendas</label>
                    <div className="flex gap-3">
                         <div className="flex-1">
                            <input type="color" value={subs.primaryColor} onChange={e => handleSubChange('primaryColor', e.target.value)} className="w-full h-8 rounded bg-transparent border-0 cursor-pointer" />
                         </div>
                         <select 
                            className="flex-[2] bg-slate-900 border border-slate-700 rounded px-2 text-xs text-white outline-none"
                            value={subs.fontName}
                            onChange={e => handleSubChange('fontName', e.target.value)}
                        >
                            {FONTS.map(f => <option key={f} value={f}>{f}</option>)}
                        </select>
                    </div>
                </div>
            </div>
        </div>

        <div className="flex justify-end gap-3 mt-8 pt-6 border-t border-slate-800">
            <button onClick={() => setEditingId(null)} className="px-6 py-2.5 text-slate-400 hover:text-white text-xs font-bold transition">CANCELAR</button>
            <button onClick={handleSave} className="px-8 py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg text-xs font-bold flex items-center gap-2 transition shadow-lg shadow-emerald-900/20">
                <Save size={16} /> SALVAR PERFIL
            </button>
        </div>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <button 
            onClick={startNew}
            className="flex flex-col items-center justify-center h-40 border-2 border-dashed border-slate-800 rounded-xl hover:border-emerald-500/30 hover:bg-slate-800/20 transition group"
        >
            <div className="w-12 h-12 rounded-full bg-emerald-500/10 flex items-center justify-center mb-3 group-hover:scale-110 transition border border-emerald-500/20">
                <Plus className="text-emerald-500" />
            </div>
            <span className="text-slate-400 text-xs font-bold uppercase tracking-wider">Novo Perfil</span>
        </button>

        {profiles.map(p => (
            <div key={p.id} className="bg-slate-900 border border-slate-800 p-5 rounded-xl hover:border-slate-600 transition relative group shadow-lg">
                <div className="flex justify-between items-start mb-4">
                    <div className="flex items-center gap-3">
                         <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-slate-800 to-slate-900 border border-slate-700 flex items-center justify-center text-sm font-bold text-slate-200">
                            {p.name.substring(0,2).toUpperCase()}
                         </div>
                         <div>
                            <h4 className="font-bold text-slate-200 text-sm mb-1">{p.name}</h4>
                            <span className="text-[10px] font-bold text-slate-500 px-1.5 py-0.5 bg-black rounded border border-slate-800 uppercase tracking-wide">{p.format}</span>
                         </div>
                    </div>
                    <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition translate-x-2 group-hover:translate-x-0">
                         <button onClick={() => loadProfile(p)} className="p-2 hover:bg-slate-800 rounded text-slate-400 hover:text-white transition"><Save size={16}/></button>
                         <button onClick={() => onDelete(p.id)} className="p-2 hover:bg-red-900/20 rounded text-slate-400 hover:text-red-400 transition"><Trash2 size={16}/></button>
                    </div>
                </div>
                
                <div className="space-y-3 mb-4">
                    <div className="flex items-center gap-2 text-xs text-slate-400">
                        <Mic size={12} className="text-blue-500" />
                        <span className="font-medium text-slate-300">{VOICE_OPTIONS.find(v => v.id === p.voiceProfile)?.label || p.voiceProfile}</span>
                    </div>
                     <div className="flex items-center gap-2 text-xs text-slate-400">
                        <Music size={12} className="text-purple-500" />
                        <span className="font-medium text-slate-300 truncate w-40">{BGM_OPTIONS.find(v => v.id === p.bgmTheme)?.label || p.bgmTheme}</span>
                    </div>
                </div>

                <div className="pt-3 border-t border-slate-800 flex items-center gap-2 text-[10px] font-bold tracking-wider">
                    {p.youtubeCredentials ? (
                        <span className="flex items-center gap-1.5 text-emerald-500 bg-emerald-500/10 px-2 py-1 rounded border border-emerald-500/20"><Check size={10} strokeWidth={3} /> YOUTUBE LINKED</span>
                    ) : (
                        <span className="flex items-center gap-1.5 text-slate-500 bg-slate-800 px-2 py-1 rounded"><X size={10} strokeWidth={3} /> UNLINKED</span>
                    )}
                </div>
            </div>
        ))}
    </div>
  );
};

export default ProfileEditor;