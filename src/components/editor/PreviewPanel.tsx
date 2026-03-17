import React, { useState } from 'react';
import {
  Play, Pause, SkipBack, SkipForward, Rewind, FastForward,
  Maximize2, Volume2
} from 'lucide-react';

interface PreviewPanelProps {
  resolution?: { width: number; height: number };
}

export function PreviewPanel({ resolution = { width: 1920, height: 1080 } }: PreviewPanelProps) {
  const [isPlaying, setIsPlaying] = useState(false);
  const aspectRatio = resolution.width / resolution.height;
  const isPortrait = aspectRatio < 1;

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

          {/* Empty State */}
          <div className="flex flex-col items-center gap-2 z-10">
            <Play size={32} className="text-white/15" />
            <span className="text-[11px] text-white/20 font-medium">Preview</span>
          </div>
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
              style={{ width: '0%' }}
            />
            <div
              className="absolute top-1/2 -translate-y-1/2 w-3 h-3 rounded-full bg-primary opacity-0 group-hover:opacity-100 transition-opacity"
              style={{ left: '0%' }}
            />
          </div>
        </div>

        {/* Controls Row */}
        <div className="flex items-center justify-between px-3 py-2">
          {/* Timecode */}
          <span className="font-mono text-[11px] text-theme-muted tabular-nums w-32">
            00:00:00.00 / 00:00:00.00
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
