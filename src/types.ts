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
  structurePromptText: string;
  isActive: boolean;
  createdAt: string;
}

export interface ScriptGenerationSnapshot {
  modelId: string;
  modelProvider: 'GEMINI' | 'OPENAI' | 'OPENROUTER';
  rewritePromptText: string;
  structurePromptText: string;
  promptVersionId: string;
  generatedAt: string;
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
  activePromptId?: string;
  scriptingModel?: string;
  scriptingProvider?: 'GEMINI' | 'OPENAI' | 'OPENROUTER';
}

export interface ReferenceVideo {
  id: string;
  title: string;
  channelName: string;
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
    videoUrl?: string;
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
  scriptingModel?: string;
  scriptingProvider?: 'GEMINI' | 'OPENAI' | 'OPENROUTER';
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

// =============================================
// PIPELINE KANBAN — v3
// =============================================

export enum PipelineStage {
  REFERENCE = 'reference',
  SCRIPT = 'script',
  AUDIO = 'audio',
  AUDIO_COMPRESS = 'audio_compress',
  SUBTITLES = 'subtitles',
  IMAGES = 'images',
  VIDEO = 'video',
  PUBLISH_YT = 'publish_yt',
  THUMBNAIL = 'thumbnail',
  PUBLISH_THUMB = 'publish_thumb',
}

export type ProjectStatus = 'waiting' | 'processing' | 'ready' | 'error' | 'review';

export interface ReferenceStageData {
  videoId: string;
  videoUrl?: string;
  videoTitle: string;
  channelName: string;
  transcript?: string;
  thumbnailUrl?: string;
  stylePrompt?: string;
  // Metadados extras da APIFY
  description?: string;
  viewCount?: number;
  publishedAt?: string;
  duration?: string;
  apifyRawData?: Record<string, unknown>;  // Resposta bruta completa do APIFY
  mode: 'auto' | 'manual';
}

export interface ScriptStageData {
  text: string;
  wordCount: number;
  promptUsed?: string;
  title?: string;
  description?: string;
  thumbText?: string;
  tags?: string[];
  visualPrompts?: string[];
  generationSnapshot?: ScriptGenerationSnapshot;
  mode: 'auto' | 'manual';
}

export interface AudioStageData {
  fileUrl: string;
  duration?: number;
  provider?: string;
  mode: 'auto' | 'manual';
}

export interface AudioCompressStageData {
  fileUrl: string;
  originalSize?: number;
  compressedSize?: number;
  format?: string;
  bitrate?: number;
  duration?: number;
  compressionRatio?: number;
  mode: 'auto' | 'manual';
}

export interface SubtitlesStageData {
  srtContent: string;
  assContent: string;
  segments: StoryboardSegment[];
  segmentCount: number;
  totalDuration: number;
  wordCount?: number;
  mode: 'auto' | 'manual';
}

export interface ImagesStageData {
  images: { url: string; prompt: string; segmentIndex: number }[];
  mode: 'auto' | 'manual';
}

export interface VideoStageData {
  fileUrl: string;
  resolution?: string;
  duration?: number;
  mode: 'auto' | 'manual';
}

export interface PublishYtStageData {
  ytVideoId: string;
  ytUrl: string;
  title?: string;
  description?: string;
  tags?: string[];
  mode: 'auto' | 'manual';
}

export interface ThumbnailStageData {
  imageUrl: string;
  prompt?: string;
  mode: 'auto' | 'manual';
}

export interface PublishThumbStageData {
  done: boolean;
  mode: 'auto' | 'manual';
}

export interface StageDataMap {
  reference?: ReferenceStageData;
  script?: ScriptStageData;
  audio?: AudioStageData;
  audio_compress?: AudioCompressStageData;
  subtitles?: SubtitlesStageData;
  images?: ImagesStageData;
  video?: VideoStageData;
  publish_yt?: PublishYtStageData;
  thumbnail?: ThumbnailStageData;
  publish_thumb?: PublishThumbStageData;
}

export interface VideoProject {
  id: string;
  channelId: string;
  title: string;
  currentStage: PipelineStage;
  status: ProjectStatus;
  stageData: StageDataMap;
  errorMessage?: string;
  createdAt: string;
  updatedAt: string;
}

export const PIPELINE_STAGES_ORDER: PipelineStage[] = [
  PipelineStage.REFERENCE,
  PipelineStage.SCRIPT,
  PipelineStage.AUDIO,
  PipelineStage.AUDIO_COMPRESS,
  PipelineStage.SUBTITLES,
  PipelineStage.IMAGES,
  PipelineStage.VIDEO,
  PipelineStage.PUBLISH_YT,
  PipelineStage.THUMBNAIL,
  PipelineStage.PUBLISH_THUMB,
];

export interface StageMeta {
  label: string;
  shortLabel: string;
  icon: string;
  color: string;
  bgColor: string;
}

export const STAGE_META: Record<PipelineStage, StageMeta> = {
  [PipelineStage.REFERENCE]: { label: 'Referência', shortLabel: 'Ref', icon: 'Search', color: '#6366F1', bgColor: '#EEF2FF' },
  [PipelineStage.SCRIPT]: { label: 'Roteiro', shortLabel: 'Rot', icon: 'FileText', color: '#8B5CF6', bgColor: '#F5F3FF' },
  [PipelineStage.AUDIO]: { label: 'Áudio', shortLabel: 'Áud', icon: 'Mic', color: '#EC4899', bgColor: '#FDF2F8' },
  [PipelineStage.AUDIO_COMPRESS]: { label: 'Compactar', shortLabel: 'Comp', icon: 'Archive', color: '#F59E0B', bgColor: '#FFFBEB' },
  [PipelineStage.SUBTITLES]: { label: 'Legendas', shortLabel: 'Leg', icon: 'Captions', color: '#14B8A6', bgColor: '#F0FDFA' },
  [PipelineStage.IMAGES]: { label: 'Imagens', shortLabel: 'Img', icon: 'Image', color: '#F97316', bgColor: '#FFF7ED' },
  [PipelineStage.VIDEO]: { label: 'Vídeo', shortLabel: 'Víd', icon: 'Film', color: '#EF4444', bgColor: '#FEF2F2' },
  [PipelineStage.PUBLISH_YT]: { label: 'Publicar YT', shortLabel: 'PubYT', icon: 'Youtube', color: '#DC2626', bgColor: '#FEF2F2' },
  [PipelineStage.THUMBNAIL]: { label: 'Thumbnail', shortLabel: 'Thumb', icon: 'ImagePlus', color: '#0EA5E9', bgColor: '#F0F9FF' },
  [PipelineStage.PUBLISH_THUMB]: { label: 'Publicar Thumb', shortLabel: 'PubTh', icon: 'UploadCloud', color: '#10B981', bgColor: '#ECFDF5' },
};

// =============================================
// ELEVEN LABS TYPES
// =============================================

export interface ElevenLabsVoice {
  voice_id: string;
  name: string;
  samples: { sample_id: string; file_url: string }[];
  category: string;
  labels: Record<string, string>;
  preview_url: string;
  settings?: ElevenLabsSettings;
}

export interface ElevenLabsSettings {
  stability: number;
  similarity_boost: number;
  style?: number;
  use_speaker_boost?: boolean;
}

export interface ElevenLabsModel {
  model_id: string;
  name: string;
  description: string;
  languages: { language_id: string; name: string }[];
}

export interface ElevenLabsUser {
  subscription: {
    tier: string;
    character_count: number;
    character_limit: number;
    next_character_count_reset_unix: number;
  };
  is_onboarding_completed: boolean;
}