/**
 * Editor Types — Tipos para o editor visual de vídeo (CapCut-like).
 *
 * Estes tipos definem a estrutura de dados do editor: projetos, tracks, clips,
 * transições e preferências. São persistidos como JSONB no Supabase e como
 * JSON no disco local.
 */

// ─── Transition Types ──────────────────────────────────────

export type TransitionType =
  | 'fade'
  | 'crossfade'
  | 'dissolve'
  | 'wipeleft'
  | 'wiperight'
  | 'slideup'
  | 'slidedown';

export interface Transition {
  type: TransitionType;
  duration: number; // em segundos (0.3 a 2.0)
}

// ─── Clip Source Types ─────────────────────────────────────

export interface ImageClipSource {
  type: 'image';
  url: string;       // URL para preview (asset:// ou http)
  path?: string;     // Caminho absoluto no disco
}

export interface VideoClipSource {
  type: 'video';
  url: string;
  path?: string;
}

export interface AudioClipSource {
  type: 'audio';
  url: string;
  path?: string;
  waveform?: number[]; // Dados de waveform extraídos via Web Audio API
}

export interface SubtitleClipSource {
  type: 'subtitle';
  text: string;
  style?: SubtitleClipStyle;
}

export interface SubtitleClipStyle {
  fontName: string;
  fontSize: number;
  primaryColor: string;
  outlineColor: string;
  backgroundColor: string;
  alignment: 'TOP' | 'CENTER' | 'BOTTOM';
}

export type ClipSource =
  | ImageClipSource
  | VideoClipSource
  | AudioClipSource
  | SubtitleClipSource;

// ─── Clip ──────────────────────────────────────────────────

export interface Clip {
  id: string;
  trackId: string;
  startTime: number;      // Posição na timeline (segundos)
  duration: number;       // Duração do clip (segundos)
  sourceStart?: number;   // Ponto de início no arquivo fonte (para trim)
  source: ClipSource;
  transitions?: {
    in?: Transition;
    out?: Transition;
  };
  locked?: boolean;
}

// ─── Track ─────────────────────────────────────────────────

export type TrackType = 'video' | 'audio' | 'subtitle' | 'effect';

export interface Track {
  id: string;
  type: TrackType;
  name: string;
  clips: Clip[];
  locked: boolean;
  visible: boolean;
  volume?: number; // 0-100, apenas para tracks de áudio
}

// ─── Editor Project ────────────────────────────────────────

export interface EditorProject {
  id: string;
  pipelineProjectId?: string; // Link com VideoProject do pipeline Kanban
  name: string;
  resolution: {
    width: number;
    height: number;
  };
  fps: number;
  duration: number;       // Duração total calculada (segundos)
  tracks: Track[];
  metadata?: {
    thumbnailUrl?: string;
    tags?: string[];
    description?: string;
  };
  createdAt: string;      // ISO 8601
  updatedAt: string;      // ISO 8601
}

// ─── User Preferences ──────────────────────────────────────

export type ThemeMode = 'dark' | 'light';

export interface ThemePreference {
  mode: ThemeMode;
}

export interface EditorLayoutPreference {
  panelSizes?: number[];       // Tamanhos dos painéis redimensionáveis
  lastOpenProjectId?: string;  // Último projeto aberto no editor
}

// ─── Factory Functions ─────────────────────────────────────

let _clipCounter = 0;
let _trackCounter = 0;

export function generateId(): string {
  return crypto.randomUUID();
}

export function createEmptyTrack(type: TrackType, name?: string): Track {
  _trackCounter++;
  return {
    id: generateId(),
    type,
    name: name || `${type.charAt(0).toUpperCase() + type.slice(1)} ${_trackCounter}`,
    clips: [],
    locked: false,
    visible: true,
    volume: type === 'audio' ? 100 : undefined,
  };
}

export function createClip(
  trackId: string,
  source: ClipSource,
  startTime: number,
  duration: number
): Clip {
  _clipCounter++;
  return {
    id: generateId(),
    trackId,
    startTime,
    duration,
    source,
    locked: false,
  };
}

export function createEmptyEditorProject(name: string, isShorts = false): EditorProject {
  const now = new Date().toISOString();
  return {
    id: generateId(),
    name,
    resolution: isShorts
      ? { width: 1080, height: 1920 }
      : { width: 1920, height: 1080 },
    fps: 30,
    duration: 0,
    tracks: [
      createEmptyTrack('video', 'Vídeo Principal'),
      createEmptyTrack('audio', 'Áudio Principal'),
      createEmptyTrack('subtitle', 'Legendas'),
    ],
    createdAt: now,
    updatedAt: now,
  };
}
