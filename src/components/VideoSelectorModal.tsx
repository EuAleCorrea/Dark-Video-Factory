import React, { useState } from 'react';
import { ReferenceVideo } from '../types';
import { X, Calendar, Eye, Clock, Youtube, Loader2, CheckCircle2, Circle, Search } from 'lucide-react';

interface VideoSelectorModalProps {
  isOpen: boolean;
  onClose: () => void;
  isLoading: boolean;
  channelName: string;
  videos: ReferenceVideo[];
  onSelect: (video: ReferenceVideo) => void;
  onMultiSelect?: (videos: ReferenceVideo[]) => void; // New prop for batch
  error?: string | null;
  onSearch?: (query: string) => void;
}

const VideoSelectorModal: React.FC<VideoSelectorModalProps> = ({
  isOpen,
  onClose,
  isLoading,
  channelName,
  videos,
  onSelect,
  onMultiSelect,
  error,
  onSearch
}) => {
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [searchInput, setSearchInput] = useState(channelName || '');

  // Update local input when prop changes, if needed
  React.useEffect(() => {
    setSearchInput(channelName || '');
  }, [channelName]);

  const handleSearchClick = () => {
    if (onSearch && searchInput) {
      onSearch(searchInput);
    }
  };

  // Toggle selection for multi-select
  const toggleSelection = (e: React.MouseEvent, video: ReferenceVideo) => {
    e.stopPropagation();
    const newSet = new Set(selectedIds);
    if (newSet.has(video.id)) {
      newSet.delete(video.id);
    } else {
      newSet.add(video.id);
    }
    setSelectedIds(newSet);
  };

  const handleConfirmMultiSelect = () => {
    if (!onMultiSelect) return;
    const selectedVideos = videos.filter(v => selectedIds.has(v.id));
    onMultiSelect(selectedVideos);
    setSelectedIds(new Set()); // Reset after confirm
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/40 backdrop-blur-sm"
        onClick={onClose}
      ></div>

      {/* Modal Content */}
      <div className="relative bg-white border border-[#E2E8F0] rounded-xl shadow-2xl w-full max-w-4xl max-h-[85vh] flex flex-col overflow-hidden">

        {/* Header */}
        <div className="px-6 py-4 border-b border-[#E2E8F0] flex items-center justify-between bg-[#F8FAFC]">
          <div className="flex items-center gap-3">
            <div className="bg-red-50 p-2 rounded-full text-red-500">
              <Youtube size={20} />
            </div>
            <div>
              <h3 className="text-base font-bold text-[#0F172A] uppercase tracking-wider">
                Biblioteca do Canal
              </h3>
              {onSearch ? (
                <div className="flex items-center gap-2 mt-1">
                  <input
                    className="bg-[#F1F5F9] border border-[#E2E8F0] rounded-lg px-2 py-1 text-sm focus:outline-none focus:border-primary w-48"
                    placeholder="Nome do canal..."
                    value={searchInput}
                    onChange={(e) => setSearchInput(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && handleSearchClick()}
                  />
                  <button
                    onClick={handleSearchClick}
                    className="p-1.5 bg-primary/10 text-primary rounded-lg hover:bg-primary/20 transition"
                    title="Buscar"
                  >
                    <Search size={14} />
                  </button>
                </div>
              ) : (
                <p className="text-sm text-[#94A3B8]">
                  Selecione um ou mais vídeos de <span className="text-[#0F172A] font-bold">{channelName}</span>
                </p>
              )}
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 hover:bg-[#F1F5F9] rounded-full text-[#94A3B8] hover:text-[#0F172A] transition"
          >
            <X size={20} />
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto p-6 bg-[#F8FAFC]/50">
          {isLoading ? (
            <div className="h-64 flex flex-col items-center justify-center text-[#94A3B8] gap-3">
              <Loader2 size={32} className="animate-spin text-primary" />
              <span className="text-sm uppercase tracking-widest animate-pulse font-medium">Buscando Vídeos Recentes...</span>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
              {videos.map((video) => {
                const isSelected = selectedIds.has(video.id);
                return (
                  <div
                    key={video.id}
                    onClick={() => onSelect(video)}
                    className={`group bg-white border rounded-xl overflow-hidden cursor-pointer transition-all duration-200 shadow-sm hover:shadow-md relative
                        ${isSelected ? 'border-primary ring-2 ring-primary/20' : 'border-[#E2E8F0] hover:border-primary/50'}
                      `}
                  >
                    {/* Multi-select Checkbox (Only if onMultiSelect provided) */}
                    {onMultiSelect && (
                      <div
                        onClick={(e) => toggleSelection(e, video)}
                        className={`absolute top-2 right-2 z-10 p-1.5 rounded-full backdrop-blur-md transition-all
                            ${isSelected ? 'bg-primary text-white' : 'bg-black/30 text-white/50 hover:bg-black/50 hover:text-white'}
                          `}
                      >
                        {isSelected ? <CheckCircle2 size={18} fill="currentColor" className="text-white" /> : <Circle size={18} />}
                      </div>
                    )}

                    {/* Thumbnail */}
                    <div className="relative aspect-video bg-[#F1F5F9] overflow-hidden">
                      <img
                        src={video.thumbnailUrl}
                        alt={video.title}
                        className="w-full h-full object-cover opacity-90 group-hover:opacity-100 transition-opacity"
                      />
                      <div className="absolute bottom-2 right-2 bg-black/80 px-2 py-0.5 rounded-md text-[11px] font-bold text-white flex items-center gap-1 shadow-sm">
                        <Clock size={11} /> {video.duration}
                      </div>
                    </div>

                    {/* Info */}
                    <div className="p-4">
                      <h4 className="text-sm font-bold text-[#0F172A] line-clamp-2 mb-3 group-hover:text-primary transition-colors leading-snug">
                        {video.title}
                      </h4>

                      <div className="flex items-center justify-between text-[11px] text-[#64748B] font-medium">
                        <span className="flex items-center gap-1.5 bg-slate-50 px-2 py-1 rounded-md border border-slate-100">
                          <Eye size={12} className="text-slate-400" /> {video.views}
                        </span>
                        <span className="flex items-center gap-1.5 bg-slate-50 px-2 py-1 rounded-md border border-slate-100">
                          <Calendar size={12} className="text-slate-400" /> {video.publishedAt}
                        </span>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {!isLoading && videos.length === 0 && (
            <div className="h-40 flex items-center justify-center text-[#94A3B8] text-sm">
              Nenhum vídeo encontrado para este canal.
            </div>
          )}
        </div>

        <div className="px-6 py-4 border-t border-[#E2E8F0] bg-white text-xs text-[#94A3B8] flex justify-between items-center">
          <span>YouTube Data API v3</span>

          {onMultiSelect && selectedIds.size > 0 && (
            <button
              onClick={handleConfirmMultiSelect}
              className="bg-primary hover:bg-primary/90 text-white px-6 py-2.5 rounded-xl text-sm font-bold shadow-lg shadow-primary/20 transition-all flex items-center gap-2"
            >
              Importar {selectedIds.size} Projetos <CheckCircle2 size={16} />
            </button>
          )}
        </div>

      </div>
    </div>
  );
};

export default VideoSelectorModal;