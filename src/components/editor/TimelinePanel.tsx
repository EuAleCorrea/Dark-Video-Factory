import React, { useState, useRef, useCallback, useEffect } from 'react';
import {
  Scissors, Trash2, ZoomIn, ZoomOut, Lock, Unlock,
  Eye, EyeOff, Film, Mic, Subtitles, Plus, Magnet
} from 'lucide-react';
import { Track, TrackType } from '../../types/editor';

interface TimelinePanelProps {
  tracks?: Track[];
}

const TRACK_ICON: Record<TrackType, React.ElementType> = {
  video: Film,
  audio: Mic,
  subtitle: Subtitles,
  effect: Eye,
};

const TRACK_COLOR: Record<TrackType, string> = {
  video: '#3B82F6',
  audio: '#10B981',
  subtitle: '#F59E0B',
  effect: '#8B5CF6',
};

const DEFAULT_TRACKS: Track[] = [
  { id: 't1', type: 'video', name: 'Vídeo Principal', clips: [], locked: false, visible: true },
  { id: 't2', type: 'audio', name: 'Áudio Principal', clips: [], locked: false, visible: true, volume: 100 },
  { id: 't3', type: 'subtitle', name: 'Legendas', clips: [], locked: false, visible: true },
];

export function TimelinePanel({ tracks = DEFAULT_TRACKS }: TimelinePanelProps) {
  const [zoom, setZoom] = useState(1);
  const [playheadPosition, setPlayheadPosition] = useState(0); // percentage 0-100
  const [snapEnabled, setSnapEnabled] = useState(true);
  const rulerRef = useRef<HTMLDivElement>(null);

  const totalSeconds = 60; // placeholder
  const pixelsPerSecond = 30 * zoom;
  const totalWidth = totalSeconds * pixelsPerSecond;

  // Generate time markers
  const markers: { time: number; label: string }[] = [];
  const interval = zoom >= 2 ? 1 : zoom >= 1 ? 5 : 10;
  for (let t = 0; t <= totalSeconds; t += interval) {
    const mins = Math.floor(t / 60);
    const secs = t % 60;
    markers.push({ time: t, label: `${mins}:${secs.toString().padStart(2, '0')}` });
  }

  const handleRulerClick = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
    if (!rulerRef.current) return;
    const rect = rulerRef.current.getBoundingClientRect();
    const x = e.clientX - rect.left + rulerRef.current.scrollLeft;
    const pct = Math.max(0, Math.min(100, (x / totalWidth) * 100));
    setPlayheadPosition(pct);
  }, [totalWidth]);

  return (
    <div className="flex flex-col h-full">
      {/* Toolbar */}
      <div
        className="flex items-center justify-between px-3 py-1.5 border-b border-theme shrink-0"
        style={{ backgroundColor: 'var(--df-bg-secondary)' }}
      >
        <div className="flex items-center gap-1">
          {[
            { icon: Scissors, title: 'Cortar (C)', disabled: true },
            { icon: Trash2, title: 'Deletar (Del)', disabled: true },
          ].map((btn, i) => (
            <button
              key={i}
              title={btn.title}
              disabled={btn.disabled}
              className="p-1.5 rounded-md text-theme-muted hover:text-theme-primary disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
              onMouseEnter={(e) => { if (!btn.disabled) e.currentTarget.style.backgroundColor = 'var(--df-bg-hover)'; }}
              onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = 'transparent'; }}
            >
              <btn.icon size={14} />
            </button>
          ))}

          <div className="w-px h-5 mx-1" style={{ backgroundColor: 'var(--df-border)' }} />

          <button
            title={snapEnabled ? 'Snap Ativado' : 'Snap Desativado'}
            onClick={() => setSnapEnabled(!snapEnabled)}
            className={`p-1.5 rounded-md transition-colors ${
              snapEnabled ? 'text-primary bg-primary/10' : 'text-theme-muted hover:text-theme-primary'
            }`}
          >
            <Magnet size={14} />
          </button>
        </div>

        <div className="flex items-center gap-1">
          <button
            title="Zoom Out"
            onClick={() => setZoom(z => Math.max(0.25, z - 0.25))}
            className="p-1.5 rounded-md text-theme-muted hover:text-theme-primary transition-colors"
            onMouseEnter={(e) => e.currentTarget.style.backgroundColor = 'var(--df-bg-hover)'}
            onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'transparent'}
          >
            <ZoomOut size={14} />
          </button>
          <span className="text-[10px] text-theme-muted font-mono w-10 text-center tabular-nums">
            {(zoom * 100).toFixed(0)}%
          </span>
          <button
            title="Zoom In"
            onClick={() => setZoom(z => Math.min(4, z + 0.25))}
            className="p-1.5 rounded-md text-theme-muted hover:text-theme-primary transition-colors"
            onMouseEnter={(e) => e.currentTarget.style.backgroundColor = 'var(--df-bg-hover)'}
            onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'transparent'}
          >
            <ZoomIn size={14} />
          </button>
        </div>

        <button
          title="Adicionar Track"
          className="flex items-center gap-1 px-2 py-1 rounded-md text-xs text-primary hover:bg-primary/10 transition-colors"
        >
          <Plus size={12} />
          Track
        </button>
      </div>

      {/* Timeline Content */}
      <div className="flex-1 flex overflow-hidden">
        {/* Track Headers (fixed left) */}
        <div
          className="w-40 shrink-0 border-r border-theme overflow-y-auto custom-scrollbar"
          style={{ backgroundColor: 'var(--df-bg-secondary)' }}
        >
          {/* Ruler spacer */}
          <div className="h-6 border-b border-theme" />

          {tracks.map((track) => {
            const Icon = TRACK_ICON[track.type] || Film;
            const color = TRACK_COLOR[track.type];

            return (
              <div
                key={track.id}
                className="h-12 flex items-center gap-2 px-2 border-b border-theme group"
              >
                <div
                  className="w-1 h-6 rounded-full shrink-0"
                  style={{ backgroundColor: color }}
                />
                <Icon size={13} style={{ color }} className="shrink-0" />
                <span className="text-[11px] text-theme-primary truncate flex-1">
                  {track.name}
                </span>
                <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
                  <button className="p-0.5 rounded text-theme-muted hover:text-theme-primary">
                    {track.locked ? <Lock size={10} /> : <Unlock size={10} />}
                  </button>
                  <button className="p-0.5 rounded text-theme-muted hover:text-theme-primary">
                    {track.visible ? <Eye size={10} /> : <EyeOff size={10} />}
                  </button>
                </div>
              </div>
            );
          })}
        </div>

        {/* Scrollable Timeline Area */}
        <div
          ref={rulerRef}
          className="flex-1 overflow-auto custom-scrollbar relative"
          style={{ backgroundColor: 'var(--df-bg-primary)' }}
        >
          {/* Ruler */}
          <div
            className="h-6 border-b border-theme sticky top-0 z-10 flex items-end"
            style={{
              width: `${totalWidth}px`,
              minWidth: '100%',
              backgroundColor: 'var(--df-bg-secondary)',
            }}
          >
            {markers.map((m) => (
              <div
                key={m.time}
                className="absolute bottom-0 flex flex-col items-center cursor-pointer"
                style={{ left: `${m.time * pixelsPerSecond}px` }}
                onClick={handleRulerClick}
              >
                <span className="text-[9px] text-theme-muted font-mono mb-0.5">{m.label}</span>
                <div className="w-px h-2" style={{ backgroundColor: 'var(--df-border)' }} />
              </div>
            ))}
          </div>

          {/* Track Lanes */}
          <div style={{ width: `${totalWidth}px`, minWidth: '100%' }}>
            {tracks.map((track) => {
              const color = TRACK_COLOR[track.type];

              return (
                <div
                  key={track.id}
                  className="h-12 border-b border-theme relative"
                  style={{ opacity: track.visible ? 1 : 0.4 }}
                >
                  {/* Empty Track Pattern */}
                  <div
                    className="absolute inset-0 opacity-[0.02]"
                    style={{
                      backgroundImage: `repeating-linear-gradient(90deg, ${color} 0px, ${color} 1px, transparent 1px, transparent ${pixelsPerSecond}px)`,
                    }}
                  />
                </div>
              );
            })}
          </div>

          {/* Playhead */}
          <div
            className="absolute top-0 bottom-0 z-20 pointer-events-none"
            style={{ left: `${(playheadPosition / 100) * totalWidth}px` }}
          >
            {/* Playhead Handle */}
            <div className="relative">
              <div
                className="absolute -top-0 left-1/2 -translate-x-1/2 w-3 h-4 rounded-b-sm cursor-pointer pointer-events-auto"
                style={{ backgroundColor: '#EF4444' }}
              />
              <div
                className="absolute top-4 left-1/2 -translate-x-1/2 w-px"
                style={{ backgroundColor: '#EF4444', height: 'calc(100vh)' }}
              />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
