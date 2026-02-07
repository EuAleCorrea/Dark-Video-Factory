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

export interface ChannelProfile {
  id: string;
  name: string;
  format: VideoFormat;
  visualStyle: string; // Flux.1 base prompt
  voiceProfile: string; // TTS Voice ID
  bgmTheme: string; // Audio Atmosphere
  subtitleStyle: SubtitleConfig; // New: Typography control
  llmPersona: string; // System prompt
  youtubeCredentials: boolean; // Mock connected state
}

export interface ReferenceVideo {
  id: string;
  title: string;
  thumbnailUrl: string;
  views: string;
  duration: string;
  publishedAt: string; // NOVO: Data de publicação para ordenação
  transcript?: string; // Loaded after selection
}

export enum JobStatus {
  QUEUED = 'QUEUED',
  PROCESSING = 'PROCESSING',
  REVIEW_PENDING = 'REVIEW_PENDING', // Waiting for human approval
  COMPLETED = 'COMPLETED',
  FAILED = 'FAILED',
}

export enum PipelineStep {
  // Etapa 0: Busca de Referência
  REFERENCE_FETCH = 'Buscando Vídeo Modelo',
  REFERENCE_TRANSCRIBE = 'Transcrevendo Referência',

  // Etapa 1: Criação do Roteiro
  INIT = 'Inicializando',
  SCRIPTING = 'Gerando Roteiro (LLM)',
  TRANSCRIPTION_CHUNKING = 'Chunking Inteligente & Timing',

  // Etapa 2: Revisão Humana
  APPROVAL = 'Aguardando Revisão Humana',

  // Etapa 3-5: Produção de Assets
  VOICE_GEN = 'Sintetizando Áudio (TTS)',
  AUDIO_MIXING = 'Engenharia de Áudio (BGM + Mix)',
  TRANSCRIPTION_ALIGN = 'Transcrição Whisper & Alinhamento',
  IMAGE_PROMPTING = 'Gerando Ativos Visuais (IA)',

  // Etapa 6: Renderização (LOCAL)
  RENDERING_PENDING = 'Aguardando Renderização',
  RENDERING = 'Renderização FFmpeg Docker',

  // Etapa 7-8: Finalização
  THUMBNAIL_GEN = 'Gerando Thumbnail (IA)',
  METADATA_GEN = 'Gerando Metadados Virais (SEO)',

  // Etapa 9: Publicação
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
  timeRange: string; // e.g. "00:00 - 00:12"
  scriptText: string;
  visualPrompt: string;
  duration: number;
  assets?: {
    imageUrl?: string;
    audioUrl?: string; // Legacy segment audio
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
  referenceScript?: string; // NOVO: Conteúdo transcrito do vídeo modelo
  theme: string;
  status: JobStatus;
  currentStep: PipelineStep;
  progress: number;
  logs: LogEntry[];
  files: MockFile[]; // Track virtual filesystem state
  metadata?: VideoMetadata;
  result?: {
    script: string;
    storyboard: StoryboardSegment[];
    rawPrompts: string[];
    masterAudioUrl?: string; // The full duration synchronized wav
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
  hostVolumePath: string; // Where files are stored on the local machine
  ffmpegContainerImage: string;
  maxConcurrentJobs: number;
  providers: {
    scripting: 'GEMINI' | 'OPENAI' | 'OPENROUTER';
    image: 'GEMINI' | 'FLUX';
    tts: 'GEMINI' | 'ELEVENLABS';
  };
  apiKeys: {
    gemini: string;
    youtube?: string; // Chave Opcional para dados reais
    apify?: string; // Chave para Scraper de Transcrição
    supabaseUrl?: string; // NOVO: URL do projeto Supabase
    supabaseKey?: string; // NOVO: Anon Key do Supabase
    elevenLabs: string;
    flux: string;
    openai: string;
    openrouter: string;
  };
}