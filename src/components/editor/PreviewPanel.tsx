import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  Play, Pause, SkipBack, SkipForward, Rewind, FastForward,
  Maximize2, Volume2
} from 'lucide-react';
import { EditorProject } from '../../types/editor';
import { TimelineEngineService } from '../../services/TimelineEngineService';
import { convertFileSrc } from '@tauri-apps/api/core';

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
  const [volume, setVolume] = useState(0.75);
  const [isMuted, setIsMuted] = useState(false);
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
  const videoRef = useRef<HTMLVideoElement>(null);
  const requestRef = useRef<number>(0);
  const lastTimeRef = useRef<number>(0);

  // --- Playback Engine ---
  // Strategy: When playing, the VIDEO element is the clock source.
  // The animation loop reads videoRef.currentTime and pushes it to the timeline.
  // This avoids constant seeking which causes stutter.
  // When paused, the timeline drives the video (for scrubbing).

  const isPlayingRef = useRef(false);

  const animate = useCallback(() => {
    if (!isPlayingRef.current || !onTimeChange) return;

    // If we have a video, use its time as the source of truth
    if (videoRef.current && activeVideoClip && activeVideoClip.source.type === 'video') {
      const videoCurrentTime = videoRef.current.currentTime;
      const timelineTime = activeVideoClip.startTime + videoCurrentTime - (activeVideoClip.sourceStart || 0);

      if (timelineTime >= totalDuration) {
        setIsPlaying(false);
        isPlayingRef.current = false;
        onTimeChange(() => 0);
        return;
      }
      onTimeChange(() => timelineTime);
    } else {
      // No video — use performance.now delta (for audio-only or image clips)
      if (lastTimeRef.current !== 0) {
        const now = performance.now();
        const deltaTime = (now - lastTimeRef.current) / 1000;
        lastTimeRef.current = now;
        onTimeChange(prev => {
          const nextTime = prev + deltaTime;
          if (nextTime >= totalDuration) {
            setIsPlaying(false);
            isPlayingRef.current = false;
            return 0;
          }
          return nextTime;
        });
      } else {
        lastTimeRef.current = performance.now();
      }
    }

    requestRef.current = requestAnimationFrame(animate);
  }, [onTimeChange, totalDuration, activeVideoClip]);

  // Sync volume to media elements
  useEffect(() => {
    const effectiveVolume = isMuted ? 0 : volume;
    if (videoRef.current) videoRef.current.volume = effectiveVolume;
    if (audioRef.current) audioRef.current.volume = effectiveVolume;
  }, [volume, isMuted]);

  // Handle play/pause toggle — called directly from user click
  const togglePlayback = useCallback(() => {
    const newIsPlaying = !isPlaying;
    setIsPlaying(newIsPlaying);
    isPlayingRef.current = newIsPlaying;

    if (newIsPlaying) {
      lastTimeRef.current = 0;

      // Seek video to correct position before playing
      if (videoRef.current && activeVideoClip && activeVideoClip.source.type === 'video') {
        const videoTime = currentTime - activeVideoClip.startTime + (activeVideoClip.sourceStart || 0);
        videoRef.current.currentTime = Math.max(0, videoTime);
        videoRef.current.volume = isMuted ? 0 : volume;
        videoRef.current.play().catch(console.error);
      }
      if (audioRef.current) {
        audioRef.current.volume = isMuted ? 0 : volume;
        audioRef.current.play().catch(console.error);
      }

      // Start animation loop
      requestRef.current = requestAnimationFrame(animate);
    } else {
      cancelAnimationFrame(requestRef.current);
      lastTimeRef.current = 0;
      if (videoRef.current) videoRef.current.pause();
      if (audioRef.current) audioRef.current.pause();
    }
  }, [isPlaying, animate, volume, isMuted, currentTime, activeVideoClip]);

  // Keep animation loop alive when deps change during playback
  useEffect(() => {
    if (isPlaying) {
      cancelAnimationFrame(requestRef.current);
      requestRef.current = requestAnimationFrame(animate);
    }
    return () => cancelAnimationFrame(requestRef.current);
  }, [isPlaying, animate]);

  // Sync video time when scrubbing (paused only)
  useEffect(() => {
    if (!isPlaying && activeVideoClip && videoRef.current && activeVideoClip.source.type === 'video') {
      const videoTime = currentTime - activeVideoClip.startTime + (activeVideoClip.sourceStart || 0);
      videoRef.current.currentTime = Math.max(0, videoTime);
    }
  }, [currentTime, activeVideoClip, isPlaying]);

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
          {activeVideoClip?.source && activeVideoClip.source.type === 'video' && (activeVideoClip.source.url || activeVideoClip.source.path) ? (
            <video
              ref={videoRef}
              src={convertFileSrc(activeVideoClip.source.path || activeVideoClip.source.url || '')}
              className="absolute inset-0 w-full h-full object-contain"
              playsInline
            />
          ) : activeVideoClip?.source && activeVideoClip.source.type === 'image' && (activeVideoClip.source.url || activeVideoClip.source.path) ? (
            <img 
              src={convertFileSrc(activeVideoClip.source.path || activeVideoClip.source.url || '')} 
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
          {activeAudioClip?.source.type === 'audio' && (activeAudioClip.source.url || activeAudioClip.source.path) && (
            <audio 
              ref={audioRef}
              src={convertFileSrc(activeAudioClip.source.path || activeAudioClip.source.url || '')} 
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
                  if (btn.primary) togglePlayback();
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
            <button
              onClick={() => setIsMuted(!isMuted)}
              className="p-0.5 rounded text-theme-muted hover:text-theme-primary transition-colors"
              title={isMuted ? 'Ativar som' : 'Mutar'}
            >
              <Volume2 size={14} className={isMuted ? 'text-red-400' : ''} />
            </button>
            <div
              className="w-16 h-1.5 rounded-full cursor-pointer relative group"
              style={{ backgroundColor: 'var(--df-border)' }}
              onClick={(e) => {
                const rect = e.currentTarget.getBoundingClientRect();
                const x = e.clientX - rect.left;
                const newVol = Math.max(0, Math.min(1, x / rect.width));
                setVolume(newVol);
                setIsMuted(false);
              }}
            >
              <div 
                className="h-full rounded-full transition-all"
                style={{ 
                  width: `${(isMuted ? 0 : volume) * 100}%`,
                  backgroundColor: isMuted ? 'var(--df-text-muted)' : 'var(--df-primary)'
                }}
              />
              <div 
                className="absolute top-1/2 -translate-y-1/2 w-2.5 h-2.5 rounded-full bg-white shadow opacity-0 group-hover:opacity-100 transition-opacity"
                style={{ left: `${(isMuted ? 0 : volume) * 100}%`, transform: 'translate(-50%, -50%)' }}
              />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
