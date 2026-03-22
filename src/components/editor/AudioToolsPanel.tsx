import React, { useState, useEffect, useCallback } from 'react';
import { Speech, Mic, Scissors, ChevronRight, ChevronDown, Check, Zap, Search, Bookmark, Loader2 } from 'lucide-react';
import { EngineConfig, ElevenLabsSettings } from '../../types';
import { ExtractAudioPanel } from '../ExtractAudioPanel';
import { AudioGenerateModal } from './AudioGenerateModal';
import { GOOGLE_VOICES } from '../GoogleTTSPanel';
import { ElevenLabsService } from '../../services/ElevenLabsService';
import { ElevenLabsVoice, ElevenLabsModel } from '../../types';
import { EditorProject, generateId } from '../../types/editor';
import { EditorPersistenceService } from '../../services/EditorPersistenceService';
import * as DiskStorage from '../../services/DiskStorageService';

interface AudioToolsPanelProps {
  config: EngineConfig;
  project?: EditorProject;
  persistence?: EditorPersistenceService;
  onProjectUpdate?: (project: EditorProject) => void;
  onSwitchToMedia?: () => void;
}

type AudioSubTab = 'google' | 'eleven' | 'extract';

export const AudioToolsPanel: React.FC<AudioToolsPanelProps> = ({
  config,
  project,
  persistence,
  onProjectUpdate,
  onSwitchToMedia,
}) => {
  const [activeSubTab, setActiveSubTab] = useState<AudioSubTab>('google');
  const [showGenerateModal, setShowGenerateModal] = useState(false);

  // Google TTS state
  const [gSelectedVoiceId, setGSelectedVoiceId] = useState('Zephyr');
  const [gIsVoiceSelectorOpen, setGIsVoiceSelectorOpen] = useState(false);
  const [gVoiceSearch, setGVoiceSearch] = useState('');
  const [gFavorites, setGFavorites] = useState<Set<string>>(new Set());
  const [gViewMode, setGViewMode] = useState<'all' | 'favorites'>('all');

  // ElevenLabs state
  const [eVoices, setEVoices] = useState<ElevenLabsVoice[]>([]);
  const [eModels, setEModels] = useState<ElevenLabsModel[]>([]);
  const [eSelectedVoiceId, setESelectedVoiceId] = useState('');
  const [eSelectedModelId, setESelectedModelId] = useState('eleven_multilingual_v2');
  const [eIsVoiceSelectorOpen, setEIsVoiceSelectorOpen] = useState(false);
  const [eIsModelSelectorOpen, setEIsModelSelectorOpen] = useState(false);
  const [eVoiceSearch, setEVoiceSearch] = useState('');
  const [eFavorites, setEFavorites] = useState<Set<string>>(new Set());
  const [eViewMode, setEViewMode] = useState<'all' | 'favorites'>('all');
  const [eSettings] = useState<ElevenLabsSettings>({ stability: 0.5, similarity_boost: 0.75 });
  const [eLoading, setELoading] = useState(false);

  // Load Google TTS favorites
  useEffect(() => {
    (async () => {
      let saved: string[] | null = null;
      try { saved = await DiskStorage.readJson<string[]>('preferences/google_tts_favorites.json'); } catch {}
      if (!saved) { const raw = localStorage.getItem('google_tts_favorites'); if (raw) saved = JSON.parse(raw); }
      if (saved) setGFavorites(new Set(saved));
    })();
  }, []);

  useEffect(() => { DiskStorage.writeJson('preferences/google_tts_favorites.json', Array.from(gFavorites)); }, [gFavorites]);

  // Load ElevenLabs data
  useEffect(() => {
    const apiKey = config.apiKeys.elevenLabs;
    if (!apiKey) return;
    setELoading(true);
    const service = new ElevenLabsService(apiKey);
    Promise.all([service.getVoices(), service.getModels()])
      .then(([voices, models]) => {
        setEVoices(voices);
        setEModels(models);
        if (voices.length > 0) setESelectedVoiceId(voices[0].voice_id);
      })
      .catch(console.error)
      .finally(() => setELoading(false));

    // Load favorites
    (async () => {
      let saved: string[] | null = null;
      try { saved = await DiskStorage.readJson<string[]>('preferences/elevenlabs_favorites.json'); } catch {}
      if (!saved) { const raw = localStorage.getItem('elevenlabs_favorites'); if (raw) saved = JSON.parse(raw); }
      if (saved) setEFavorites(new Set(saved));
    })();
  }, [config.apiKeys.elevenLabs]);

  useEffect(() => { DiskStorage.writeJson('preferences/elevenlabs_favorites.json', Array.from(eFavorites)); }, [eFavorites]);

  const toggleGFav = (e: React.MouseEvent, id: string) => { e.stopPropagation(); setGFavorites(p => { const n = new Set(p); n.has(id) ? n.delete(id) : n.add(id); return n; }); };
  const toggleEFav = (e: React.MouseEvent, id: string) => { e.stopPropagation(); setEFavorites(p => { const n = new Set(p); n.has(id) ? n.delete(id) : n.add(id); return n; }); };

  const handleImportAudio = useCallback(async (filePath: string, name: string, duration: number) => {
    if (!project || !persistence || !onProjectUpdate) return;
    const updatedProject = { ...project };
    if (!updatedProject.metadata) updatedProject.metadata = {};
    const currentLibrary = (updatedProject.metadata as any).library || [];
    const newItem = {
      id: generateId(),
      name,
      path: filePath,
      type: 'audio' as const,
      duration: duration || 0,
      addedAt: new Date().toISOString(),
    };
    (updatedProject.metadata as any).library = [...currentLibrary, newItem];
    await persistence.saveEditorProject(updatedProject);
    onProjectUpdate(updatedProject);
    setShowGenerateModal(false);
    if (onSwitchToMedia) onSwitchToMedia();
  }, [project, persistence, onProjectUpdate, onSwitchToMedia]);

  const gSelectedVoice = GOOGLE_VOICES.find(v => v.id === gSelectedVoiceId);
  const eSelectedVoice = eVoices.find(v => v.voice_id === eSelectedVoiceId);
  const eSelectedModel = eModels.find(m => m.model_id === eSelectedModelId);

  const tabs: { id: AudioSubTab; label: string; icon: any }[] = [
    { id: 'google', label: 'Google TTS', icon: Speech },
    { id: 'eleven', label: 'ElevenLabs', icon: Mic },
    { id: 'extract', label: 'Extrair', icon: Scissors },
  ];

  return (
    <div className="flex flex-col h-full bg-theme-secondary overflow-hidden">
      {/* Sub-tabs header */}
      <div className="flex items-center gap-0.5 p-1.5 bg-theme-primary border-b border-theme">
        {tabs.map((tab) => {
          const isActive = activeSubTab === tab.id;
          const Icon = tab.icon;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveSubTab(tab.id)}
              className={`flex-1 flex items-center justify-center gap-1.5 px-1 py-1.5 rounded-lg text-[10px] font-bold transition-all ${
                isActive
                  ? 'bg-primary text-white shadow-lg shadow-primary/20'
                  : 'text-theme-muted hover:text-theme-primary hover:bg-theme-hover'
              }`}
            >
              <Icon size={12} />
              {tab.label}
            </button>
          );
        })}
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto custom-scrollbar p-3">
        {/* ===== GOOGLE TTS ===== */}
        {activeSubTab === 'google' && (
          <div className="flex flex-col gap-3">
            {/* Model badge */}
            <div className="px-3 py-2 rounded-lg bg-primary/10 flex items-center gap-2">
              <Zap size={13} className="text-primary" />
              <span className="text-[11px] font-bold text-primary">Gemini 2.5 Pro TTS</span>
            </div>

            {/* Voice Selector */}
            <div className="flex flex-col gap-1.5">
              <label className="text-[10px] font-bold text-theme-muted uppercase tracking-wider">Voz</label>
              <div className="relative">
                <button
                  onClick={() => setGIsVoiceSelectorOpen(!gIsVoiceSelectorOpen)}
                  className="w-full flex items-center justify-between p-2.5 rounded-lg border border-theme transition-all hover:border-primary/30"
                  style={{ backgroundColor: 'var(--df-bg-input)' }}
                >
                  <div className="flex items-center gap-2.5">
                    <div className="w-7 h-7 rounded-full bg-primary/10 flex items-center justify-center text-primary font-bold text-[10px]">
                      {gSelectedVoice?.label.charAt(0)}
                    </div>
                    <div className="flex flex-col items-start">
                      <span className="text-xs font-semibold text-theme-primary">{gSelectedVoice?.label}</span>
                      <span className="text-[10px] text-theme-muted">google • core voice</span>
                    </div>
                  </div>
                  <ChevronRight size={14} className="text-theme-muted" />
                </button>

                {/* Voice Popover */}
                {gIsVoiceSelectorOpen && (
                  <>
                    <div className="fixed inset-0 z-40" onClick={() => setGIsVoiceSelectorOpen(false)} />
                    <div className="absolute top-full left-0 w-full mt-1 rounded-lg border border-theme shadow-xl z-50 overflow-hidden" style={{ backgroundColor: 'var(--df-bg-primary)' }}>
                      <div className="p-2.5 border-b border-theme">
                        <div className="flex gap-3 mb-2 text-[10px]">
                          <button onClick={() => setGViewMode('all')} className={`pb-1 border-b-2 font-semibold ${gViewMode === 'all' ? 'border-primary text-primary' : 'border-transparent text-theme-muted'}`}>Explorar</button>
                          <button onClick={() => setGViewMode('favorites')} className={`pb-1 border-b-2 font-semibold ${gViewMode === 'favorites' ? 'border-primary text-primary' : 'border-transparent text-theme-muted'}`}>Favoritas</button>
                        </div>
                        <div className="relative">
                          <Search size={12} className="absolute left-2 top-1/2 -translate-y-1/2 text-theme-placeholder" />
                          <input value={gVoiceSearch} onChange={e => setGVoiceSearch(e.target.value)} className="w-full pl-7 pr-2 py-1.5 text-[11px] rounded-md border border-theme" style={{ backgroundColor: 'var(--df-bg-input)' }} placeholder="Buscar voz..." autoFocus />
                        </div>
                      </div>
                      <div className="max-h-[220px] overflow-y-auto custom-scrollbar p-1">
                        {GOOGLE_VOICES.filter(v => (gViewMode === 'all' || gFavorites.has(v.id)) && v.label.toLowerCase().includes(gVoiceSearch.toLowerCase())).map(voice => (
                          <div key={voice.id} onClick={() => { setGSelectedVoiceId(voice.id); setGIsVoiceSelectorOpen(false); }} className={`group flex items-center justify-between p-2 rounded-md cursor-pointer transition-colors ${gSelectedVoiceId === voice.id ? 'bg-primary/5' : 'hover:bg-theme-hover'}`}>
                            <div className="flex items-center gap-2 overflow-hidden">
                              <div className={`w-6 h-6 shrink-0 rounded-full flex items-center justify-center text-[9px] font-bold ${gSelectedVoiceId === voice.id ? 'bg-primary/10 text-primary' : 'bg-theme-hover text-theme-muted'}`}>{voice.label.charAt(0)}</div>
                              <div className="flex flex-col overflow-hidden">
                                <span className={`text-[11px] truncate ${gSelectedVoiceId === voice.id ? 'font-bold text-primary' : 'font-medium text-theme-primary'}`}>{voice.label}</span>
                                <span className="text-[9px] text-theme-muted truncate">{voice.tags.join(', ')}</span>
                              </div>
                            </div>
                            <button onClick={e => toggleGFav(e, voice.id)} className={`p-1 rounded transition-all ${gFavorites.has(voice.id) ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'}`}>
                              <Bookmark size={10} className={gFavorites.has(voice.id) ? 'fill-amber-500 text-amber-500' : 'text-theme-muted'} />
                            </button>
                          </div>
                        ))}
                      </div>
                    </div>
                  </>
                )}
              </div>
            </div>

            {/* Generate Button */}
            <button
              onClick={() => setShowGenerateModal(true)}
              className="w-full flex items-center justify-center gap-2 py-2.5 rounded-lg bg-primary text-white text-xs font-bold hover:opacity-90 transition-all"
            >
              <Zap size={14} className="fill-white" />
              Gerar Áudio
            </button>
          </div>
        )}

        {/* ===== ELEVENLABS ===== */}
        {activeSubTab === 'eleven' && (
          <div className="flex flex-col gap-3">
            {eLoading ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 size={20} className="text-primary animate-spin" />
              </div>
            ) : (
              <>
                {/* Voice Selector */}
                <div className="flex flex-col gap-1.5">
                  <label className="text-[10px] font-bold text-theme-muted uppercase tracking-wider">Voz</label>
                  <div className="relative">
                    <button
                      onClick={() => setEIsVoiceSelectorOpen(!eIsVoiceSelectorOpen)}
                      className="w-full flex items-center justify-between p-2.5 rounded-lg border border-theme transition-all hover:border-primary/30"
                      style={{ backgroundColor: 'var(--df-bg-input)' }}
                    >
                      <div className="flex items-center gap-2.5">
                        <div className="w-7 h-7 rounded-full bg-purple-500/10 flex items-center justify-center text-purple-400 font-bold text-[10px]">
                          {eSelectedVoice?.name?.charAt(0) || '?'}
                        </div>
                        <div className="flex flex-col items-start">
                          <span className="text-xs font-semibold text-theme-primary">{eSelectedVoice?.name || 'Selecione'}</span>
                          <span className="text-[10px] text-theme-muted">{eSelectedVoice?.category || 'elevenlabs'}</span>
                        </div>
                      </div>
                      <ChevronRight size={14} className="text-theme-muted" />
                    </button>

                    {eIsVoiceSelectorOpen && (
                      <>
                        <div className="fixed inset-0 z-40" onClick={() => setEIsVoiceSelectorOpen(false)} />
                        <div className="absolute top-full left-0 w-full mt-1 rounded-lg border border-theme shadow-xl z-50 overflow-hidden" style={{ backgroundColor: 'var(--df-bg-primary)' }}>
                          <div className="p-2.5 border-b border-theme">
                            <div className="flex gap-3 mb-2 text-[10px]">
                              <button onClick={() => setEViewMode('all')} className={`pb-1 border-b-2 font-semibold ${eViewMode === 'all' ? 'border-primary text-primary' : 'border-transparent text-theme-muted'}`}>Explorar</button>
                              <button onClick={() => setEViewMode('favorites')} className={`pb-1 border-b-2 font-semibold ${eViewMode === 'favorites' ? 'border-primary text-primary' : 'border-transparent text-theme-muted'}`}>Favoritas</button>
                            </div>
                            <div className="relative">
                              <Search size={12} className="absolute left-2 top-1/2 -translate-y-1/2 text-theme-placeholder" />
                              <input value={eVoiceSearch} onChange={e => setEVoiceSearch(e.target.value)} className="w-full pl-7 pr-2 py-1.5 text-[11px] rounded-md border border-theme" style={{ backgroundColor: 'var(--df-bg-input)' }} placeholder="Buscar voz..." autoFocus />
                            </div>
                          </div>
                          <div className="max-h-[220px] overflow-y-auto custom-scrollbar p-1">
                            {eVoices.filter(v => (eViewMode === 'all' || eFavorites.has(v.voice_id)) && v.name.toLowerCase().includes(eVoiceSearch.toLowerCase())).map(voice => (
                              <div key={voice.voice_id} onClick={() => { setESelectedVoiceId(voice.voice_id); setEIsVoiceSelectorOpen(false); }} className={`group flex items-center justify-between p-2 rounded-md cursor-pointer transition-colors ${eSelectedVoiceId === voice.voice_id ? 'bg-primary/5' : 'hover:bg-theme-hover'}`}>
                                <div className="flex items-center gap-2 overflow-hidden">
                                  <div className={`w-6 h-6 shrink-0 rounded-full flex items-center justify-center text-[9px] font-bold ${eSelectedVoiceId === voice.voice_id ? 'bg-purple-500/10 text-purple-400' : 'bg-theme-hover text-theme-muted'}`}>{voice.name.charAt(0)}</div>
                                  <div className="flex flex-col overflow-hidden">
                                    <span className={`text-[11px] truncate ${eSelectedVoiceId === voice.voice_id ? 'font-bold text-primary' : 'font-medium text-theme-primary'}`}>{voice.name}</span>
                                    <span className="text-[9px] text-theme-muted truncate">{voice.category}</span>
                                  </div>
                                </div>
                                <button onClick={e => toggleEFav(e, voice.voice_id)} className={`p-1 rounded transition-all ${eFavorites.has(voice.voice_id) ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'}`}>
                                  <Bookmark size={10} className={eFavorites.has(voice.voice_id) ? 'fill-amber-500 text-amber-500' : 'text-theme-muted'} />
                                </button>
                              </div>
                            ))}
                          </div>
                        </div>
                      </>
                    )}
                  </div>
                </div>

                {/* Model Selector */}
                <div className="flex flex-col gap-1.5">
                  <label className="text-[10px] font-bold text-theme-muted uppercase tracking-wider">Modelo</label>
                  <div className="relative">
                    <button
                      onClick={() => setEIsModelSelectorOpen(!eIsModelSelectorOpen)}
                      className="w-full flex items-center justify-between p-2.5 rounded-lg border border-theme transition-all hover:border-primary/30"
                      style={{ backgroundColor: 'var(--df-bg-input)' }}
                    >
                      <span className="text-xs font-semibold text-theme-primary truncate">{eSelectedModel?.name || 'Multilingual V2'}</span>
                      <ChevronDown size={14} className={`text-theme-muted transition-transform ${eIsModelSelectorOpen ? 'rotate-180' : ''}`} />
                    </button>

                    {eIsModelSelectorOpen && (
                      <>
                        <div className="fixed inset-0 z-40" onClick={() => setEIsModelSelectorOpen(false)} />
                        <div className="absolute top-full left-0 w-full mt-1 rounded-lg border border-theme shadow-xl z-50 overflow-hidden" style={{ backgroundColor: 'var(--df-bg-primary)' }}>
                          <div className="max-h-[200px] overflow-y-auto custom-scrollbar p-1">
                            {eModels.map(model => (
                              <button key={model.model_id} onClick={() => { setESelectedModelId(model.model_id); setEIsModelSelectorOpen(false); }} className={`w-full text-left p-2.5 rounded-md flex items-center justify-between transition-colors ${eSelectedModelId === model.model_id ? 'bg-primary/5' : 'hover:bg-theme-hover'}`}>
                                <div className="flex flex-col overflow-hidden">
                                  <span className={`text-[11px] truncate ${eSelectedModelId === model.model_id ? 'font-bold text-primary' : 'font-medium text-theme-primary'}`}>{model.name}</span>
                                  <span className="text-[9px] text-theme-muted truncate">{model.description}</span>
                                </div>
                                {eSelectedModelId === model.model_id && <Check size={12} className="text-primary shrink-0" />}
                              </button>
                            ))}
                          </div>
                        </div>
                      </>
                    )}
                  </div>
                </div>

                {/* Generate Button */}
                <button
                  onClick={() => setShowGenerateModal(true)}
                  disabled={!eSelectedVoiceId}
                  className="w-full flex items-center justify-center gap-2 py-2.5 rounded-lg bg-primary text-white text-xs font-bold hover:opacity-90 transition-all disabled:opacity-40"
                >
                  <Zap size={14} className="fill-white" />
                  Gerar Áudio
                </button>
              </>
            )}
          </div>
        )}

        {/* ===== EXTRACT ===== */}
        {activeSubTab === 'extract' && (
          <div className="rounded-lg border border-theme overflow-hidden p-3" style={{ backgroundColor: 'var(--df-bg-primary)' }}>
            <h3 className="text-xs font-bold text-theme-primary mb-3 flex items-center gap-2">
              <Scissors size={14} className="text-primary" />
              Extração de Áudio de Vídeos
            </h3>
            <ExtractAudioPanel config={config} />
          </div>
        )}
      </div>

      {/* Generate Modal */}
      {showGenerateModal && (
        <AudioGenerateModal
          provider={activeSubTab === 'eleven' ? 'eleven' : 'google'}
          config={config}
          voiceId={activeSubTab === 'eleven' ? eSelectedVoiceId : gSelectedVoiceId}
          voiceName={activeSubTab === 'eleven' ? (eSelectedVoice?.name || 'Voice') : (gSelectedVoice?.label || 'Voice')}
          modelId={activeSubTab === 'eleven' ? eSelectedModelId : undefined}
          elevenLabsSettings={activeSubTab === 'eleven' ? eSettings : undefined}
          onClose={() => setShowGenerateModal(false)}
          onImport={handleImportAudio}
        />
      )}
    </div>
  );
};

export default AudioToolsPanel;
