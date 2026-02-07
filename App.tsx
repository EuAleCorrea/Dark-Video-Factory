import React, { useState, useEffect, useRef } from 'react';
import {
  Activity, Layers, Settings, Play, StopCircle, Terminal as TerminalIcon,
  CheckCircle, Search, FileText, Loader2, X, MonitorPlay, FolderOpen,
  RefreshCw, Cpu, HardDrive, Thermometer, Wifi, Cloud, ChevronDown
} from 'lucide-react';
import { ChannelProfile, JobStatus, PipelineStep, VideoFormat, SystemMetrics, EngineConfig, ReferenceVideo, VideoJob } from './types';
import ProfileEditor from './components/ProfileEditor';
import Terminal from './components/Terminal';
import Storyboard from './components/Storyboard';
import AssetBrowser from './components/AssetBrowser';
import SettingsPanel from './components/SettingsPanel';
import DistributionPanel from './components/DistributionPanel';
import PreviewPlayer from './components/PreviewPlayer';
import VideoSelectorModal from './components/VideoSelectorModal';
import { searchChannelVideos, transcribeVideo } from './lib/youtubeMock';
import { PersistenceService } from './services/PersistenceService';
import { useJobMonitor } from './hooks/useJobMonitor';

const STORAGE_KEY_CONFIG = 'DARK_FACTORY_CONFIG_V1';

const INITIAL_CONFIG: EngineConfig = {
  hostVolumePath: './temp',
  ffmpegContainerImage: 'linuxserver/ffmpeg',
  maxConcurrentJobs: 1,
  providers: { scripting: 'GEMINI', image: 'GEMINI', tts: 'GEMINI' },
  apiKeys: {
    gemini: '', openai: '', elevenLabs: '', flux: '', openrouter: '', youtube: '', apify: '',
    supabaseUrl: process.env.NEXT_PUBLIC_SUPABASE_URL || '',
    supabaseKey: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || ''
  }
};

export default function App() {
  const [activeTab, setActiveTab] = useState<'dashboard' | 'profiles' | 'settings'>('dashboard');
  const [monitorTab, setMonitorTab] = useState<'terminal' | 'assets'>('terminal');

  const [config, setConfig] = useState<EngineConfig>(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem(STORAGE_KEY_CONFIG);
      if (saved) return { ...INITIAL_CONFIG, ...JSON.parse(saved) };
    }
    return INITIAL_CONFIG;
  });

  const persistenceRef = useRef<PersistenceService>(new PersistenceService(config));

  const [profiles, setProfiles] = useState<ChannelProfile[]>([]);
  const [selectedProfileId, setSelectedProfileId] = useState<string>('');
  const { jobs, loading: loadingJobs } = useJobMonitor(selectedProfileId);
  const [selectedJobId, setSelectedJobId] = useState<string | null>(null);

  const selectedJob = jobs.find(j => j.id === selectedJobId) || jobs[0] || null;
  const metrics: SystemMetrics = { cpuUsage: 12, ramUsage: 34, gpuUsage: 8, activeContainers: 1, dockerStatus: 'CONNECTED', temperature: 42 };

  const [themeInput, setThemeInput] = useState<string>('');
  const [modelChannelInput, setModelChannelInput] = useState<string>('');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isSearchingChannel, setIsSearchingChannel] = useState(false);
  const [foundVideos, setFoundVideos] = useState<ReferenceVideo[]>([]);
  const [selectedRefVideo, setSelectedRefVideo] = useState<ReferenceVideo | null>(null);
  const [isTranscribing, setIsTranscribing] = useState(false);
  const [transcribedText, setTranscribedText] = useState<string | null>(null);
  const [showPreview, setShowPreview] = useState(false);
  const [uptime] = useState('142H 12M');

  useEffect(() => {
    const initData = async () => {
      // 1. Carregar Perfis
      const loadedProfiles = await persistenceRef.current.loadProfiles();
      if (loadedProfiles) {
        setProfiles(loadedProfiles);
        if (loadedProfiles.length > 0 && !selectedProfileId) {
          setSelectedProfileId(loadedProfiles[0].id);
        }
      }

      // 2. Carregar Configurações do Motor (incluindo chaves de API do Supabase)
      const cloudConfig = await persistenceRef.current.loadEngineConfig();
      if (cloudConfig) {
        setConfig(prev => ({ ...prev, ...cloudConfig }));
      }
    };
    initData();
  }, []);

  useEffect(() => {
    persistenceRef.current.updateConfig(config);
    // Salva no localStorage para cache rápido
    localStorage.setItem(STORAGE_KEY_CONFIG, JSON.stringify(config));
    // Salva no Supabase para persistência duradoura (apenas quando houver mudanças)
    persistenceRef.current.saveEngineConfig(config);
  }, [config]);

  const handleSearchChannel = async () => {
    if (!modelChannelInput) return;
    setIsSearchingChannel(true);
    setIsModalOpen(true);
    setFoundVideos([]);
    try {
      const videos = await searchChannelVideos(modelChannelInput, config.apiKeys.youtube);
      setFoundVideos(videos);
    } finally {
      setIsSearchingChannel(false);
    }
  };

  const handleSelectRefVideo = async (video: ReferenceVideo) => {
    setSelectedRefVideo(video);
    setIsModalOpen(false);
    setIsTranscribing(true);
    try {
      const text = await transcribeVideo(video.id, config.apiKeys.apify);
      setTranscribedText(text);
    } catch {
      setTranscribedText("Erro ao extrair transcrição.");
    } finally {
      setIsTranscribing(false);
    }
  };

  const clearRefVideo = () => {
    setSelectedRefVideo(null);
    setTranscribedText(null);
  };

  const queueJob = async () => {
    if (!themeInput.trim() || !selectedProfileId) return;
    try {
      const response = await fetch('/api/jobs', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          channelId: selectedProfileId,
          theme: themeInput,
          modelChannel: modelChannelInput,
          referenceScript: transcribedText
        })
      });
      if (!response.ok) throw new Error('Falha ao criar job');
      const newJob = await response.json();
      setThemeInput('');
      setSelectedJobId(newJob.id);
    } catch (e) {
      console.error("Erro ao enfileirar job:", e);
      alert("Erro ao criar job. Verifique o console.");
    }
  };

  const handleSaveProfile = async (newProfile: ChannelProfile) => {
    setProfiles(prev => {
      const exists = prev.some(p => p.id === newProfile.id);
      const updated = exists ? prev.map(p => p.id === newProfile.id ? newProfile : p) : [...prev, newProfile];
      persistenceRef.current.saveProfiles(updated);
      return updated;
    });
  };

  const handleDeleteProfile = (id: string) => {
    setProfiles(prev => {
      const updated = prev.filter(p => p.id !== id);
      persistenceRef.current.saveProfiles(updated);
      return updated;
    });
  };

  const getSelectedProfile = () => profiles.find(p => p.id === selectedJob?.channelId);

  return (
    <>
      <VideoSelectorModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        isLoading={isSearchingChannel}
        channelName={modelChannelInput}
        videos={foundVideos}
        onSelect={handleSelectRefVideo}
      />

      {showPreview && selectedJob?.result && (
        <PreviewPlayer
          storyboard={selectedJob.result.storyboard}
          audioUrl={selectedJob.result.masterAudioUrl || ''}
          subtitleConfig={getSelectedProfile()?.subtitleStyle}
          format={getSelectedProfile()?.format || VideoFormat.SHORTS}
          onClose={() => setShowPreview(false)}
        />
      )}

      {/* ========== HEADER ========== */}
      <header className="h-12 border-b border-[#262626] flex items-center justify-between px-4 bg-[#0a0a0a] z-50 shrink-0">
        <div className="flex items-center gap-6">
          {/* LOGO */}
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 bg-primary rounded flex items-center justify-center">
              <Activity className="text-black w-4 h-4" strokeWidth={2.5} />
            </div>
            <span className="font-semibold text-white tracking-tight">
              DARK FACTORY <span className="text-[10px] text-primary font-mono ml-1">V2.1</span>
            </span>
          </div>

          <div className="h-5 w-px bg-[#262626]" />

          {/* SYSTEM STATUS */}
          <div className="flex items-center gap-4 text-[11px] font-mono">
            <div className="flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-primary status-pulse" />
              <span className="text-primary font-medium tracking-wider">SYSTEM ONLINE</span>
            </div>
            <span className="text-zinc-500">UPTIME: {uptime}</span>
          </div>

          <div className="h-5 w-px bg-[#262626]" />

          {/* METRICS */}
          <div className="hidden lg:flex items-center gap-4 text-[10px] font-mono text-zinc-400">
            <div className="flex items-center gap-1.5">
              <span className="text-cyan-400">CPU</span>
              <span className="text-zinc-500">NÚCLEO</span>
              <div className="w-12 h-1 bg-[#262626] rounded-full overflow-hidden">
                <div className="h-full bg-cyan-400" style={{ width: `${metrics.cpuUsage}%` }} />
              </div>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="text-purple-400">GPU</span>
              <span className="text-zinc-500">CLUSTER</span>
              <div className="w-12 h-1 bg-[#262626] rounded-full overflow-hidden">
                <div className="h-full bg-purple-400" style={{ width: `${metrics.gpuUsage}%` }} />
              </div>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="text-amber-400">MEMÓRIA</span>
              <div className="w-12 h-1 bg-[#262626] rounded-full overflow-hidden">
                <div className="h-full bg-amber-400" style={{ width: `${metrics.ramUsage}%` }} />
              </div>
            </div>
          </div>
        </div>

        {/* RIGHT SIDE */}
        <div className="flex items-center gap-4 text-[10px] font-mono text-zinc-400">
          <div className="hidden md:flex items-center gap-1">
            <HardDrive size={12} />
            <span>NÓS: {metrics.activeContainers}</span>
          </div>
          <div className="hidden md:flex items-center gap-1 text-primary">
            <Thermometer size={12} />
            <span>TÉRMICO: {metrics.temperature}°C</span>
          </div>
          <button
            onClick={() => setActiveTab('settings')}
            className="p-2 hover:bg-[#262626] rounded transition-colors text-zinc-400 hover:text-white"
          >
            <Settings size={16} />
          </button>
        </div>
      </header>

      {/* ========== MAIN CONTAINER ========== */}
      <div className="flex flex-1 overflow-hidden">

        {/* ========== SIDEBAR ========== */}
        <aside className="w-14 border-r border-[#262626] bg-[#0a0a0a] flex flex-col shrink-0">
          <nav className="flex-1 py-4 flex flex-col items-center gap-2">
            {[
              { id: 'dashboard', icon: Activity, label: 'Dashboard' },
              { id: 'profiles', icon: Layers, label: 'Perfis' },
              { id: 'settings', icon: Settings, label: 'Config' },
            ].map((item) => (
              <button
                key={item.id}
                onClick={() => setActiveTab(item.id as typeof activeTab)}
                title={item.label}
                className={`w-10 h-10 flex items-center justify-center rounded-lg transition-all ${activeTab === item.id
                  ? 'bg-primary/15 text-primary border-l-2 border-primary'
                  : 'text-zinc-500 hover:bg-[#141414] hover:text-zinc-300'
                  }`}
              >
                <item.icon size={18} />
              </button>
            ))}
          </nav>

          {/* BOTTOM ICONS */}
          <div className="pb-4 flex flex-col items-center gap-2">
            <button className="w-10 h-10 flex items-center justify-center rounded-lg text-zinc-600 hover:text-zinc-400 hover:bg-[#141414] transition-all">
              <Layers size={16} />
            </button>
          </div>
        </aside>

        {/* ========== WORKSPACE ========== */}
        <main className="flex-1 flex flex-col overflow-hidden bg-[#0a0a0a]">
          {activeTab === 'dashboard' ? (
            <div className="flex-1 flex overflow-hidden">

              {/* LEFT PANEL - NOVA OPERAÇÃO */}
              <section className="w-80 border-r border-[#262626] bg-[#0a0a0a] flex flex-col shrink-0">
                <div className="p-5 flex-1 overflow-y-auto custom-scrollbar">
                  {/* HEADER */}
                  <div className="flex items-center gap-2 mb-6">
                    <RefreshCw size={14} className={`text-primary ${loadingJobs ? 'animate-spin' : ''}`} />
                    <h2 className="text-xs font-mono font-semibold tracking-widest text-zinc-300 uppercase">
                      Nova Operação
                    </h2>
                  </div>

                  <div className="space-y-5">
                    {/* CANAL ALVO */}
                    <div>
                      <label className="block text-[10px] font-mono text-zinc-500 uppercase mb-2 tracking-wider">
                        Canal Alvo
                      </label>
                      <div className="relative">
                        <select
                          className="w-full bg-[#141414] border border-[#262626] rounded-md px-3 py-2.5 text-sm text-zinc-200 appearance-none cursor-pointer hover:border-[#404040] focus:border-primary focus:ring-0 transition-colors"
                          value={selectedProfileId}
                          onChange={(e) => setSelectedProfileId(e.target.value)}
                        >
                          <option value="">Selecione um Canal...</option>
                          {profiles.map(p => (
                            <option key={p.id} value={p.id}>{p.name} ({p.format})</option>
                          ))}
                        </select>
                        <ChevronDown size={14} className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-500 pointer-events-none" />
                      </div>
                    </div>

                    {/* CANAL MODELO */}
                    <div>
                      <label className="block text-[10px] font-mono text-zinc-500 uppercase mb-2 tracking-wider">
                        Canal Modelo (Opcional)
                      </label>
                      <div className="flex gap-2">
                        <input
                          className="flex-1 bg-[#141414] border border-[#262626] rounded-md px-3 py-2 text-sm text-zinc-200 placeholder:text-zinc-600 hover:border-[#404040] focus:border-primary transition-colors"
                          placeholder="@CanalModelo"
                          value={modelChannelInput}
                          onChange={(e) => setModelChannelInput(e.target.value)}
                        />
                        <button
                          onClick={handleSearchChannel}
                          disabled={isSearchingChannel || !modelChannelInput}
                          className="bg-[#141414] border border-[#262626] p-2.5 rounded-md hover:bg-[#1a1a1a] hover:border-[#404040] text-zinc-400 disabled:opacity-50 transition-all"
                        >
                          {isSearchingChannel ? <Loader2 size={16} className="animate-spin" /> : <Search size={16} />}
                        </button>
                      </div>

                      {/* SELECTED VIDEO CARD */}
                      {selectedRefVideo && (
                        <div className="mt-3 bg-[#141414] border border-[#262626] p-3 rounded-lg flex items-center gap-3 group relative">
                          <img
                            alt="Thumbnail"
                            className="w-14 h-9 object-cover rounded bg-zinc-800"
                            src={selectedRefVideo.thumbnailUrl}
                          />
                          <div className="flex-1 min-w-0">
                            <h4 className="text-xs font-medium line-clamp-1 text-zinc-300">{selectedRefVideo.title}</h4>
                            <div className="text-[10px] text-zinc-500 font-mono mt-1">
                              {isTranscribing ? (
                                <span className="text-amber-500 flex items-center gap-1">
                                  <Loader2 size={8} className="animate-spin" /> Extraindo...
                                </span>
                              ) : (
                                <span className="text-primary flex items-center gap-1">
                                  <FileText size={8} /> Transcrição OK
                                </span>
                              )}
                            </div>
                          </div>
                          <button
                            onClick={clearRefVideo}
                            className="absolute -top-1.5 -right-1.5 bg-red-500 text-white rounded-full p-0.5 opacity-0 group-hover:opacity-100 transition"
                          >
                            <X size={10} />
                          </button>
                        </div>
                      )}
                    </div>

                    {/* PROMPT */}
                    <div>
                      <label className="block text-[10px] font-mono text-zinc-500 uppercase mb-2 tracking-wider">
                        Conceito / Prompt
                      </label>
                      <textarea
                        className="w-full h-28 bg-[#141414] border border-[#262626] rounded-md px-3 py-2.5 text-sm text-zinc-200 resize-none placeholder:text-zinc-600 hover:border-[#404040] focus:border-primary transition-colors"
                        placeholder="Descreva o conceito do vídeo detalhadamente..."
                        value={themeInput}
                        onChange={(e) => setThemeInput(e.target.value)}
                      />
                    </div>

                    {/* ACTION BUTTON */}
                    <button
                      onClick={queueJob}
                      disabled={!themeInput || isTranscribing || !selectedProfileId}
                      className="w-full bg-primary hover:bg-emerald-400 text-black font-semibold py-3 rounded-md glow-button flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
                    >
                      <Play size={14} fill="currentColor" />
                      <span className="uppercase text-xs tracking-widest">Inicializar Job</span>
                    </button>
                  </div>

                  {/* QUEUE STATUS */}
                  <div className="mt-8">
                    <div className="flex items-center justify-between mb-4">
                      <div className="flex items-center gap-2">
                        <span className="w-2 h-2 rounded-full bg-amber-500" />
                        <span className="text-[10px] font-mono text-zinc-500 uppercase tracking-wider">Status da Fila</span>
                      </div>
                      <span className="text-[10px] font-mono text-zinc-600">{jobs.length} TAREFAS</span>
                    </div>

                    {jobs.length === 0 ? (
                      <div className="bg-[#141414] border border-[#262626] rounded-lg p-6 flex flex-col items-center justify-center">
                        <div className="w-10 h-10 rounded-full bg-[#1a1a1a] flex items-center justify-center mb-3">
                          <HardDrive size={18} className="text-zinc-600" />
                        </div>
                        <span className="text-[10px] font-mono text-zinc-500 uppercase tracking-wider">Sistema Ocioso</span>
                      </div>
                    ) : (
                      <div className="space-y-2">
                        {jobs.slice(0, 5).map(j => (
                          <button
                            key={j.id}
                            onClick={() => setSelectedJobId(j.id)}
                            className={`w-full text-left p-3 rounded-lg border transition-all ${selectedJobId === j.id
                              ? 'bg-[#141414] border-primary'
                              : 'bg-transparent border-[#262626] hover:bg-[#141414]'
                              }`}
                          >
                            <div className="flex justify-between items-center mb-2">
                              <span className="font-medium text-zinc-200 text-xs truncate max-w-[70%]">{j.theme}</span>
                              <span className={`badge ${j.status === JobStatus.COMPLETED ? 'badge-success' :
                                j.status === JobStatus.PROCESSING ? 'badge-warning' :
                                  j.status === JobStatus.FAILED ? 'badge-error' : 'badge-info'
                                }`}>
                                {j.status}
                              </span>
                            </div>
                            <div className="w-full bg-[#262626] h-1 rounded-full overflow-hidden">
                              <div className="bg-primary h-full transition-all" style={{ width: `${j.progress}%` }} />
                            </div>
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              </section>

              {/* RIGHT PANEL - PREVIEW */}
              <section className="flex-1 flex flex-col overflow-hidden">
                {/* MAIN PREVIEW AREA */}
                <div className="flex-1 grid-bg relative overflow-hidden">
                  {selectedJob ? (
                    <div className="absolute inset-0 flex flex-col p-6 overflow-y-auto custom-scrollbar">
                      {/* JOB HEADER */}
                      <div className="flex justify-between items-start mb-6 shrink-0">
                        <div>
                          <h2 className="text-lg font-semibold text-white mb-2">{selectedJob.theme}</h2>
                          <div className="flex gap-2 text-[10px] font-mono uppercase">
                            <span className={`badge ${selectedJob.status === JobStatus.PROCESSING ? 'badge-warning' :
                              selectedJob.status === JobStatus.COMPLETED ? 'badge-success' :
                                selectedJob.status === JobStatus.FAILED ? 'badge-error' : 'badge-info'
                              }`}>
                              {selectedJob.status}
                            </span>
                            <span className="badge bg-[#262626] text-zinc-400">STEP: {selectedJob.currentStep}</span>
                          </div>
                        </div>

                        <div className="flex gap-2">
                          {selectedJob.status === JobStatus.REVIEW_PENDING && (
                            <button className="bg-primary hover:bg-emerald-400 text-black px-4 py-2 rounded text-xs font-semibold flex items-center gap-2 glow-button">
                              <CheckCircle size={14} /> APROVAR
                            </button>
                          )}
                          {selectedJob.status === JobStatus.FAILED && (
                            <button className="bg-blue-600 hover:bg-blue-500 text-white px-4 py-2 rounded text-xs font-semibold flex items-center gap-2">
                              <RefreshCw size={14} /> RETRY
                            </button>
                          )}
                          {(selectedJob.status === JobStatus.PROCESSING || selectedJob.status === JobStatus.QUEUED) && (
                            <button className="bg-red-900/50 hover:bg-red-900 text-red-200 px-4 py-2 rounded text-xs font-semibold flex items-center gap-2 border border-red-900/50">
                              <StopCircle size={14} /> ABORT
                            </button>
                          )}
                          {selectedJob.status === JobStatus.COMPLETED && (
                            <button
                              onClick={() => setShowPreview(true)}
                              className="bg-[#262626] hover:bg-[#363636] text-white px-4 py-2 rounded text-xs font-semibold flex items-center gap-2 border border-[#404040]"
                            >
                              <MonitorPlay size={14} /> PREVIEW
                            </button>
                          )}
                        </div>
                      </div>

                      {/* CONTENT */}
                      <div className="flex-1">
                        {selectedJob.status === JobStatus.COMPLETED && <DistributionPanel job={selectedJob} />}
                        {selectedJob.result?.storyboard ? (
                          <Storyboard
                            segments={selectedJob.result.storyboard}
                            isEditable={selectedJob.status === JobStatus.REVIEW_PENDING}
                            onUpdate={() => { }}
                            onSplit={() => { }}
                            onDelete={() => { }}
                            onRegenerate={() => { }}
                          />
                        ) : (
                          <div className="h-64 flex flex-col items-center justify-center border border-dashed border-[#262626] rounded-lg">
                            <Loader2 size={28} className="text-zinc-700 animate-spin mb-4" />
                            <span className="text-zinc-500 text-xs font-mono uppercase tracking-wider">
                              Aguardando geração de conteúdo...
                            </span>
                          </div>
                        )}
                      </div>
                    </div>
                  ) : (
                    <div className="absolute inset-0 flex flex-col items-center justify-center">
                      <MonitorPlay className="w-16 h-16 mb-4 text-zinc-800" strokeWidth={1} />
                      <p className="font-mono text-xs uppercase tracking-[0.2em] text-zinc-600">
                        Selecione um Job Ativo para Monitorar
                      </p>
                    </div>
                  )}
                </div>

                {/* BOTTOM DOCK */}
                <div className="h-48 border-t border-[#262626] bg-[#0a0a0a] flex flex-col shrink-0">
                  {/* TABS */}
                  <div className="flex border-b border-[#262626]">
                    <button
                      onClick={() => setMonitorTab('terminal')}
                      className={`px-5 py-2.5 text-[10px] font-mono font-semibold uppercase tracking-wider flex items-center gap-2 border-b-2 transition-colors ${monitorTab === 'terminal'
                        ? 'border-primary text-zinc-200'
                        : 'border-transparent text-zinc-600 hover:text-zinc-400'
                        }`}
                    >
                      <TerminalIcon size={12} /> Logs de Sistema
                    </button>
                    <button
                      onClick={() => setMonitorTab('assets')}
                      className={`px-5 py-2.5 text-[10px] font-mono font-semibold uppercase tracking-wider flex items-center gap-2 border-b-2 transition-colors ${monitorTab === 'assets'
                        ? 'border-primary text-zinc-200'
                        : 'border-transparent text-zinc-600 hover:text-zinc-400'
                        }`}
                    >
                      <FolderOpen size={12} /> Sistema de Arquivos
                    </button>
                  </div>

                  {/* DOCK CONTENT */}
                  <div className="flex-1 bg-[#0a0a0a] overflow-hidden">
                    {selectedJob ? (
                      monitorTab === 'terminal' ? (
                        <Terminal logs={selectedJob.logs} className="h-full" />
                      ) : (
                        <AssetBrowser jobId={selectedJob.id} files={selectedJob.files || []} className="h-full border-0 rounded-none bg-transparent" />
                      )
                    ) : (
                      <div className="flex items-center justify-center h-full text-zinc-600 font-mono text-[10px] tracking-wider">
                        // AGUARDANDO SELEÇÃO DE CONTEXTO
                      </div>
                    )}
                  </div>
                </div>
              </section>
            </div>
          ) : activeTab === 'profiles' ? (
            <div className="flex-1 p-8 overflow-y-auto custom-scrollbar">
              <div className="max-w-6xl mx-auto">
                <ProfileEditor profiles={profiles} onSave={handleSaveProfile} onDelete={handleDeleteProfile} />
              </div>
            </div>
          ) : (
            <div className="flex-1 p-8 overflow-y-auto custom-scrollbar">
              <SettingsPanel config={config} onSave={setConfig} />
              <div className="mt-8 text-xs text-zinc-500 font-mono p-4 border border-[#262626] rounded-lg bg-[#141414]">
                <p className="mb-2 uppercase font-bold text-zinc-400">Variáveis de Ambiente</p>
                <p>SUPABASE_URL: {process.env.NEXT_PUBLIC_SUPABASE_URL ? 'DEFINIDA' : 'NÃO DEFINIDA'}</p>
                <p>SUPABASE_KEY: {process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ? 'DEFINIDA' : 'NÃO DEFINIDA'}</p>
              </div>
            </div>
          )}
        </main>
      </div>

      {/* ========== FOOTER ========== */}
      <footer className="h-8 border-t border-[#262626] bg-[#0a0a0a] px-4 flex items-center justify-between shrink-0">
        <div className="flex items-center gap-4 text-[10px] font-mono text-zinc-600">
          {/* Can add breadcrumbs or path here */}
        </div>
        <div className="flex items-center gap-4 text-[10px] font-mono text-zinc-500">
          <button className="hover:text-zinc-300 transition-colors">
            <RefreshCw size={12} />
          </button>
          <button className="hover:text-zinc-300 transition-colors">
            <Wifi size={12} />
          </button>
          <div className="flex items-center gap-1.5">
            <Cloud size={12} className="text-primary" />
            <span className="text-primary">CLOUD:</span>
            <span className="text-zinc-400">LOCAL</span>
          </div>
        </div>
      </footer>
    </>
  );
}