import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  Activity, Layers, Settings, Play, StopCircle, Terminal as TerminalIcon,
  CheckCircle, Search, FileText, Loader2, X, MonitorPlay, FolderOpen,
  RefreshCw, Cpu, HardDrive, Thermometer, Wifi, Cloud, ChevronDown, Zap, AlertTriangle, Info,
  Plus, LayoutGrid, Mic, Image
} from 'lucide-react';
import { ChannelProfile, JobStatus, PipelineStep, VideoFormat, SystemMetrics, EngineConfig, ReferenceVideo, VideoJob, VideoProject, PipelineStage, PIPELINE_STAGES_ORDER } from './types';
import ProfileEditor from './components/ProfileEditor';
import Terminal from './components/Terminal';
import Storyboard from './components/Storyboard';
import AssetBrowser from './components/AssetBrowser';
import SettingsPanel from './components/SettingsPanel';
import { Dashboard } from './components/Dashboard';
import DistributionPanel from './components/DistributionPanel';
import PreviewPlayer from './components/PreviewPlayer';
import VideoSelectorModal from './components/VideoSelectorModal';
import KanbanBoard from './components/KanbanBoard';
import BatchActionBar from './components/BatchActionBar';
import StageActionModal from './components/StageActionModal';
import TranscriptApprovalModal from './components/TranscriptApprovalModal';
import StageDetailsModal from './components/StageDetailsModal';
import { ElevenLabsPanel } from './components/ElevenLabsPanel';
import { GoogleTTSPanel } from './components/GoogleTTSPanel';
import { ImageGeneratorPanel } from './components/ImageGeneratorPanel';
import { searchChannelVideos, transcribeVideo } from './lib/youtubeMock';
import { PersistenceService } from './services/PersistenceService';
import { ProjectService } from './services/ProjectService';
import { useJobMonitor } from './hooks/useJobMonitor';
import { JobQueueService } from './services/JobQueueService';
import { PipelineExecutor, PromptPreviewRequest } from './services/PipelineExecutor';
import { configureSupabase } from './lib/supabase';
import PromptDebugModal, { PromptPreviewData } from './components/PromptDebugModal';
import ErrorDetailModal from './components/ErrorDetailModal';

const STORAGE_KEY_CONFIG = 'DARK_FACTORY_CONFIG_V1';

const INITIAL_CONFIG: EngineConfig = {
  hostVolumePath: './temp',
  ffmpegContainerImage: 'linuxserver/ffmpeg',
  maxConcurrentJobs: 1,
  providers: { scripting: 'GEMINI', image: 'GEMINI', tts: 'GEMINI' },
  apiKeys: {
    gemini: '', openai: '', elevenLabs: '', flux: '', openrouter: '', youtube: '', apify: '',
    supabaseUrl: '',
    supabaseKey: ''
  }
};

export default function App() {
  const [activeTab, setActiveTab] = useState<'pipeline' | 'dashboard' | 'profiles' | 'settings' | 'test-11labs' | 'google-tts' | 'image-generator'>('pipeline');
  const [monitorTab, setMonitorTab] = useState<'terminal' | 'assets'>('terminal');

  const [config, setConfig] = useState<EngineConfig>(INITIAL_CONFIG);
  const [isConfigLoaded, setIsConfigLoaded] = useState(false);

  const persistenceRef = useRef<PersistenceService>(new PersistenceService());
  const projectServiceRef = useRef<ProjectService>(new ProjectService());
  const pipelineExecutorRef = useRef<PipelineExecutor | null>(null);

  // Pipeline Kanban state
  const [projects, setProjects] = useState<VideoProject[]>([]);
  const [selectedProjectIds, setSelectedProjectIds] = useState<Set<string>>(new Set());
  const [isStageModalOpen, setIsStageModalOpen] = useState(false);
  const [stageModalMode, setStageModalMode] = useState<'auto' | 'manual'>('auto');
  const [reviewProjects, setReviewProjects] = useState<VideoProject[]>([]);
  const [detailsProject, setDetailsProject] = useState<VideoProject | null>(null);
  const [detailsStage, setDetailsStage] = useState<PipelineStage | null>(null);
  const [isDetailsModalOpen, setIsDetailsModalOpen] = useState(false);
  const [isErrorModalOpen, setIsErrorModalOpen] = useState(false);
  const [errorProject, setErrorProject] = useState<VideoProject | null>(null);

  // Debug Prompt State
  const [isDebugModalOpen, setIsDebugModalOpen] = useState(false);
  const [debugData, setDebugData] = useState<PromptPreviewData | null>(null);
  const debugResolveRef = useRef<((value: boolean) => void) | null>(null);

  const [profiles, setProfiles] = useState<ChannelProfile[]>([]);

  // Refs for stable access in callbacks/services
  const configRef = useRef(config);
  const profilesRef = useRef(profiles);

  useEffect(() => { configRef.current = config; }, [config]);
  useEffect(() => { profilesRef.current = profiles; }, [profiles]);
  const [selectedProfileId, setSelectedProfileId] = useState<string>('');
  const { jobs: remoteJobs, loading: loadingJobs } = useJobMonitor(selectedProfileId);
  const [localJobs, setLocalJobs] = useState<VideoJob[]>([]);
  const [ffmpegInstalled, setFfmpegInstalled] = useState<boolean | null>(null);

  // Merge remote (Supabase) + local jobs
  const jobs = [...localJobs, ...remoteJobs];

  // Job update callback
  const handleJobUpdate = useCallback((updatedJob: VideoJob) => {
    setLocalJobs(prev => {
      const exists = prev.some(j => j.id === updatedJob.id);
      if (exists) return prev.map(j => j.id === updatedJob.id ? updatedJob : j);
      return [...prev, updatedJob];
    });
  }, []);

  const jobQueueRef = useRef<JobQueueService | null>(null);

  useEffect(() => {
    const init = async () => {
      // 1. Carregar Configurações (Híbrido: Local + Cloud)
      const savedConfig = await persistenceRef.current.loadEngineConfig();
      if (savedConfig) {
        setConfig(prev => ({ ...prev, ...savedConfig }));
      }
      setIsConfigLoaded(true);

      // 2. Carregar Perfis e Selecionar o Primeiro
      const savedProfiles = await persistenceRef.current.loadProfiles();
      if (savedProfiles && savedProfiles.length > 0) {
        setProfiles(savedProfiles);
        setSelectedProfileId(savedProfiles[0].id);
      }

      // 3. Check FFmpeg
      const tempQueue = new JobQueueService(() => { }, () => undefined, () => INITIAL_CONFIG, () => undefined);
      const ffmpegInfo = await tempQueue.checkFfmpeg();
      setFfmpegInstalled(ffmpegInfo.installed);
      if (ffmpegInfo.installed) {
        console.log(`[App] FFmpeg detectado: ${ffmpegInfo.version}`);
      } else {
        console.warn('[App] FFmpeg NÃO encontrado no PATH');
      }

      // 4. Initialize PipelineExecutor
      pipelineExecutorRef.current = new PipelineExecutor(
        projectServiceRef.current,
        persistenceRef.current,
        () => configRef.current, // Dynamic config access
        (id) => profilesRef.current.find(p => p.id === id) // Dynamic profile access
      );

      // Set Prompt Preview Callback
      pipelineExecutorRef.current.setPromptPreview((data) => {
        return new Promise((resolve) => {
          setDebugData(data);
          setIsDebugModalOpen(true);
          debugResolveRef.current = resolve;
        });
      });

      // 5. Carregar Projetos
      const savedProjects = await projectServiceRef.current.loadProjects();
      setProjects(savedProjects);
    };
    init();
  }, []);

  // Sincroniza o service e o cache local quando a config muda
  // GUARD: Só persiste DEPOIS que as chaves foram carregadas, para não sobrescrever com dados vazios
  useEffect(() => {
    if (!isConfigLoaded) return;
    persistenceRef.current.updateConfig(config);

    // Sincroniza o cliente global (usado pelo ProjectService)
    if (config.apiKeys.supabaseUrl && config.apiKeys.supabaseKey) {
      configureSupabase(config.apiKeys.supabaseUrl, config.apiKeys.supabaseKey);
    }

    localStorage.setItem(STORAGE_KEY_CONFIG, JSON.stringify(config));
    persistenceRef.current.saveEngineConfig(config);
  }, [config, isConfigLoaded]);

  // Carregar prompt ativo quando o perfil mudar
  useEffect(() => {
    const loadActivePrompt = async () => {
      if (!selectedProfileId) {
        setRewritePrompt('');
        setActivePromptId(null);
        return;
      }
      const selectedProfile = profiles.find(p => p.id === selectedProfileId);
      if (selectedProfile?.activePromptId) {
        const prompts = await persistenceRef.current.loadChannelPrompts(selectedProfileId);
        const active = prompts.find(p => p.id === selectedProfile.activePromptId);
        if (active) {
          setRewritePrompt(active.promptText);
          setActivePromptId(active.id);
        }
      } else {
        setRewritePrompt('');
        setActivePromptId(null);
      }
    };
    loadActivePrompt();
  }, [selectedProfileId, profiles]);

  // Estados de Operação
  const [selectedJobId, setSelectedJobId] = useState<string | null>(null);
  const [rewritePrompt, setRewritePrompt] = useState<string>('');
  const [modelChannelInput, setModelChannelInput] = useState<string>('');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isSearchingChannel, setIsSearchingChannel] = useState(false);
  const [foundVideos, setFoundVideos] = useState<ReferenceVideo[]>([]);
  const [selectedRefVideo, setSelectedRefVideo] = useState<ReferenceVideo | null>(null);
  const [referenceMetadata, setReferenceMetadata] = useState<any>(null);
  const [isTranscribing, setIsTranscribing] = useState(false);
  const [transcribedText, setTranscribedText] = useState<string | null>(null);
  const [showPreview, setShowPreview] = useState(false);
  const [uptime] = useState('142H 12M');
  const [isTranscriptModalOpen, setIsTranscriptModalOpen] = useState(false);
  const [configAlert, setConfigAlert] = useState<{ message: string; key: string } | null>(null);
  const configAlertTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const showConfigAlert = (message: string, key: string) => {
    if (configAlertTimerRef.current) clearTimeout(configAlertTimerRef.current);
    setConfigAlert({ message, key });
    configAlertTimerRef.current = setTimeout(() => setConfigAlert(null), 8000);
  };
  const [activePromptId, setActivePromptId] = useState<string | null>(null);
  const [searchError, setSearchError] = useState<string | null>(null);

  // Initialize JobQueueService when dependencies are ready
  useEffect(() => {
    jobQueueRef.current = new JobQueueService(
      handleJobUpdate,
      (channelId) => profiles.find(p => p.id === channelId),
      () => config,
      () => rewritePrompt || undefined,
    );
  }, [profiles, config, handleJobUpdate, rewritePrompt]);

  const handleStageClick = (project: VideoProject, stage: PipelineStage) => {
    setDetailsProject(project);
    setDetailsStage(stage);
    setIsDetailsModalOpen(true);
  };

  const handleViewError = (project: VideoProject) => {
    setErrorProject(project);
    setIsErrorModalOpen(true);
  };

  const handleResetStage = async (projectId: string) => {
    try {
      const project = projects.find(p => p.id === projectId);
      if (!project) return;

      await projectServiceRef.current.updateProject(projectId, {
        status: 'ready',
        errorMessage: undefined
      });

      setProjects(prev => prev.map(p => p.id === projectId ? { ...p, status: 'ready', errorMessage: undefined, updatedAt: new Date().toISOString() } : p));
    } catch (e) {
      console.error('Failed to reset project stage:', e);
    }
  };

  const selectedJob = jobs.find(j => j.id === selectedJobId) || jobs[0] || null;
  const metrics: SystemMetrics = {
    cpuUsage: 12, ramUsage: 34, gpuUsage: 8, activeContainers: 1,
    dockerStatus: 'CONNECTED', temperature: 42
  };

  const handleSearchChannel = async (channelName: string) => {
    if (!channelName) return;

    const apiKey = config.apiKeys.youtube;
    if (!apiKey) {
      showConfigAlert('A chave da YouTube Data API não está configurada. Vá em Configurações para adicioná-la.', 'youtube');
      return;
    }

    setIsSearchingChannel(true);
    setFoundVideos([]);
    setSearchError(null);

    try {
      const videos = await searchChannelVideos(channelName, apiKey);
      if (videos.length === 0) {
        setSearchError("Nenhum vídeo encontrado. Verifique o nome do canal.");
      }
      setFoundVideos(videos);
      setIsModalOpen(true); // Open modal to show results/errors
    } catch (e: any) {
      console.error("Search failed", e);
      setSearchError(e.message || "Erro ao buscar vídeos.");
      setIsModalOpen(true); // Open modal to show error
    } finally {
      setIsSearchingChannel(false);
    }
  };

  const handleSelectVideo = async (video: ReferenceVideo) => {
    // This is for the "Old" flow (Profile Editor).
    // The "New" flow (Pipeline) uses handleMultiSelectVideos.
    // We need to distinguish or unify.
    if (activeTab === 'pipeline') {
      await handleMultiSelectVideos([video]);
    } else {
      // Profile Editor flow
      setSelectedRefVideo(video);
      setIsModalOpen(false);
      setIsTranscribing(true);
      try {
        const result = await transcribeVideo(video.id, config.apiKeys.apify);
        setTranscribedText(result.transcript);
        setReferenceMetadata(result.metadata);
      } catch {
        setTranscribedText("Erro ao extrair transcrição.");
      } finally {
        setIsTranscribing(false);
      }
    }
  };

  const handleMultiSelectVideos = async (videos: ReferenceVideo[]) => {
    if (!selectedProfileId) {
      showConfigAlert("Selecione um perfil antes de criar projetos.", 'profile');
      return;
    }

    const newProjects = await Promise.all(videos.map(video => {
      return projectServiceRef.current.createProject(selectedProfileId, video.title, {
        reference: {
          videoId: video.id,
          videoUrl: `https://youtube.com/watch?v=${video.id}`,
          videoTitle: video.title,
          channelName: video.channelName,
          transcript: video.transcript,
          thumbnailUrl: video.thumbnailUrl,
          mode: 'auto'
        }
      });
    }));

    setProjects(prev => [...newProjects, ...prev]);
    setIsModalOpen(false);
    // Optional: Toast success
  };

  const clearRefVideo = () => {
    setSelectedRefVideo(null);
    setTranscribedText(null);
  };

  const queueJob = async (status: JobStatus = JobStatus.QUEUED) => {
    if (!selectedProfileId) return;
    if (status === JobStatus.QUEUED && !config.apiKeys.gemini?.trim()) {
      showConfigAlert('A chave da Gemini API não está configurada. Vá em Configurações para adicioná-la.', 'gemini');
      return;
    }
    try {
      const newJob: VideoJob = {
        id: crypto.randomUUID(),
        channelId: selectedProfileId,
        theme: rewritePrompt.substring(0, 50) || 'Sem Titulo',
        modelChannel: modelChannelInput,
        referenceScript: transcribedText || undefined,
        referenceMetadata: referenceMetadata,
        appliedPromptId: activePromptId || undefined,
        status: status,
        currentStep: PipelineStep.INIT,
        progress: 0,
        logs: [{ timestamp: new Date().toISOString(), level: 'INFO', message: '📋 Job criado e adicionado à fila' }],
        files: []
      };

      // Add to local state immediately
      setLocalJobs(prev => [...prev, newJob]);
      setSelectedJobId(newJob.id);

      // Enqueue for processing
      if (status === JobStatus.QUEUED && jobQueueRef.current) {
        jobQueueRef.current.enqueue(newJob);
      }

      console.log('[App] Job enqueued:', newJob.id);
      setRewritePrompt('');
      setModelChannelInput('');
      setSelectedRefVideo(null);
      setTranscribedText(null);
      setReferenceMetadata(null);
      setIsTranscriptModalOpen(false);
    } catch (e) {
      console.error('Failed to queue job:', e);
      alert("Erro ao criar job. Verifique o console.");
    }
  };

  const startPendingJob = async (job: VideoJob) => {
    try {
      if (job.status === JobStatus.REVIEW_PENDING && jobQueueRef.current) {
        console.log('[App] Aprovando job para renderização:', job.id);
        await jobQueueRef.current.renderJob(job);
      } else if (job.status === JobStatus.QUEUED && jobQueueRef.current) {
        console.log('[App] Iniciando job na fila:', job.id);
        jobQueueRef.current.enqueue(job);
      }
    } catch (e) {
      console.error('Failed to start pending job:', e);
      alert("Erro ao iniciar job. Verifique o console.");
    }
  };

  // ─── PIPELINE HANDLERS ────────────────────────────────────

  const filteredProjects = selectedProfileId
    ? projects.filter(p => p.channelId === selectedProfileId)
    : projects;

  const getSelectedProjectsStage = (): PipelineStage | null => {
    if (selectedProjectIds.size === 0) return null;
    const firstSelected = projects.find(p => selectedProjectIds.has(p.id));
    return firstSelected?.currentStage || null;
  };

  const handleCreateProject = async () => {
    if (!selectedProfileId) {
      showConfigAlert('Selecione um perfil/canal antes de criar um projeto.', 'profile');
      return;
    }
    if (!config.apiKeys.youtube) {
      showConfigAlert('A chave da YouTube Data API não está configurada. Vá em Configurações para adicioná-la.', 'youtube');
      return;
    }
    // Open YouTube search modal to pick reference videos
    setIsSearchingChannel(false);
    setIsModalOpen(true);
    setFoundVideos([]);
  };

  const handleSelectRefVideoForProject = async (video: ReferenceVideo) => {
    setIsModalOpen(false);
    try {
      const project = await projectServiceRef.current.createProject(
        selectedProfileId,
        video.title,
        {
          reference: {
            videoId: video.id,
            videoUrl: `https://youtube.com/watch?v=${video.id}`,
            videoTitle: video.title,
            channelName: video.channelName,
            thumbnailUrl: video.thumbnailUrl,
            transcript: video.transcript,
            mode: 'auto',
          }
        }
      );
      setProjects(prev => [project, ...prev]);
    } catch (e) {
      console.error('Failed to create project:', e);
    }
  };

  const handleToggleProjectSelect = (id: string) => {
    setSelectedProjectIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        // Only allow selecting projects from the same stage
        const targetProject = projects.find(p => p.id === id);
        if (targetProject) {
          const currentStage = getSelectedProjectsStage();
          if (currentStage && currentStage !== targetProject.currentStage) {
            // Different stage - clear selection and select only this one
            return new Set([id]);
          }
          next.add(id);
        }
      }
      return next;
    });
  };

  const handleProjectClick = (project: VideoProject) => {
    // For now, toggle selection. Later: open detail panel.
    handleToggleProjectSelect(project.id);
  };

  const handleDeleteSelectedProjects = async () => {
    for (const id of selectedProjectIds) {
      await projectServiceRef.current.deleteProject(id);
    }
    setProjects(prev => prev.filter(p => !selectedProjectIds.has(p.id)));
    setSelectedProjectIds(new Set());
  };

  const handleDeleteProject = async (id: string) => {
    await projectServiceRef.current.deleteProject(id);
    setProjects(prev => prev.filter(p => p.id !== id));
    setSelectedProjectIds(prev => { const next = new Set(prev); next.delete(id); return next; });
  };

  const handleBatchAutoAdvance = async () => {
    setIsStageModalOpen(false);
    const ids = Array.from(selectedProjectIds);

    // Se os projetos estão no estágio REFERENCE, busca transcrição APIFY se necessário
    const selectedProjects = projects.filter(p => ids.includes(p.id));
    const referenceProjects = selectedProjects.filter(p => p.currentStage === PipelineStage.REFERENCE);
    if (referenceProjects.length > 0) {
      // Separar projetos que já possuem transcript dos que precisam buscar via APIFY
      const withTranscript = referenceProjects.filter(p => p.stageData.reference?.transcript);
      const withoutTranscript = referenceProjects.filter(p => !p.stageData.reference?.transcript);

      // Buscar transcrições pendentes via pipeline (APIFY)
      if (withoutTranscript.length > 0 && pipelineExecutorRef.current) {
        setProjects(prev => prev.map(p =>
          withoutTranscript.some(w => w.id === p.id)
            ? { ...p, status: 'processing' as const, errorMessage: undefined }
            : p
        ));

        const processed: VideoProject[] = [];
        for (const proj of withoutTranscript) {
          try {
            const updated = await pipelineExecutorRef.current.processProject(proj);
            if (updated) {
              processed.push(updated);
              setProjects(prev => prev.map(p => p.id === updated.id ? updated : p));
            } else {
              const reloaded = (await projectServiceRef.current.loadProjects()).find(p => p.id === proj.id);
              if (reloaded) {
                processed.push(reloaded);
                setProjects(prev => prev.map(p => p.id === reloaded.id ? reloaded : p));
              }
            }
          } catch (e) {
            console.error(`Failed to fetch transcript for ${proj.id}:`, e);
            setProjects(prev => prev.map(p =>
              p.id === proj.id ? { ...p, status: 'error' as const, errorMessage: String(e) } : p
            ));
          }
        }
        // Combinar projetos que agora têm transcript
        const allReady = [...withTranscript, ...processed.filter(p => p.stageData.reference?.transcript)];
        if (allReady.length > 0) {
          setReviewProjects(allReady);
        }
      } else {
        // Todos já possuem transcript, abrir review direto
        setReviewProjects(referenceProjects);
      }
      setSelectedProjectIds(new Set());
      return;
    }

    // Para outros estágios, segue o fluxo normal do pipeline
    setProjects(prev => prev.map(p =>
      ids.includes(p.id) ? { ...p, status: 'processing' as const, errorMessage: undefined } : p
    ));

    if (!pipelineExecutorRef.current) {
      console.error("PipelineExecutor not initialized");
      return;
    }

    for (const id of ids) {
      const project = projects.find(p => p.id === id);
      if (project) {
        try {
          const updated = await pipelineExecutorRef.current.processProject(project);
          if (updated) {
            setProjects(prev => prev.map(p => p.id === id ? updated : p));
          } else {
            const reloaded = (await projectServiceRef.current.loadProjects()).find(p => p.id === id);
            if (reloaded) setProjects(prev => prev.map(p => p.id === id ? reloaded : p));
          }
        } catch (e) {
          console.error(`Failed to advance project ${id}:`, e);
          setProjects(prev => prev.map(p => p.id === id ? { ...p, status: 'error' as const, errorMessage: String(e) } : p));
        }
      }
    }
    setSelectedProjectIds(new Set());
  };

  const handleBatchManualAdvance = async (input: string | File) => {
    setIsStageModalOpen(false);
    const ids = Array.from(selectedProjectIds);
    const currentStage = getSelectedProjectsStage();
    if (!currentStage) return;

    const nextIdx = PIPELINE_STAGES_ORDER.indexOf(currentStage) + 1;
    const nextStage = PIPELINE_STAGES_ORDER[nextIdx];
    if (!nextStage) return;

    for (const id of ids) {
      const project = projects.find(p => p.id === id);
      if (project) {
        try {
          // Build stage data based on what the next stage expects
          const stageData: Record<string, unknown> = {};
          if (typeof input === 'string') {
            if (nextStage === PipelineStage.SCRIPT) {
              stageData.script = { text: input, wordCount: input.split(/\s+/).length, mode: 'manual' };
            } else if (nextStage === PipelineStage.SUBTITLES) {
              stageData.subtitles = { srtContent: input, mode: 'manual' };
            } else {
              stageData[nextStage] = { content: input, mode: 'manual' };
            }
          } else {
            // File — store URL (would need upload to Supabase storage in real implementation)
            const fileUrl = URL.createObjectURL(input);
            if (nextStage === PipelineStage.AUDIO) {
              stageData.audio = { fileUrl, mode: 'manual' };
            } else if (nextStage === PipelineStage.AUDIO_COMPRESS) {
              stageData.audio_compress = { fileUrl, mode: 'manual' };
            } else if (nextStage === PipelineStage.VIDEO) {
              stageData.video = { fileUrl, mode: 'manual' };
            } else if (nextStage === PipelineStage.THUMBNAIL) {
              stageData.thumbnail = { imageUrl: fileUrl, mode: 'manual' };
            }
          }

          const updated = await projectServiceRef.current.advanceStage(project, stageData);
          setProjects(prev => prev.map(p => p.id === id ? updated : p));
        } catch (e) {
          console.error(`Failed to manually advance project ${id}:`, e);
        }
      }
    }
    setSelectedProjectIds(new Set());
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
        onSelect={handleSelectVideo}
        onMultiSelect={activeTab === 'pipeline' ? handleMultiSelectVideos : undefined}
        error={searchError}
        onSearch={handleSearchChannel}
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
      <header className="h-14 border-b border-[#E2E8F0] flex items-center justify-between px-5 bg-white/80 backdrop-blur-xl z-50 shrink-0">
        <div className="flex items-center gap-5">
          {/* LOGO */}
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-primary rounded-xl flex items-center justify-center">
              <Activity className="text-white w-5 h-5" strokeWidth={2.5} />
            </div>
            <span className="font-semibold text-[#0F172A] tracking-tight text-lg">
              Dark Factory <span className="text-sm text-primary/70 ml-1">v2.1</span>
            </span>
          </div>

          <div className="h-6 w-px bg-[#E2E8F0]" />

          {/* SYSTEM STATUS */}
          <div className="flex items-center gap-3 text-base">
            <div className="flex items-center gap-2">
              <span className="w-2.5 h-2.5 rounded-full bg-primary status-pulse" />
              <span className="text-primary font-medium">Online</span>
            </div>
            <span className="text-[#94A3B8] text-sm">{uptime}</span>
          </div>

          <div className="h-6 w-px bg-[#E2E8F0]" />

          {/* METRICS */}
          <div className="hidden lg:flex items-center gap-5 text-sm text-[#64748B]">
            <div className="flex items-center gap-2">
              <span className="text-[#3B82F6] text-sm font-medium">CPU</span>
              <div className="w-20 h-2 bg-[#E2E8F0] rounded-full overflow-hidden">
                <div className="h-full bg-[#3B82F6] rounded-full transition-all" style={{ width: `${metrics.cpuUsage}%` }} />
              </div>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-[#8B5CF6] text-sm font-medium">GPU</span>
              <div className="w-20 h-2 bg-[#E2E8F0] rounded-full overflow-hidden">
                <div className="h-full bg-[#8B5CF6] rounded-full transition-all" style={{ width: `${metrics.gpuUsage}%` }} />
              </div>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-[#F59E0B] text-sm font-medium">RAM</span>
              <div className="w-20 h-2 bg-[#E2E8F0] rounded-full overflow-hidden">
                <div className="h-full bg-[#F59E0B] rounded-full transition-all" style={{ width: `${metrics.ramUsage}%` }} />
              </div>
            </div>
          </div>
        </div>

        {/* RIGHT SIDE */}
        <div className="flex items-center gap-4 text-base text-[#64748B]">
          <div className="hidden md:flex items-center gap-2">
            <HardDrive size={16} />
            <span>Nós: {metrics.activeContainers}</span>
          </div>
          <div className="hidden md:flex items-center gap-2">
            <Thermometer size={16} />
            <span>{metrics.temperature}°C</span>
          </div>
          <button
            onClick={() => setActiveTab('settings')}
            className="p-2.5 hover:bg-[#F1F5F9] rounded-xl transition-colors text-[#64748B] hover:text-[#0F172A]"
          >
            <Settings size={20} />
          </button>
        </div>
      </header>

      {/* ========== MAIN CONTAINER ========== */}
      <div className="flex flex-1 overflow-hidden">

        {/* ========== SIDEBAR (FIXED) ========== */}
        <aside className="w-64 border-r border-[#E2E8F0] bg-white flex flex-col shrink-0 z-50">
          <nav className="flex-1 py-5 flex flex-col gap-1.5 px-4">
            {[
              { id: 'pipeline', icon: LayoutGrid, label: 'Pipeline' },
              { id: 'dashboard', icon: Activity, label: 'Dashboard' },
              { id: 'profiles', icon: Layers, label: 'Perfis' },
              { id: 'image-generator', icon: Image, label: 'Gerador de Imagens' },
              { id: 'settings', icon: Settings, label: 'Configuração' },
              { id: 'test-11labs', icon: Mic, label: 'Teste 11 Labs' },
              { id: 'google-tts', icon: Mic, label: 'Google TTS' },
            ].map((item) => (
              <button
                key={item.id}
                onClick={() => setActiveTab(item.id as typeof activeTab)}
                className={`w-full h-12 flex items-center gap-3 px-4 rounded-xl transition-all duration-200 ${activeTab === item.id
                  ? 'bg-primary/10 text-primary'
                  : 'text-[#64748B] hover:bg-[#F1F5F9] hover:text-[#0F172A]'
                  }`}
              >
                <item.icon size={20} className="shrink-0" />
                <span className="text-base font-medium">
                  {item.label}
                </span>
              </button>
            ))}
          </nav>

          {/* BOTTOM ACTIONS */}
          <div className="pb-5 flex flex-col gap-1.5 px-4">
            <button
              onClick={handleCreateProject}
              className="w-full h-12 flex items-center gap-3 px-4 rounded-xl text-primary bg-primary/5 hover:bg-primary/10 transition-all font-medium text-base"
            >
              <Plus size={20} className="shrink-0" />
              Novo Projeto
            </button>
          </div>
        </aside>

        {/* ========== WORKSPACE ========== */}
        <main className="flex-1 flex flex-col overflow-hidden bg-[#F8FAFC]">
          {activeTab === 'pipeline' ? (
            <div className="flex-1 flex flex-col overflow-hidden">
              {/* Pipeline Header */}
              <div className="flex items-center justify-between px-6 py-4 bg-white border-b border-[#E2E8F0] shrink-0">
                <div className="flex items-center gap-3">
                  <LayoutGrid size={20} className="text-primary" />
                  <h2 className="text-base font-semibold text-[#0F172A]">Pipeline de Produção</h2>
                  <span className="text-sm text-[#94A3B8] bg-[#F1F5F9] px-3 py-1 rounded-lg">
                    {projects.length} projetos
                  </span>
                </div>
                <div className="flex items-center gap-3">
                  {/* Profile Selector */}
                  <div className="relative">
                    <select
                      className="bg-white border border-[#E2E8F0] rounded-xl px-4 py-2.5 text-sm text-[#0F172A] appearance-none cursor-pointer hover:border-[#CBD5E1] pr-8 transition-colors"
                      value={selectedProfileId}
                      onChange={(e) => setSelectedProfileId(e.target.value)}
                    >
                      <option value="">Todos os Canais</option>
                      {profiles.map(p => (
                        <option key={p.id} value={p.id}>{p.name}</option>
                      ))}
                    </select>
                    <ChevronDown size={14} className="absolute right-3 top-1/2 -translate-y-1/2 text-[#94A3B8] pointer-events-none" />
                  </div>
                  <button
                    onClick={handleCreateProject}
                    className="flex items-center gap-2 px-4 py-2.5 bg-primary text-white text-sm font-semibold rounded-xl hover:opacity-90 transition-all"
                  >
                    <Plus size={16} />
                    Novo Projeto
                  </button>
                </div>
              </div>

              {/* Kanban Board */}
              {/* Kanban Board */}
              <KanbanBoard
                projects={filteredProjects}
                selectedIds={selectedProjectIds}
                onToggleSelect={handleToggleProjectSelect}
                onProjectClick={handleProjectClick}
                onDeleteProject={handleDeleteProject}
                onStageClick={handleStageClick}
                onViewError={handleViewError}
                onDragEnd={async (result) => {
                  const { destination, source, draggableId } = result;

                  if (!destination) return;

                  if (
                    destination.droppableId === source.droppableId &&
                    destination.index === source.index
                  ) {
                    return;
                  }

                  const project = projects.find(p => p.id === draggableId);
                  if (!project) return;

                  const newStage = destination.droppableId as PipelineStage;

                  // Optimistic update
                  setProjects(prev => prev.map(p =>
                    p.id === draggableId
                      ? { ...p, currentStage: newStage }
                      : p
                  ));

                  try {
                    await projectServiceRef.current.updateProject(project.id, { currentStage: newStage });
                  } catch (e) {
                    console.error('Failed to move project:', e);
                    // Revert on error
                    setProjects(prev => prev.map(p =>
                      p.id === draggableId
                        ? { ...p, currentStage: project.currentStage }
                        : p
                    ));
                    alert("Erro ao mover projeto. Tente novamente.");
                  }
                }}
              />

              {/* Batch Action Bar */}
              <BatchActionBar
                selectedCount={selectedProjectIds.size}
                selectedStage={getSelectedProjectsStage()}
                onAdvanceAuto={() => { setStageModalMode('auto'); setIsStageModalOpen(true); }}
                onAdvanceManual={() => { setStageModalMode('manual'); setIsStageModalOpen(true); }}
                onDelete={handleDeleteSelectedProjects}
                onClearSelection={() => setSelectedProjectIds(new Set())}
              />

              {/* Stage Action Modal */}
              <StageActionModal
                isOpen={isStageModalOpen}
                onClose={() => setIsStageModalOpen(false)}
                currentStage={getSelectedProjectsStage() || PipelineStage.REFERENCE}
                projectCount={selectedProjectIds.size}
                onSubmitAuto={handleBatchAutoAdvance}
                onSubmitManual={handleBatchManualAdvance}
              />

              {/* Transcript Approval Modal (Batch) */}
              {reviewProjects.length > 0 && (
                <TranscriptApprovalModal
                  projects={reviewProjects}
                  config={config}
                  onApproveAll={async (results) => {
                    for (const { project: p, transcript, metadata } of results) {
                      // Monta o reference com TODOS os dados da APIFY
                      const enrichedReference = {
                        ...p.stageData.reference!,
                        transcript,
                        // Metadados extras da APIFY
                        description: metadata?.description,
                        viewCount: metadata?.viewCount,
                        publishedAt: metadata?.date,
                        duration: metadata?.duration,
                        // Atualiza título/canal se a APIFY trouxer dados mais precisos
                        ...(metadata?.channelName && { channelName: metadata.channelName }),
                        ...(metadata?.title && { videoTitle: metadata.title }),
                      };

                      await projectServiceRef.current.updateProject(p.id, {
                        stageData: { ...p.stageData, reference: enrichedReference }
                      });
                      const updatedProject = { ...p, stageData: { ...p.stageData, reference: enrichedReference } };
                      const advanced = await projectServiceRef.current.advanceStage(updatedProject, {});
                      setProjects(prev => prev.map(pr => pr.id === p.id ? advanced : pr));
                    }
                    setReviewProjects([]);
                  }}
                  onReject={() => setReviewProjects([])}
                  onClose={() => setReviewProjects([])}
                />
              )}
            </div>
          ) : activeTab === 'dashboard' ? (
            <Dashboard projects={projects} profiles={profiles} />
          ) : activeTab === 'profiles' ? (
            <div className="flex-1 p-8 overflow-y-auto custom-scrollbar">
              <div className="max-w-6xl mx-auto">
                <ProfileEditor
                  persistence={persistenceRef.current}
                  profiles={profiles}
                  config={config}
                  onSave={handleSaveProfile}
                  onDelete={handleDeleteProfile}
                />
              </div>
            </div>
          ) : activeTab === 'test-11labs' ? (
            <ElevenLabsPanel
              apiKey={config.apiKeys.elevenLabs}
              onClose={() => setActiveTab('pipeline')}
            />
          ) : activeTab === 'google-tts' ? (
            <GoogleTTSPanel
              config={config}
              onClose={() => setActiveTab('pipeline')}
            />
          ) : activeTab === 'image-generator' ? (
            <ImageGeneratorPanel config={config} />
          ) : (
            <div className="flex-1 p-8 overflow-y-auto custom-scrollbar">
              <SettingsPanel config={config} onSave={setConfig} />
            </div>
          )}
        </main>
      </div>

      {/* ========== FOOTER ========== */}
      <footer className="h-10 border-t border-[#E2E8F0] bg-white px-6 flex items-center justify-between shrink-0">
        <div className="flex items-center gap-4 text-sm text-[#94A3B8]">
          {/* Breadcrumbs */}
        </div>
        <div className="flex items-center gap-4 text-sm text-[#94A3B8]">
          <button className="hover:text-[#64748B] transition-colors">
            <RefreshCw size={14} />
          </button>
          <button className="hover:text-[#64748B] transition-colors">
            <Wifi size={14} />
          </button>
          <div className="flex items-center gap-2">
            <Cloud size={14} className="text-primary/70" />
            <span className="text-[#64748B]">Local</span>
          </div>
        </div>
      </footer>

      {/* MODAL DE TRANSCRIÇÃO E REESCRITA */}
      {isTranscriptModalOpen && transcribedText && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/30 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-white border border-[#E2E8F0] w-full max-w-4xl max-h-[90vh] rounded-2xl overflow-hidden shadow-2xl flex flex-col scale-in-center">
            {/* Header */}
            <div className="p-4 border-b border-[#E2E8F0] flex items-center justify-between bg-white">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-primary/10 rounded-xl text-primary">
                  <FileText size={18} />
                </div>
                <div>
                  <h3 className="text-base font-semibold text-[#0F172A]">Revisão e Configuração de Job</h3>
                  <p className="text-sm text-[#94A3B8]">
                    {transcribedText.length} caracteres • {selectedRefVideo?.title.substring(0, 50)}...
                  </p>
                </div>
              </div>
              <button
                onClick={() => setIsTranscriptModalOpen(false)}
                className="p-2 hover:bg-[#F1F5F9] rounded-xl text-[#64748B] hover:text-[#0F172A] transition-colors"
              >
                <X size={20} />
              </button>
            </div>

            {/* Content Area - Full Width View */}
            <div className="flex-1 overflow-hidden flex flex-col">
              <div className="p-3 bg-[#F8FAFC] border-b border-[#E2E8F0] text-sm text-[#64748B] flex justify-between items-center">
                <span>Script Original (Edite se necessário)</span>
                <div className="flex items-center gap-2 text-primary/60">
                  <Zap size={12} />
                  <span className="text-sm">Prompt aplicado com perfil ativo</span>
                </div>
              </div>
              <div className="flex-1 overflow-y-auto p-4 custom-scrollbar">
                <textarea
                  className="w-full h-full min-h-[50vh] bg-transparent text-[#0F172A] text-sm leading-relaxed font-mono resize-none outline-none focus:ring-0"
                  value={transcribedText}
                  onChange={(e) => setTranscribedText(e.target.value)}
                  placeholder="Transcrição original..."
                />
              </div>
            </div>

            {/* Footer */}
            <div className="p-4 bg-white border-t border-[#E2E8F0] flex justify-between items-center">
              <span className="text-sm text-[#94A3B8]">
                Perfil ativo: {profiles.find(p => p.id === selectedProfileId)?.name}
              </span>
              <div className="flex gap-3">
                <button
                  onClick={() => setIsTranscriptModalOpen(false)}
                  className="px-5 py-2.5 text-[#64748B] hover:text-[#0F172A] text-sm transition-colors"
                >
                  Cancelar
                </button>
                <button
                  onClick={() => queueJob(JobStatus.PENDING)}
                  disabled={!selectedProfileId}
                  className="px-7 py-3 bg-primary hover:opacity-90 text-white font-semibold rounded-xl text-sm transition-all disabled:opacity-40"
                >
                  Confirmar e Salvar como Pendente
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* CONFIG ALERT TOAST */}
      {configAlert && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-[9999]" style={{ animation: 'fade-in 0.3s ease-out' }}>
          <div className="bg-white border border-amber-200 shadow-xl rounded-2xl px-5 py-4 flex items-start gap-3 max-w-lg">
            <div className="w-9 h-9 shrink-0 rounded-xl bg-amber-50 flex items-center justify-center mt-0.5">
              <AlertTriangle className="w-5 h-5 text-amber-500" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-base font-semibold text-[#0F172A] mb-0.5">Configuração Necessária</p>
              <p className="text-sm text-[#64748B] leading-relaxed">{configAlert.message}</p>
              <button
                onClick={() => { setConfigAlert(null); setActiveTab('settings'); }}
                className="mt-2.5 text-sm font-semibold text-primary hover:underline flex items-center gap-1.5"
              >
                <Settings className="w-3.5 h-3.5" /> Ir para Configurações
              </button>
            </div>
            <button onClick={() => setConfigAlert(null)} className="p-1 rounded-lg hover:bg-slate-100 text-slate-400 hover:text-slate-600 transition-colors shrink-0">
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}

      {/* MODAL DE DETALHES DO ESTÁGIO */}
      <StageDetailsModal
        isOpen={isDetailsModalOpen}
        onClose={() => setIsDetailsModalOpen(false)}
        project={detailsProject}
        stage={detailsStage}
      />

      {/* PROMPT DEBUG MODAL */}
      <PromptDebugModal
        isOpen={isDebugModalOpen}
        data={debugData}
        onConfirm={() => {
          setIsDebugModalOpen(false);
          debugResolveRef.current?.(true);
        }}
        onCancel={() => {
          setIsDebugModalOpen(false);
          debugResolveRef.current?.(false);
        }}
      />
      <ErrorDetailModal
        isOpen={isErrorModalOpen}
        onClose={() => setIsErrorModalOpen(false)}
        project={errorProject}
        onResetStage={handleResetStage}
      />
    </>
  );
}