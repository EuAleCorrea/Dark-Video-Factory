import React, { DragEvent, useState, useEffect, useCallback } from 'react';
import { 
  Plus, 
  Video, 
  Search, 
  LayoutGrid, 
  ArrowUpDown, 
  Filter, 
  Sparkles,
  Film,
  Music,
  Image as ImageIcon,
  Type,
  Trash2,
  PlusCircle
} from 'lucide-react';
import { EditorProject, createClip } from '../../types/editor';
import { MediaLibraryService } from '../../services/MediaLibraryService';
import { EditorPersistenceService } from '../../services/EditorPersistenceService';
import { TimelineEngineService } from '../../services/TimelineEngineService';

/**
 * MediaGrid Component
 * Dynamic media management interface integrated with project storage.
 */

interface MediaItem {
  id: string;
  name: string;
  type: 'video' | 'audio' | 'image' | 'subtitle';
  path: string;
  thumbnail?: string;
  duration?: number;
}

interface MediaGridProps {
  project?: EditorProject;
  persistence?: EditorPersistenceService;
  onProjectUpdate?: (project: EditorProject) => void;
}

interface MediaCardProps {
  item: MediaItem;
  onContextMenu: (e: React.MouseEvent, id: string) => void;
  onAddToTimeline: (item: MediaItem) => void;
}

const AudioWaveform = () => (
  <div className="flex items-end gap-[1px] h-full w-full px-2 pb-2 overflow-hidden bg-info/10">
    {[...Array(24)].map((_, i) => {
      const height = 40 + (Math.sin(i * 0.5) * 30) + (Math.random() * 20);
      return (
        <div 
          key={i} 
          className="flex-1 bg-info rounded-t-[0.5px]" 
          style={{ height: `${height}%` }} 
        />
      );
    })}
  </div>
);

const MediaCard = ({ item, onContextMenu, onAddToTimeline }: MediaCardProps) => {
  const handleDragStart = (e: DragEvent) => {
    e.dataTransfer.setData('application/json', JSON.stringify({
      type: 'media',
      item: {
        id: item.id,
        type: item.type,
        src: item.path,
        name: item.name,
        duration: item.duration || (item.type === 'image' ? 5 : 0)
      }
    }));
    e.dataTransfer.setData('media/clip', 'true');
    e.dataTransfer.effectAllowed = 'copy';
  };

  const IconMap = {
    video: Film,
    audio: Music,
    image: ImageIcon,
    subtitle: Type
  };
  const Icon = IconMap[item.type];

  return (
    <div 
      className="group flex flex-col gap-1.5 cursor-grab active:cursor-grabbing"
      draggable
      onDragStart={handleDragStart}
      onContextMenu={(e) => onContextMenu(e, item.id)}
    >
      {/* Thumbnail Area */}
      <div className="relative aspect-video rounded-lg overflow-hidden bg-theme-tertiary border border-theme transition-all duration-200 group-hover:border-primary/50 group-hover:ring-1 group-hover:ring-primary/20">
        {item.type === 'audio' ? (
          <AudioWaveform />
        ) : item.type === 'image' && item.thumbnail ? (
          <img src={item.thumbnail} alt={item.name} className="w-full h-full object-cover" />
        ) : (
          <div className="w-full h-full flex items-center justify-center bg-theme-hover/20">
            <Icon size={24} className="text-theme-muted opacity-40" />
          </div>
        )}

        {/* Duration Badge */}
        {item.duration && item.duration > 0 && (
          <span className="absolute bottom-1.5 right-1.5 px-1.5 py-0.5 rounded text-[10px] font-medium bg-black/60 text-white backdrop-blur-sm">
            {Math.floor(item.duration / 60)}:{(item.duration % 60).toString().padStart(2, '0')}
          </span>
        )}

        {/* Type Icon Overlay */}
        <div className="absolute top-1.5 left-1.5 p-1 rounded bg-black/40 text-white backdrop-blur-sm opacity-60 group-hover:opacity-100 transition-opacity">
          <Icon size={12} />
        </div>

        {/* Add to Timeline Button - appears on hover */}
        <button
          onClick={(e) => {
            e.stopPropagation();
            onAddToTimeline(item);
          }}
          className="absolute bottom-1.5 left-1.5 p-1 rounded-full bg-primary text-white shadow-lg opacity-0 group-hover:opacity-100 transition-all duration-200 hover:scale-110 hover:bg-primary/90 active:scale-95 z-10"
          title="Adicionar à Timeline"
        >
          <Plus size={14} strokeWidth={3} />
        </button>

        {/* Hover Overlay */}
        <div className="absolute inset-0 bg-black/5 opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none" />
      </div>

      {/* Info Area */}
      <div className="px-0.5">
        <p className="text-[11px] font-medium text-theme-secondary truncate max-w-full group-hover:text-theme-primary transition-colors">
          {item.name}
        </p>
      </div>
    </div>
  );
};

export function MediaGrid({ project, persistence, onProjectUpdate }: MediaGridProps) {
  const library: MediaItem[] = (project?.metadata as any)?.library || [];
  const [contextMenu, setContextMenu] = useState<{ x: number, y: number, mediaId: string } | null>(null);

  useEffect(() => {
    const handleClick = () => setContextMenu(null);
    window.addEventListener('click', handleClick);
    return () => window.removeEventListener('click', handleClick);
  }, []);

  const handleImport = async () => {
    if (!project || !persistence || !onProjectUpdate) return;
    try {
      const updatedProject = await MediaLibraryService.importFilesToProject(project, persistence);
      onProjectUpdate(updatedProject);
    } catch (err) {
      console.error('Erro ao importar arquivos:', err);
    }
  };

  const handleContextMenu = useCallback((e: React.MouseEvent, mediaId: string) => {
    e.preventDefault();
    setContextMenu({ x: e.clientX, y: e.clientY, mediaId });
  }, []);

  const handleDeleteMedia = async () => {
    if (!project || !persistence || !onProjectUpdate || !contextMenu) return;
    try {
      const updatedProject = await MediaLibraryService.removeFileFromProject(project, contextMenu.mediaId, persistence);
      onProjectUpdate(updatedProject);
      setContextMenu(null);
    } catch (err) {
      console.error('Erro ao excluir mídia:', err);
    }
  };

  const handleAddToTimeline = useCallback((item: MediaItem) => {
    if (!project || !onProjectUpdate) return;

    const tracks = project.tracks || [];

    // Find compatible track
    const trackTypeMap: Record<string, string> = {
      video: 'video',
      image: 'video',
      audio: 'audio',
      subtitle: 'subtitle'
    };
    const targetTrackType = trackTypeMap[item.type] || 'video';
    const targetTrack = tracks.find(t => t.type === targetTrackType);

    if (!targetTrack) {
      console.warn('Nenhuma track compatível encontrada para:', item.type);
      return;
    }

    // Calculate insert position: at the end of existing clips on this track
    const lastClipEnd = targetTrack.clips.reduce((max, clip) => {
      const end = clip.startTime + clip.duration;
      return end > max ? end : max;
    }, 0);

    // Build source object
    let source: any = {
      type: item.type,
      url: item.path,
      path: item.path
    };

    if (item.type === 'subtitle') {
      source = {
        type: 'subtitle',
        text: item.name || 'Nova Legenda',
      };
    }

    const clipDuration = item.duration || (item.type === 'image' ? 5 : 10);

    const newClip = createClip(
      targetTrack.id,
      source,
      lastClipEnd,
      clipDuration
    );

    const newTracks = TimelineEngineService.addClip(tracks, newClip);
    onProjectUpdate({ ...project, tracks: newTracks });
  }, [project, onProjectUpdate]);

  return (
    <div className="flex flex-col h-full bg-theme-secondary select-none">
      {/* TOOLBAR */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-theme shrink-0">
        <div className="flex items-center gap-2">
          {/* Import Button */}
          <button 
            onClick={handleImport}
            className="flex items-center gap-2 pl-2 pr-3 py-1.5 rounded-lg bg-theme-tertiary border border-theme hover:bg-theme-hover active:scale-[0.98] transition-all group focus:outline-none focus:ring-2 focus:ring-primary/40 focus:ring-offset-2 focus:ring-offset-theme-secondary"
            title="Importar mídia do computador"
          >
            <div className="w-5 h-5 flex items-center justify-center rounded-full bg-primary text-white">
              <Plus size={14} strokeWidth={3} />
            </div>
            <span className="text-xs font-bold text-theme-primary">Importar</span>
          </button>

          {/* Record Button */}
          <button 
            className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-theme-tertiary border border-theme hover:bg-theme-hover active:scale-[0.98] transition-all text-theme-muted hover:text-theme-primary opacity-50 cursor-not-allowed"
            title="Gravar vídeo ou áudio (Em breve)"
            disabled
          >
            <Video size={16} />
            <span className="text-xs font-semibold">Gravar</span>
          </button>
        </div>

        {/* Functional Icons Group */}
        <div className="flex items-center gap-1">
          {[
            { icon: Search, label: 'Busca' },
            { icon: LayoutGrid, label: 'Visualização' },
            { icon: ArrowUpDown, label: 'Ordenação' },
            { icon: Filter, label: 'Filtro' },
          ].map((btn, i) => (
            <button 
              key={i}
              className="p-2 rounded-lg text-theme-muted hover:text-theme-primary hover:bg-theme-hover transition-all active:scale-95"
              title={btn.label}
            >
              <btn.icon size={16} />
            </button>
          ))}
        </div>
      </div>

      {/* CONTENT AREA */}
      <div className="flex-1 overflow-y-auto custom-scrollbar p-4 pt-2">
        {/* Section Label */}
        <div className="mb-4 flex items-center justify-between">
          <span className="text-xs font-semibold text-theme-muted/60 uppercase tracking-wider">
            Arquivos do Projeto ({library.length})
          </span>
        </div>

        {/* Grid Container */}
        {library.length > 0 ? (
          <div className="grid grid-cols-2 gap-x-4 gap-y-6">
            {library.map((item) => (
              <MediaCard 
                key={item.id} 
                item={item} 
                onContextMenu={handleContextMenu} 
                onAddToTimeline={handleAddToTimeline}
              />
            ))}
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center py-12 gap-4 text-center">
            <div className="w-16 h-16 rounded-full bg-theme-hover flex items-center justify-center text-theme-muted">
              <Plus size={32} />
            </div>
            <div className="space-y-1">
              <p className="text-sm font-semibold text-theme-primary">Nenhuma mídia importada</p>
              <p className="text-xs text-theme-muted">Clique em "Importar" para começar.</p>
            </div>
          </div>
        )}

      </div>

      {/* Context Menu Overlay */}
      {contextMenu && (
        <div 
          className="fixed z-[100] min-w-[140px] py-1 rounded-lg border border-theme shadow-xl bg-theme-secondary/95 backdrop-blur-md"
          style={{ top: contextMenu.y, left: contextMenu.x }}
          onContextMenu={(e) => e.preventDefault()}
        >
          <button 
            onClick={handleDeleteMedia}
            className="w-full flex items-center gap-2 px-3 py-1.5 text-xs text-red-500 hover:bg-red-500/10 transition-colors text-left font-medium"
          >
            <Trash2 size={13} />
            <span>Excluir</span>
          </button>
        </div>
      )}
    </div>
  );
}
