import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  Play, Pause, SkipBack, SkipForward, Rewind, FastForward,
  Maximize2, Volume2
} from 'lucide-react';
import { EditorProject } from '../../types/editor';
import { TimelineEngineService } from '../../services/TimelineEngineService';

interface PreviewPanelProps {
  resolution?: { width: number; height: number };
  project?: EditorProject;
  currentTime?: number;
  onTimeChange?: React.Dispatch<React.SetStateAction<number>>;
}

export function PreviewPanel({ 
  resolution = { width: 1920, height: 1080 },
  project,
  currentTime = 0,
  onTimeChange
}: PreviewPanelProps) {
  const [isPlaying, setIsPlaying] = useState(false);
  const aspectRatio = resolution.width / resolution.height;
  const isPortrait = aspectRatio < 1;

  // Calcula a duração baseada nos clips
  const totalDuration = project ? Math.max(TimelineEngineService.getTimelineDuration(project.tracks), 1) : 60;

  // Busca clips ativos
  const activeVideoClip = project?.tracks
    .find(t => t.type === 'video' && t.visible)?.clips
    .find(c => currentTime >= c.startTime && currentTime < c.startTime + c.duration);

  const activeSubtitleClip = project?.tracks
    .find(t => t.type === 'subtitle' && t.visible)?.clips
    .find(c => currentTime >= c.startTime && currentTime < c.startTime + c.duration);

  const activeAudioClip = project?.tracks
    .find(t => t.type === 'audio' && t.visible)?.clips
    .find(c => currentTime >= c.startTime && currentTime < c.startTime + c.duration);

  const audioRef = useRef<HTMLAudioElement>(null);
  const requestRef = useRef<number>(0);
  const lastTimeRef = useRef<number>(0);

  const animate = useCallback((time: number) => {
    if (lastTimeRef.current !== 0 && onTimeChange) {
      const deltaTime = (time - lastTimeRef.current) / 1000;
      onTimeChange(prev => {
        const nextTime = prev + deltaTime;
        if (nextTime >= totalDuration) {
          setIsPlaying(false);
          return 0; // Rewinds to start or handle end
        }
        return nextTime;
      });
    }
    lastTimeRef.current = time;
    if (isPlaying) {
      requestRef.current = requestAnimationFrame(animate);
    }
  }, [onTimeChange, totalDuration, isPlaying]);

  useEffect(() => {
    if (isPlaying) {
      lastTimeRef.current = performance.now();
      requestRef.current = requestAnimationFrame(animate);
      if (audioRef.current) {
        audioRef.current.play().catch(console.error);
      }
    } else {
      cancelAnimationFrame(requestRef.current);
      lastTimeRef.current = 0;
      if (audioRef.current) {
        audioRef.current.pause();
      }
    }
    return () => cancelAnimationFrame(requestRef.current);
  }, [isPlaying, animate]);

  // Sincroniza o audio time com o currentTime do projeto
  useEffect(() => {
    if (activeAudioClip && audioRef.current) {
      const audioTime = currentTime - activeAudioClip.startTime + (activeAudioClip.sourceStart || 0);
      const diff = Math.abs(audioRef.current.currentTime - audioTime);
      // Evita setar o time a todo frame, apenas se desviar muito
      if (diff > 0.2 || (!isPlaying && diff > 0.05)) {
        audioRef.current.currentTime = audioTime;
      }
    }
  }, [currentTime, activeAudioClip, isPlaying]);

  // Formata HH:MM:SS.FF
  const formatTimecode = (seconds: number) => {
    const h = Math.floor(seconds / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    const s = Math.floor(seconds % 60);
    const f = Math.floor((seconds % 1) * 30);
    return `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}.${f.toString().padStart(2, '0')}`;
  };

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div
        className="flex items-center justify-between px-3 py-2.5 border-b border-theme shrink-0"
        style={{ backgroundColor: 'var(--df-bg-secondary)' }}
      >
        <span className="text-sm font-semibold text-theme-primary">Preview</span>
        <div className="flex items-center gap-2">
          <span className="text-[10px] text-theme-muted px-2 py-0.5 rounded" style={{ backgroundColor: 'var(--df-bg-hover)' }}>
            {resolution.width}×{resolution.height}
          </span>
          <button
            className="p-1 rounded text-theme-muted hover:text-theme-primary transition-colors"
            onMouseEnter={(e) => e.currentTarget.style.backgroundColor = 'var(--df-bg-hover)'}
            onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'transparent'}
          >
            <Maximize2 size={14} />
          </button>
        </div>
      </div>

      {/* Canvas Area */}
      <div className="flex-1 flex items-center justify-center p-4 overflow-hidden" style={{ backgroundColor: '#0A0A0A' }}>
        <div
          className="relative rounded-sm overflow-hidden flex items-center justify-center"
          style={{
            aspectRatio: `${resolution.width} / ${resolution.height}`,
            maxWidth: isPortrait ? '40%' : '100%',
            maxHeight: '100%',
            width: isPortrait ? 'auto' : '100%',
            height: isPortrait ? '100%' : 'auto',
            backgroundColor: '#000000',
            border: '1px solid rgba(255,255,255,0.06)',
          }}
        >
          {/* Placeholder Grid */}
          <div className="absolute inset-0 opacity-[0.03]" style={{
            backgroundImage: 'linear-gradient(rgba(255,255,255,0.5) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.5) 1px, transparent 1px)',
            backgroundSize: '40px 40px',
          }} />

          {/* Center Crosshair */}
          <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
            <div className="w-6 h-px bg-white/10" />
            <div className="absolute h-6 w-px bg-white/10" />
          </div>

          {/* Main Visual Asset (Video/Image) */}
          {activeVideoClip?.source && (activeVideoClip.source.type === 'video' || activeVideoClip.source.type === 'image') && activeVideoClip.source.url ? (
            <img 
              src={activeVideoClip.source.url} 
              alt="Scene preview" 
              className="absolute inset-0 w-full h-full object-contain"
            />
          ) : (
            /* Empty State */
            <div className="flex flex-col items-center gap-2 z-10">
              <Play size={32} className="text-white/15" />
              <span className="text-[11px] text-white/20 font-medium">Sem mídia neste tempo</span>
            </div>
          )}

          {/* Audio Element Hidden */}
          {activeAudioClip?.source.type === 'audio' && activeAudioClip.source.url && (
            <audio 
              ref={audioRef}
              src={activeAudioClip.source.url} 
              className="hidden"
            />
          )}

          {/* Subtitles Overlay */}
          {activeSubtitleClip?.source.type === 'subtitle' && (
            <div className="absolute inset-x-0 bottom-[10%] flex justify-center pointer-events-none z-20">
              <span 
                className="text-center px-4 py-1"
                style={{
                  fontFamily: activeSubtitleClip.source.style?.fontName || 'sans-serif',
                  fontSize: `${(activeSubtitleClip.source.style?.fontSize || 36)}px`,
                  color: activeSubtitleClip.source.style?.primaryColor || 'white',
                  WebkitTextStroke: activeSubtitleClip.source.style?.outlineColor ? `2px ${activeSubtitleClip.source.style?.outlineColor}` : '2px black',
                  backgroundColor: activeSubtitleClip.source.style?.backgroundColor || 'transparent',
                  textShadow: '0px 2px 4px rgba(0,0,0,0.8)',
                  fontWeight: '900',
                  lineHeight: '1.2'
                }}
              >
                {activeSubtitleClip.source.text}
              </span>
            </div>
          )}
        </div>
      </div>

      {/* Transport Controls */}
      <div className="border-t border-theme shrink-0" style={{ backgroundColor: 'var(--df-bg-secondary)' }}>
        {/* Progress Bar */}
        <div className="px-3 pt-2">
          <div
            className="w-full h-1 rounded-full cursor-pointer group relative"
            style={{ backgroundColor: 'var(--df-border)' }}
          >
            <div
              className="h-full rounded-full bg-primary transition-all"
              style={{ width: `${Math.min(100, (currentTime / totalDuration) * 100)}%` }}
            />
            <div
              className="absolute top-1/2 -translate-y-1/2 w-3 h-3 rounded-full bg-primary opacity-0 group-hover:opacity-100 transition-opacity"
              style={{ left: `${Math.min(100, (currentTime / totalDuration) * 100)}%` }}
            />
          </div>
        </div>

        {/* Controls Row */}
        <div className="flex items-center justify-between px-3 py-2">
          {/* Timecode */}
          <span className="font-mono text-[11px] text-theme-muted tabular-nums w-32">
            {formatTimecode(currentTime)} / {formatTimecode(totalDuration)}
          </span>

          {/* Playback Buttons */}
          <div className="flex items-center gap-1">
            {[
              { icon: SkipBack, title: 'Início', size: 14 },
              { icon: Rewind, title: 'Retroceder', size: 14 },
              {
                icon: isPlaying ? Pause : Play,
                title: isPlaying ? 'Pausar' : 'Reproduzir',
                size: 18,
                primary: true,
              },
              { icon: FastForward, title: 'Avançar', size: 14 },
              { icon: SkipForward, title: 'Fim', size: 14 },
            ].map((btn, i) => (
              <button
                key={i}
                title={btn.title}
                onClick={() => {
                  if (btn.primary) setIsPlaying(!isPlaying);
                }}
                className={`p-1.5 rounded-lg transition-all ${
                  btn.primary
                    ? 'bg-primary text-white hover:bg-primary-hover'
                    : 'text-theme-muted hover:text-theme-primary'
                }`}
                onMouseEnter={(e) => {
                  if (!btn.primary) e.currentTarget.style.backgroundColor = 'var(--df-bg-hover)';
                }}
                onMouseLeave={(e) => {
                  if (!btn.primary) e.currentTarget.style.backgroundColor = 'transparent';
                }}
              >
                <btn.icon size={btn.size} />
              </button>
            ))}
          </div>

          {/* Volume */}
          <div className="flex items-center gap-2 w-32 justify-end">
            <Volume2 size={14} className="text-theme-muted shrink-0" />
            <div
              className="w-16 h-1 rounded-full"
              style={{ backgroundColor: 'var(--df-border)' }}
            >
              <div className="h-full w-3/4 rounded-full bg-theme-muted" />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
