import React from 'react';
import { ReferenceVideo } from '../types';
import { X, Calendar, Eye, Clock, Youtube, Loader2 } from 'lucide-react';

interface VideoSelectorModalProps {
  isOpen: boolean;
  onClose: () => void;
  isLoading: boolean;
  channelName: string;
  videos: ReferenceVideo[];
  onSelect: (video: ReferenceVideo) => void;
}

const VideoSelectorModal: React.FC<VideoSelectorModalProps> = ({ 
  isOpen, 
  onClose, 
  isLoading, 
  channelName, 
  videos, 
  onSelect 
}) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {/* Backdrop */}
      <div 
        className="absolute inset-0 bg-black/80 backdrop-blur-sm"
        onClick={onClose}
      ></div>

      {/* Modal Content */}
      <div className="relative bg-dark-900 border border-white/10 rounded-xl shadow-2xl w-full max-w-4xl max-h-[80vh] flex flex-col overflow-hidden">
        
        {/* Header */}
        <div className="px-6 py-4 border-b border-white/5 flex items-center justify-between bg-dark-950/50">
          <div className="flex items-center gap-3">
            <div className="bg-red-600/20 p-2 rounded-full text-red-500">
              <Youtube size={20} />
            </div>
            <div>
              <h3 className="text-sm font-bold text-white uppercase tracking-wider">
                Biblioteca do Canal
              </h3>
              <p className="text-xs text-zinc-500">
                Selecione um vídeo de <span className="text-zinc-300 font-bold">{channelName}</span> para modelagem.
              </p>
            </div>
          </div>
          <button 
            onClick={onClose}
            className="p-2 hover:bg-white/5 rounded-full text-zinc-400 hover:text-white transition"
          >
            <X size={20} />
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto p-6 bg-grid">
          {isLoading ? (
            <div className="h-64 flex flex-col items-center justify-center text-zinc-500 gap-3">
              <Loader2 size={32} className="animate-spin text-neon-green" />
              <span className="text-xs uppercase tracking-widest animate-pulse">Buscando Vídeos Recentes...</span>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {videos.map((video) => (
                <div 
                  key={video.id}
                  onClick={() => onSelect(video)}
                  className="group bg-black/40 border border-white/5 hover:border-neon-green/50 rounded-lg overflow-hidden cursor-pointer transition-all duration-300 hover:shadow-[0_0_15px_rgba(16,185,129,0.1)] hover:-translate-y-1"
                >
                  {/* Thumbnail */}
                  <div className="relative aspect-video bg-zinc-800 overflow-hidden">
                    <img 
                      src={video.thumbnailUrl} 
                      alt={video.title} 
                      className="w-full h-full object-cover opacity-80 group-hover:opacity-100 transition-opacity"
                    />
                    <div className="absolute bottom-2 right-2 bg-black/80 px-1.5 py-0.5 rounded text-[10px] font-bold text-white flex items-center gap-1">
                      <Clock size={10} /> {video.duration}
                    </div>
                  </div>

                  {/* Info */}
                  <div className="p-3">
                    <h4 className="text-xs font-bold text-zinc-200 line-clamp-2 mb-2 group-hover:text-neon-green transition-colors">
                      {video.title}
                    </h4>
                    
                    <div className="flex items-center justify-between text-[10px] text-zinc-500">
                      <span className="flex items-center gap-1">
                        <Eye size={10} /> {video.views}
                      </span>
                      <span className="flex items-center gap-1">
                        <Calendar size={10} /> {video.publishedAt}
                      </span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
          
          {!isLoading && videos.length === 0 && (
            <div className="h-40 flex items-center justify-center text-zinc-500 text-xs">
              Nenhum vídeo encontrado para este canal.
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-3 border-t border-white/5 bg-dark-950/50 text-[10px] text-zinc-600 flex justify-between">
          <span>Ordenado por: Data de Publicação (Mais Recentes)</span>
          <span>YouTube Data API v3 (Mock)</span>
        </div>

      </div>
    </div>
  );
};

export default VideoSelectorModal;