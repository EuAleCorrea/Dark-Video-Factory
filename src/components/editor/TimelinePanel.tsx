import React, { useState, useRef, useCallback, useEffect } from 'react';
import {
  Scissors, Trash2, ZoomIn, ZoomOut, Lock, Unlock,
  Eye, EyeOff, Film, Mic, Subtitles, Plus, Magnet
} from 'lucide-react';
import { Track, TrackType, createClip } from '../../types/editor';
import { TimelineEngineService } from '../../services/TimelineEngineService';

interface TimelinePanelProps {
  tracks?: Track[];
  onUpdateTracks?: (tracks: Track[]) => void;
  currentTime?: number;
  onTimeChange?: (time: number) => void;
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

export function TimelinePanel({ tracks = DEFAULT_TRACKS, onUpdateTracks, currentTime = 0, onTimeChange }: TimelinePanelProps) {
  const [zoom, setZoom] = useState(1);
  const [snapEnabled, setSnapEnabled] = useState(true);
  const rulerRef = useRef<HTMLDivElement>(null);

  // Dragging state
  const [draggingClip, setDraggingClip] = useState<{
    id: string;
    trackId: string;
    initialStartTime: number;
    startX: number;
    currentStartTime: number;
  } | null>(null);

  // Resizing state
  const [resizingClip, setResizingClip] = useState<{
    id: string;
    trackId: string;
    type: 'left' | 'right';
    initialStartTime: number;
    initialDuration: number;
    initialSourceStart: number;
    startX: number;
    currentStartTime: number;
    currentDuration: number;
  } | null>(null);

  // Selected state
  const [selectedClipId, setSelectedClipId] = useState<string | null>(null);

  // Drag over state for visual feedback
  const [dragOverTrackId, setDragOverTrackId] = useState<string | null>(null);

  // Context Menu state
  const [contextMenu, setContextMenu] = useState<{ x: number, y: number, clipId: string } | null>(null);

  // Fecha o menu de contexto ao clicar em qualquer outro lugar
  useEffect(() => {
    const handleClick = () => setContextMenu(null);
    window.addEventListener('click', handleClick);
    return () => window.removeEventListener('click', handleClick);
  }, []);

  const maxClipEnd = TimelineEngineService.getTimelineDuration(tracks);
  const totalSeconds = Math.max(600, maxClipEnd + 60); 
  const pixelsPerSecond = 30 * zoom;
  const totalWidth = totalSeconds * pixelsPerSecond;

  // Global resize handler
  useEffect(() => {
    if (!resizingClip) return;

    const handleMouseMove = (e: MouseEvent) => {
      const deltaX = e.clientX - resizingClip.startX;
      const moveSeconds = deltaX / pixelsPerSecond;
      
      let newStartTime = resizingClip.initialStartTime;
      let newDuration = resizingClip.initialDuration;
      let newSourceStart = resizingClip.initialSourceStart;

      if (resizingClip.type === 'left') {
        newStartTime += moveSeconds;
        newDuration -= moveSeconds;
        newSourceStart += moveSeconds; // Trim from beginning means sourceStart shifts
        // Prevent negative duration and negative start
        if (newDuration < 0.1) {
          const over = 0.1 - newDuration;
          newDuration = 0.1;
          newStartTime -= over;
          newSourceStart -= over;
        }
        if (newStartTime < 0) {
          const over = 0 - newStartTime;
          newStartTime = 0;
          newDuration -= over;
          newSourceStart -= over;
        }
      } else {
        newDuration += moveSeconds;
        if (newDuration < 0.1) newDuration = 0.1;
      }
      
      // Simple snap logic for resize
      if (snapEnabled) {
        if (resizingClip.type === 'left') {
           const snappedStart = TimelineEngineService.snapToGrid(tracks, newStartTime, 0.5, [resizingClip.id]);
           if (snappedStart !== newStartTime) {
              const diff = snappedStart - newStartTime;
              newStartTime = snappedStart;
              newDuration -= diff;
              newSourceStart += diff;
           }
        } else {
           const end = newStartTime + newDuration;
           const snappedEnd = TimelineEngineService.snapToGrid(tracks, end, 0.5, [resizingClip.id]);
           if (snappedEnd !== end) {
              newDuration = snappedEnd - newStartTime;
           }
        }
      }

      setResizingClip(prev => prev ? { 
        ...prev, 
        currentStartTime: newStartTime, 
        currentDuration: newDuration,
      } : null);
    };

    const handleMouseUp = () => {
      if (resizingClip && onUpdateTracks) {
        let finalSourceStart = resizingClip.initialSourceStart;
        if (resizingClip.type === 'left') {
          const diff = resizingClip.currentStartTime - resizingClip.initialStartTime;
          finalSourceStart += diff;
        }

        const newTracks = TimelineEngineService.resizeClip(
          tracks,
          resizingClip.id,
          resizingClip.currentStartTime,
          resizingClip.currentDuration,
          Math.max(0, finalSourceStart)
        );
        onUpdateTracks(newTracks);
      }
      setResizingClip(null);
    };

    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);
    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };
  }, [resizingClip, tracks, snapEnabled, pixelsPerSecond, onUpdateTracks]);

  // Global drag handler
  useEffect(() => {
    if (!draggingClip) return;

    const handleMouseMove = (e: MouseEvent) => {
      const deltaX = e.clientX - draggingClip.startX;
      const moveSeconds = deltaX / pixelsPerSecond;
      let newTime = draggingClip.initialStartTime + moveSeconds;
      
      if (newTime < 0) newTime = 0;

      if (snapEnabled) {
        newTime = TimelineEngineService.snapToGrid(tracks, newTime, 0.5, [draggingClip.id]);
      }

      setDraggingClip(prev => prev ? { ...prev, currentStartTime: newTime } : null);
    };

    const handleMouseUp = () => {
      if (draggingClip && onUpdateTracks) {
        const newTracks = TimelineEngineService.moveClip(
          tracks,
          draggingClip.id,
          draggingClip.trackId,
          draggingClip.currentStartTime
        );
        onUpdateTracks(newTracks);
      }
      setDraggingClip(null);
    };

    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);
    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };
  }, [draggingClip, tracks, snapEnabled, pixelsPerSecond, onUpdateTracks]);

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
    let newTime = x / pixelsPerSecond;
    if (newTime < 0) newTime = 0;
    if (snapEnabled) {
      newTime = TimelineEngineService.snapToGrid(tracks, newTime, 0.5);
    }
    if (onTimeChange) onTimeChange(newTime);
  }, [pixelsPerSecond, onTimeChange, snapEnabled, tracks]);

  const handleSplit = useCallback(() => {
    if (!selectedClipId || !onUpdateTracks) return;
    const posInSeconds = currentTime;
    const newTracks = TimelineEngineService.splitClip(tracks, selectedClipId, posInSeconds);
    onUpdateTracks(newTracks);
  }, [selectedClipId, onUpdateTracks, currentTime, tracks]);

  const handleDelete = useCallback(() => {
    if (!selectedClipId || !onUpdateTracks) return;
    const newTracks = TimelineEngineService.removeClip(tracks, selectedClipId);
    onUpdateTracks(newTracks);
    setSelectedClipId(null);
  }, [selectedClipId, onUpdateTracks, tracks]);

  return (
    <div className="flex flex-col h-full">
      {/* Toolbar */}
      <div
        className="flex items-center justify-between px-3 py-1.5 border-b border-theme shrink-0"
        style={{ backgroundColor: 'var(--df-bg-secondary)' }}
      >
        <div className="flex items-center gap-1">
          {[
            { icon: Scissors, title: 'Cortar (C)', disabled: !selectedClipId, onClick: handleSplit },
            { icon: Trash2, title: 'Deletar (Del)', disabled: !selectedClipId, onClick: handleDelete },
          ].map((btn, i) => (
            <button
              key={i}
              title={btn.title}
              disabled={btn.disabled}
              onClick={btn.onClick}
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
      <div 
        className="flex-1 flex overflow-hidden"
        onDragOver={(e) => {
          e.preventDefault();
        }}
      >
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
          onClick={() => setSelectedClipId(null)}
          onDragOver={(e) => {
            e.preventDefault();
            e.stopPropagation();
          }}
          onDrop={(e) => {
            e.preventDefault();
          }}
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
                onClick={(e) => {
                  e.stopPropagation();
                  handleRulerClick(e);
                }}
              >
                <span className="text-[9px] text-theme-muted font-mono mb-0.5">{m.label}</span>
                <div className="w-px h-2" style={{ backgroundColor: 'var(--df-border)' }} />
              </div>
            ))}
          </div>

          {/* Track Lanes */}
          <div 
            style={{ width: `${totalWidth}px`, minWidth: '100%' }}
            onDragOver={(e) => {
              e.preventDefault();
              e.stopPropagation();
            }}
          >
            {tracks.map((track) => {
              const color = TRACK_COLOR[track.type];

              return (
                <div
                  key={track.id}
                  className="h-12 border-b border-theme relative"
                  onDragOver={(e) => {
                    e.preventDefault();
                    e.dataTransfer.dropEffect = 'copy';
                    setDragOverTrackId(track.id);
                  }}
                  onDragLeave={() => setDragOverTrackId(null)}
                  onDrop={(e) => {
                    e.preventDefault();
                    setDragOverTrackId(null);
                    try {
                      const dataStr = e.dataTransfer.getData('application/json');
                      if (!dataStr) return;
                      const data = JSON.parse(dataStr);
                      if (data.type === 'media' && onUpdateTracks) {
                        const rect = e.currentTarget.getBoundingClientRect();
                        const x = e.clientX - rect.left + (rulerRef.current?.scrollLeft || 0);
                        let dropTime = x / pixelsPerSecond;
                        
                        if (snapEnabled) {
                          dropTime = TimelineEngineService.snapToGrid(tracks, dropTime, 0.5);
                        }

                        // Validate track compatibility
                        const isCompatible = (track.type === 'video' && (data.item.type === 'video' || data.item.type === 'image')) ||
                                           (track.type === 'audio' && data.item.type === 'audio') ||
                                           (track.type === 'subtitle' && data.item.type === 'subtitle');
                        
                        // If not compatible, try to find a compatible track
                        let targetTrackId = track.id;
                        if (!isCompatible) {
                           const altTrack = tracks.find(t => 
                            (t.type === 'video' && (data.item.type === 'video' || data.item.type === 'image')) ||
                            (t.type === 'audio' && data.item.type === 'audio') ||
                            (t.type === 'subtitle' && data.item.type === 'subtitle')
                           );
                           if (altTrack) {
                             targetTrackId = altTrack.id;
                           } else {
                             console.warn("Nenhuma track compatível encontrada para:", data.item.type);
                             return;
                           }
                        }

                        // Prepare source object
                        let source: any = {
                          type: data.item.type,
                          url: data.item.src || '',
                          path: data.item.src || ''
                        };

                        if (data.item.type === 'subtitle') {
                          source = {
                            type: 'subtitle',
                            text: data.item.name || 'Nova Legenda',
                          };
                        }

                        const newClip = createClip(
                          targetTrackId,
                          source,
                          Math.max(0, dropTime),
                          data.item.duration || 5
                        );

                        const newTracks = TimelineEngineService.addClip(tracks, newClip);
                        onUpdateTracks(newTracks);
                      }
                    } catch (err) {
                      console.error("Failed to parse drop data", err);
                    }
                  }}
                  style={{ 
                    opacity: track.visible ? 1 : 0.4,
                    backgroundColor: dragOverTrackId === track.id ? `${color}15` : 'transparent',
                    transition: 'background-color 0.1s ease'
                  }}
                >
                  {/* Empty Track Pattern */}
                  <div
                    className="absolute inset-0 opacity-[0.02]"
                    style={{
                      backgroundImage: `repeating-linear-gradient(90deg, ${color} 0px, ${color} 1px, transparent 1px, transparent ${pixelsPerSecond}px)`,
                    }}
                  />

                  {/* Clips */}
                  {track.clips.map((clip) => {
                    const isDraggingThis = draggingClip?.id === clip.id;
                    const isResizingThis = resizingClip?.id === clip.id;

                    const renderTime = isDraggingThis ? draggingClip.currentStartTime : 
                                       isResizingThis ? resizingClip.currentStartTime : clip.startTime;
                    
                    const renderDuration = isResizingThis ? resizingClip.currentDuration : clip.duration;

                    const left = renderTime * pixelsPerSecond;
                    const width = Math.max(renderDuration * pixelsPerSecond, 2); // Pelo menos 2px
                    const isSelected = selectedClipId === clip.id;
                    
                    return (
                      <div
                        key={clip.id}
                        onContextMenu={(e) => {
                          e.preventDefault();
                          e.stopPropagation();
                          setSelectedClipId(clip.id);
                          setContextMenu({
                            x: e.clientX,
                            y: e.clientY,
                            clipId: clip.id,
                          });
                        }}
                        onMouseDown={(e) => {
                          e.stopPropagation();
                          setSelectedClipId(clip.id);
                          setDraggingClip({
                            id: clip.id,
                            trackId: track.id,
                            initialStartTime: clip.startTime,
                            startX: e.clientX,
                            currentStartTime: clip.startTime,
                          });
                        }}
                        className={`absolute top-1 bottom-1 rounded border overflow-hidden shadow-sm flex items-center px-2 cursor-pointer transition-all hover:brightness-110 
                          ${isDraggingThis || isResizingThis ? 'z-30 opacity-80' : 'z-10'} 
                          ${isSelected ? 'ring-2 ring-primary border-primary' : ''}`}
                        style={{
                          left: `${left}px`,
                          width: `${width}px`,
                          backgroundColor: `${color}20`, // Fundo semi-transparente
                          borderColor: isSelected ? 'var(--df-bg-primary)' : color,
                        }}
                      >
                        {/* Puxador Esquerdo (Trim) */}
                        <div 
                          className="absolute left-0 top-0 bottom-0 w-2 cursor-col-resize hover:bg-black/10 z-10" 
                          onMouseDown={(e) => {
                            e.stopPropagation();
                            setSelectedClipId(clip.id);
                            setResizingClip({
                              id: clip.id,
                              trackId: track.id,
                              type: 'left',
                              initialStartTime: clip.startTime,
                              initialDuration: clip.duration,
                              initialSourceStart: clip.sourceStart || 0,
                              startX: e.clientX,
                              currentStartTime: clip.startTime,
                              currentDuration: clip.duration,
                            });
                          }}
                        />
                        
                        <div className="flex-1 truncate pointer-events-none">
                          <span className="text-[10px] sm:text-xs font-medium truncate" style={{ color: color }}>
                            {clip.source.type === 'video' ? 'Vídeo'
                             : clip.source.type === 'image' ? 'Imagem'
                             : clip.source.type === 'audio' ? 'Áudio'
                             : 'Legenda'}
                          </span>
                        </div>

                        {/* Puxador Direito (Trim) */}
                        <div 
                          className="absolute right-0 top-0 bottom-0 w-2 cursor-col-resize hover:bg-black/10 z-10" 
                          onMouseDown={(e) => {
                            e.stopPropagation();
                            setSelectedClipId(clip.id);
                            setResizingClip({
                              id: clip.id,
                              trackId: track.id,
                              type: 'right',
                              initialStartTime: clip.startTime,
                              initialDuration: clip.duration,
                              initialSourceStart: clip.sourceStart || 0,
                              startX: e.clientX,
                              currentStartTime: clip.startTime,
                              currentDuration: clip.duration,
                            });
                          }}
                        />
                      </div>
                    );
                  })}
                </div>
              );
            })}
          </div>

          {/* Playhead */}
          <div
            className="absolute top-0 bottom-0 z-20 pointer-events-none"
            style={{ left: `${currentTime * pixelsPerSecond}px` }}
          >
            {/* Playhead Handle */}
            <div className="relative">
              <div
                className="absolute -top-0 left-1/2 -translate-x-1/2 w-3 h-4 rounded-b-sm cursor-pointer pointer-events-auto hover:brightness-110 active:brightness-90"
                style={{ backgroundColor: '#EF4444' }}
                onMouseDown={(e) => {
                  e.stopPropagation();
                  // A simple manual drag implementation for the playhead handle (optional to make it draggable without ruler click)
                  const startX = e.clientX;
                  const startTime = currentTime;
                  
                  const onMove = (moveEvent: MouseEvent) => {
                    const deltaX = moveEvent.clientX - startX;
                    const deltaSeconds = deltaX / pixelsPerSecond;
                    let newTime = Math.max(0, startTime + deltaSeconds);
                    if (snapEnabled) {
                      newTime = TimelineEngineService.snapToGrid(tracks, newTime, 0.5);
                    }
                    if (onTimeChange) onTimeChange(newTime);
                  };

                  const onUp = () => {
                    window.removeEventListener('mousemove', onMove);
                    window.removeEventListener('mouseup', onUp);
                  };

                  window.addEventListener('mousemove', onMove);
                  window.addEventListener('mouseup', onUp);
                }}
              />
              <div
                className="absolute top-4 left-1/2 -translate-x-1/2 w-px"
                style={{ backgroundColor: '#EF4444', height: 'calc(100vh)' }}
              />
            </div>
          </div>
        </div>
      </div>

      {/* Context Menu (Right Click) */}
      {contextMenu && (
        <div 
          className="fixed z-50 border border-theme rounded shadow-lg overflow-hidden flex flex-col min-w-32"
          style={{ top: contextMenu.y, left: contextMenu.x, backgroundColor: 'var(--df-bg-secondary)' }}
          onContextMenu={(e) => e.preventDefault()}
        >
          <button 
            className="flex items-center gap-2 px-3 py-2 text-xs text-red-500 hover:bg-red-500/10 transition-colors w-full text-left"
            onClick={(e) => {
              e.stopPropagation();
              if (onUpdateTracks) {
                const newTracks = TimelineEngineService.removeClip(tracks, contextMenu.clipId);
                onUpdateTracks(newTracks);
                if (selectedClipId === contextMenu.clipId) {
                  setSelectedClipId(null);
                }
              }
              setContextMenu(null);
            }}
          >
            <Trash2 size={12} />
            <span>Excluir Clip</span>
          </button>
        </div>
      )}
    </div>
  );
}
