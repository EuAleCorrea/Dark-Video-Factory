export enum VideoFormat {
  SHORTS = 'SHORTS',
  LONG_FORM = 'LONG_FORM',
}

export interface SubtitleConfig {
  fontName: string;
  fontSize: number;
  primaryColor: string; // Hex code
  outlineColor: string; // Hex code
  backgroundColor: string; // Hex code (usually transparent/semi)
  alignment: 'BOTTOM' | 'CENTER' | 'TOP';
}

export interface ChannelPrompt {
  id: string;
  profileId: string;
  promptText: string;
  isActive: boolean;
  createdAt: string;
}

export interface ChannelProfile {
  id: string;
  name: string;
  format: VideoFormat;
  visualStyle: string;
  voiceProfile: string;
  bgmTheme: string;
  subtitleStyle: SubtitleConfig;
  llmPersona: string;
  youtubeCredentials: boolean;
  activePromptId?: string; // NOVO: ID do prompt versionado ativo
}

export interface ReferenceVideo {
  id: string;
  title: string;
  thumbnailUrl: string;
  views: string;
  duration: string;
  publishedAt: string;
  transcript?: string;
}

export enum JobStatus {
  QUEUED = 'QUEUED',
  PROCESSING = 'PROCESSING',
  REVIEW_PENDING = 'REVIEW_PENDING',
  COMPLETED = 'COMPLETED',
  FAILED = 'FAILED',
  PENDING = 'PENDING',
}

export enum PipelineStep {
  REFERENCE_FETCH = 'Buscando Vídeo Modelo',
  REFERENCE_TRANSCRIBE = 'Transcrevendo Referência',
  INIT = 'Inicializando',
  SCRIPTING = 'Gerando Roteiro (LLM)',
  TRANSCRIPTION_CHUNKING = 'Chunking Inteligente & Timing',
  APPROVAL = 'Aguardando Revisão Humana',
  VOICE_GEN = 'Sintetizando Áudio (TTS)',
  AUDIO_MIXING = 'Engenharia de Áudio (BGM + Mix)',
  TRANSCRIPTION_ALIGN = 'Transcrição Whisper & Alinhamento',
  IMAGE_PROMPTING = 'Gerando Ativos Visuais (IA)',
  RENDERING_PENDING = 'Aguardando Renderização',
  RENDERING = 'Renderização FFmpeg Docker',
  THUMBNAIL_GEN = 'Gerando Thumbnail (IA)',
  METADATA_GEN = 'Gerando Metadados Virais (SEO)',
  UPLOADING = 'Enviando para o YouTube',
  DONE = 'Finalizado',
}

export interface LogEntry {
  timestamp: string;
  level: 'INFO' | 'WARN' | 'ERROR' | 'SUCCESS';
  message: string;
}

export interface StoryboardSegment {
  id: number;
  timeRange: string;
  scriptText: string;
  visualPrompt: string;
  duration: number;
  assets?: {
    imageUrl?: string;
    audioUrl?: string;
  };
}

export interface VideoMetadata {
  titles: string[];
  description: string;
  tags: string[];
  thumbnailUrl?: string;
  thumbnailPrompt?: string;
}

export interface MockFile {
  name: string;
  path: string;
  size: string;
  type: 'FILE' | 'DIR';
  createdAt: string;
}

export interface VideoJob {
  id: string;
  channelId: string;
  modelChannel?: string;
  referenceScript?: string;
  referenceMetadata?: any;
  appliedPromptId?: string; // NOVO: ID do prompt fixado neste vídeo
  theme: string;
  status: JobStatus;
  currentStep: PipelineStep;
  progress: number;
  logs: LogEntry[];
  files: MockFile[];
  metadata?: VideoMetadata;
  result?: {
    script: string;
    storyboard: StoryboardSegment[];
    rawPrompts: string[];
    masterAudioUrl?: string;
  };
}

export interface SystemMetrics {
  cpuUsage: number;
  ramUsage: number;
  gpuUsage: number;
  dockerStatus: 'CONNECTED' | 'DISCONNECTED';
  activeContainers: number;
  temperature: number;
}

export interface EngineConfig {
  hostVolumePath: string;
  ffmpegContainerImage: string;
  maxConcurrentJobs: number;
  providers: {
    scripting: 'GEMINI' | 'OPENAI' | 'OPENROUTER';
    image: 'GEMINI' | 'FLUX';
    tts: 'GEMINI' | 'ELEVENLABS';
  };
  apiKeys: {
    gemini: string;
    youtube?: string;
    apify?: string;
    supabaseUrl?: string;
    supabaseKey?: string;
    elevenLabs: string;
    flux: string;
    openai: string;
    openrouter: string;
  };
}