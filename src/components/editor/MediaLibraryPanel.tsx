import React, { useState, useCallback } from 'react';
import { FolderOpen, Search, Image, Upload, Film, Loader2, Sparkles } from 'lucide-react';
import { EngineConfig } from '../../types';
import { MediaGrid } from './MediaGrid';
import { PexelsResultsModal } from './PexelsResultsModal';
import { EditorProject, generateId } from '../../types/editor';
import { EditorPersistenceService } from '../../services/EditorPersistenceService';
import { MediaLibraryService } from '../../services/MediaLibraryService';
import { PexelsService, PexelsPhoto, PexelsVideo } from '../../services/PexelsService';
import { writeFile, mkdir, exists, BaseDirectory } from '@tauri-apps/plugin-fs';
import { join, pictureDir } from '@tauri-apps/api/path';
import { convertFileSrc } from '@tauri-apps/api/core';

type MediaTab = 'files' | 'pexels' | 'ai';

interface MediaLibraryPanelProps {
  config: EngineConfig;
  project?: EditorProject;
  persistence?: EditorPersistenceService;
  onProjectUpdate?: (project: EditorProject) => void;
}

const PEXELS_DOWNLOAD_DIR = 'DarkVideoFactory/Pexels';

export function MediaLibraryPanel({ config, project, persistence, onProjectUpdate }: MediaLibraryPanelProps) {
  const [activeTab, setActiveTab] = useState<MediaTab>('files');

  // Pexels state
  const [pexelsQuery, setPexelsQuery] = useState('');
  const [pexelsTab, setPexelsTab] = useState<'photos' | 'videos'>('photos');
  const [showPexelsModal, setShowPexelsModal] = useState(false);
  const [pexelsPhotos, setPexelsPhotos] = useState<PexelsPhoto[]>([]);
  const [pexelsVideos, setPexelsVideos] = useState<PexelsVideo[]>([]);
  const [pexelsLoading, setPexelsLoading] = useState(false);
  const [pexelsPage, setPexelsPage] = useState(1);
  const [importing, setImporting] = useState<number | null>(null);

  const tabs: { id: MediaTab; label: string; icon: React.ElementType }[] = [
    { id: 'files', label: 'Arquivos', icon: FolderOpen },
    { id: 'pexels', label: 'Pexels', icon: Search },
    { id: 'ai', label: 'IA', icon: Image },
  ];

  const handleImportClick = async () => {
    if (!project || !persistence || !onProjectUpdate) return;
    try {
      const updatedProject = await MediaLibraryService.importFilesToProject(project, persistence);
      onProjectUpdate(updatedProject);
      setActiveTab('files');
    } catch (err) {
      console.error('Erro ao importar arquivos:', err);
    }
  };

  // --- Pexels Logic ---
  const handlePexelsSearch = useCallback(async (page: number = 1) => {
    if (!pexelsQuery.trim()) return;
    const apiKey = config.apiKeys.pexels || '';
    if (!apiKey) {
      alert('Configure sua Pexels API Key nas configurações.');
      return;
    }

    setPexelsLoading(true);
    try {
      const translated = await PexelsService.translateQuery(pexelsQuery, config);

      if (pexelsTab === 'photos') {
        const res = await PexelsService.searchPhotos(translated, apiKey, 15, page);
        if (page === 1) {
          setPexelsPhotos(res.photos || []);
        } else {
          setPexelsPhotos(prev => [...prev, ...(res.photos || [])]);
        }
      } else {
        const res = await PexelsService.searchVideos(translated, apiKey, 15, page);
        if (page === 1) {
          setPexelsVideos(res.videos || []);
        } else {
          setPexelsVideos(prev => [...prev, ...(res.videos || [])]);
        }
      }
      setPexelsPage(page);
      setShowPexelsModal(true);
    } catch (err) {
      console.error('Erro ao buscar no Pexels:', err);
    } finally {
      setPexelsLoading(false);
    }
  }, [pexelsQuery, pexelsTab, config]);

  const handlePexelsLoadMore = useCallback(() => {
    handlePexelsSearch(pexelsPage + 1);
  }, [handlePexelsSearch, pexelsPage]);

  // Download file from URL and save to disk, return absolute path
  const downloadPexelsFile = async (url: string, filename: string): Promise<string> => {
    const dirExists = await exists(PEXELS_DOWNLOAD_DIR, { baseDir: BaseDirectory.Picture });
    if (!dirExists) {
      await mkdir(PEXELS_DOWNLOAD_DIR, { baseDir: BaseDirectory.Picture, recursive: true });
    }

    const response = await fetch(url);
    const blob = await response.blob();
    const arrayBuffer = await blob.arrayBuffer();
    const uint8Array = new Uint8Array(arrayBuffer);

    const filePath = `${PEXELS_DOWNLOAD_DIR}/${filename}`;
    await writeFile(filePath, uint8Array, { baseDir: BaseDirectory.Picture });

    const picDir = await pictureDir();
    const absolutePath = await join(picDir, PEXELS_DOWNLOAD_DIR, filename);
    return absolutePath;
  };

  // Add downloaded file to project library
  const addToProjectLibrary = useCallback(async (
    filePath: string,
    name: string,
    type: 'image' | 'video',
    duration: number = 0
  ) => {
    if (!project || !persistence || !onProjectUpdate) return;

    const updatedProject = { ...project };
    if (!updatedProject.metadata) updatedProject.metadata = {};

    const currentLibrary = (updatedProject.metadata as any).library || [];
    const newItem = {
      id: generateId(),
      name,
      path: filePath,
      type,
      thumbnail: type === 'image' ? convertFileSrc(filePath) : undefined,
      duration: type === 'image' ? 5 : duration,
      addedAt: new Date().toISOString(),
    };

    (updatedProject.metadata as any).library = [...currentLibrary, newItem];
    await persistence.saveEditorProject(updatedProject);
    onProjectUpdate(updatedProject);
  }, [project, persistence, onProjectUpdate]);

  const handleSelectPhoto = useCallback(async (photo: PexelsPhoto) => {
    setImporting(photo.id);
    try {
      const ext = 'jpg';
      const filename = `pexels_${photo.id}_${Date.now()}.${ext}`;
      const absolutePath = await downloadPexelsFile(photo.src.large2x, filename);
      await addToProjectLibrary(absolutePath, `pexels-${photo.id}.${ext}`, 'image');
      setShowPexelsModal(false);
      setActiveTab('files');
    } catch (err) {
      console.error('Erro ao importar foto do Pexels:', err);
    } finally {
      setImporting(null);
    }
  }, [addToProjectLibrary]);

  const handleSelectVideo = useCallback(async (video: PexelsVideo) => {
    setImporting(video.id);
    try {
      const hdFile = video.video_files.find(f => f.quality === 'hd') || video.video_files[0];
      const ext = hdFile.file_type?.split('/')[1] || 'mp4';
      const filename = `pexels_${video.id}_${Date.now()}.${ext}`;
      const absolutePath = await downloadPexelsFile(hdFile.link, filename);
      await addToProjectLibrary(absolutePath, `pexels-${video.id}.${ext}`, 'video', video.duration);
      setShowPexelsModal(false);
      setActiveTab('files');
    } catch (err) {
      console.error('Erro ao importar vídeo do Pexels:', err);
    } finally {
      setImporting(null);
    }
  }, [addToProjectLibrary]);

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div
        className="flex items-center justify-between px-3 py-2.5 border-b border-theme shrink-0"
        style={{ backgroundColor: 'var(--df-bg-secondary)' }}
      >
        <span className="text-sm font-semibold text-theme-primary">Mídia</span>
        <button
          onClick={handleImportClick}
          className="p-1.5 rounded-lg text-theme-muted hover:text-theme-primary transition-colors"
          style={{ cursor: 'pointer' }}
          onMouseEnter={(e) => e.currentTarget.style.backgroundColor = 'var(--df-bg-hover)'}
          onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'transparent'}
          title="Importar arquivos"
        >
          <Upload size={15} />
        </button>
      </div>

      {/* Tabs */}
      <div className="flex border-b border-theme shrink-0" style={{ backgroundColor: 'var(--df-bg-secondary)' }}>
        {tabs.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`flex-1 flex items-center justify-center gap-1.5 py-2 text-xs font-medium transition-all ${
              activeTab === tab.id
                ? 'text-primary border-b-2 border-primary'
                : 'text-theme-muted hover:text-theme-primary'
            }`}
          >
            <tab.icon size={13} />
            {tab.label}
          </button>
        ))}
      </div>

      {/* Search bar — show for files and pexels tabs */}
      {activeTab !== 'ai' && (
        <div className="px-3 py-2 shrink-0" style={{ backgroundColor: 'var(--df-bg-secondary)' }}>
          {activeTab === 'files' ? (
            <div className="relative">
              <Search size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-theme-placeholder" />
              <input
                type="text"
                placeholder="Buscar mídia..."
                className="w-full pl-8 pr-3 py-1.5 text-xs rounded-lg border-theme"
                style={{ backgroundColor: 'var(--df-bg-input)', fontSize: '12px' }}
              />
            </div>
          ) : (
            <form
              onSubmit={(e) => {
                e.preventDefault();
                setPexelsPage(1);
                setPexelsPhotos([]);
                setPexelsVideos([]);
                handlePexelsSearch(1);
              }}
              className="relative"
            >
              <Search size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-theme-placeholder" />
              <input
                type="text"
                value={pexelsQuery}
                onChange={(e) => setPexelsQuery(e.target.value)}
                placeholder="Buscar fotos e vídeos..."
                className="w-full pl-8 pr-16 py-1.5 text-xs rounded-lg border-theme"
                style={{ backgroundColor: 'var(--df-bg-input)', fontSize: '12px' }}
              />
              <button
                type="submit"
                disabled={pexelsLoading || !pexelsQuery.trim()}
                className="absolute right-1 top-1/2 -translate-y-1/2 px-2.5 py-1 text-[10px] font-semibold rounded-md bg-primary text-white hover:bg-primary-hover transition-all disabled:opacity-40"
              >
                {pexelsLoading ? <Loader2 size={12} className="animate-spin" /> : 'Buscar'}
              </button>
            </form>
          )}
        </div>
      )}

      {/* Content Area */}
      <div className="flex-1 flex flex-col overflow-hidden relative">
        {activeTab === 'pexels' ? (
          <div className="flex flex-col h-full bg-theme-secondary">
            {/* Toggle Fotos / Vídeos */}
            <div className="px-3 py-2 shrink-0">
              <div
                className="flex rounded-lg overflow-hidden border border-theme"
                style={{ backgroundColor: 'var(--df-bg-input)' }}
              >
                <button
                  onClick={() => setPexelsTab('photos')}
                  className={`flex-1 flex items-center justify-center gap-1.5 py-1.5 text-[11px] font-medium transition-all ${
                    pexelsTab === 'photos'
                      ? 'bg-primary text-white'
                      : 'text-theme-muted hover:text-theme-primary'
                  }`}
                >
                  <Image size={12} />
                  Fotos
                </button>
                <button
                  onClick={() => setPexelsTab('videos')}
                  className={`flex-1 flex items-center justify-center gap-1.5 py-1.5 text-[11px] font-medium transition-all ${
                    pexelsTab === 'videos'
                      ? 'bg-primary text-white'
                      : 'text-theme-muted hover:text-theme-primary'
                  }`}
                >
                  <Film size={12} />
                  Vídeos
                </button>
              </div>
            </div>

            {/* Empty state */}
            <div className="flex-1 flex flex-col items-center justify-center p-6">
              <div className="w-12 h-12 rounded-xl flex items-center justify-center bg-theme-hover mb-3">
                <Search size={22} className="text-theme-muted" />
              </div>
              <span className="text-xs text-theme-muted text-center leading-relaxed max-w-[180px]">
                Busque por fotos ou vídeos gratuitos do Pexels para importar ao seu projeto
              </span>
            </div>
          </div>
        ) : activeTab === 'files' ? (
          <MediaGrid 
            project={project} 
            persistence={persistence} 
            onProjectUpdate={onProjectUpdate} 
          />
        ) : (
          <div className="flex-1 flex flex-col items-center justify-center p-6 h-full w-full overflow-y-auto custom-scrollbar">
            <div className="group cursor-pointer w-full max-w-[200px]">
              <div className="aspect-video rounded-lg overflow-hidden border border-theme border-dashed group-hover:border-primary/50 transition-colors flex flex-col items-center justify-center gap-2 bg-theme-hover/20">
                <div className="p-2 rounded-full bg-primary/10 text-primary">
                  <Sparkles size={20} />
                </div>
                <span className="text-[11px] font-semibold text-theme-secondary">Gerar novos assets com IA</span>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Pexels Results Modal */}
      {showPexelsModal && (
        <PexelsResultsModal
          query={pexelsQuery}
          tab={pexelsTab}
          photos={pexelsPhotos}
          videos={pexelsVideos}
          loading={pexelsLoading}
          importing={importing}
          onClose={() => setShowPexelsModal(false)}
          onSelectPhoto={handleSelectPhoto}
          onSelectVideo={handleSelectVideo}
          onLoadMore={handlePexelsLoadMore}
          hasMore={(pexelsTab === 'photos' ? pexelsPhotos.length : pexelsVideos.length) >= 15}
        />
      )}
    </div>
  );
}
