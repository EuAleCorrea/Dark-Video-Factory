import React from 'react';
import { X, Loader2, Camera, Film, Download } from 'lucide-react';
import { PexelsPhoto, PexelsVideo } from '../../services/PexelsService';

interface PexelsResultsModalProps {
  query: string;
  tab: 'photos' | 'videos';
  photos: PexelsPhoto[];
  videos: PexelsVideo[];
  loading: boolean;
  importing: number | null;
  onClose: () => void;
  onSelectPhoto: (photo: PexelsPhoto) => void;
  onSelectVideo: (video: PexelsVideo) => void;
  onLoadMore: () => void;
  hasMore: boolean;
}

export function PexelsResultsModal({
  query,
  tab,
  photos,
  videos,
  loading,
  importing,
  onClose,
  onSelectPhoto,
  onSelectVideo,
  onLoadMore,
  hasMore,
}: PexelsResultsModalProps) {
  return (
    <div
      className="fixed inset-0 z-[200] flex items-center justify-center bg-black/70 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className="w-full max-w-4xl h-[85vh] flex flex-col rounded-2xl overflow-hidden border border-theme shadow-2xl"
        style={{ backgroundColor: 'var(--df-bg-primary)' }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div
          className="flex items-center justify-between px-5 py-3 border-b border-theme shrink-0"
          style={{ backgroundColor: 'var(--df-bg-secondary)' }}
        >
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg flex items-center justify-center bg-primary/10">
              {tab === 'photos' ? (
                <Camera size={16} className="text-primary" />
              ) : (
                <Film size={16} className="text-primary" />
              )}
            </div>
            <div>
              <h3 className="text-sm font-semibold text-theme-primary">
                Pexels — "{query}"
              </h3>
              <span className="text-[11px] text-theme-muted">
                {tab === 'photos'
                  ? `${photos.length} fotos encontradas`
                  : `${videos.length} vídeos encontrados`}
              </span>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-theme-muted hover:text-theme-primary transition-colors"
            style={{ cursor: 'pointer' }}
            onMouseEnter={(e) =>
              (e.currentTarget.style.backgroundColor = 'var(--df-bg-hover)')
            }
            onMouseLeave={(e) =>
              (e.currentTarget.style.backgroundColor = 'transparent')
            }
          >
            <X size={18} />
          </button>
        </div>

        {/* Grid */}
        <div className="flex-1 overflow-y-auto p-4 custom-scrollbar">
          {loading && photos.length === 0 && videos.length === 0 ? (
            <div className="h-full flex flex-col items-center justify-center gap-3">
              <Loader2 size={28} className="text-primary animate-spin" />
              <span className="text-xs text-theme-muted font-medium">
                Buscando no Pexels...
              </span>
            </div>
          ) : (
            <>
              <div className="grid grid-cols-3 gap-3">
                {tab === 'photos'
                  ? photos.map((photo) => (
                      <div
                        key={photo.id}
                        className="group relative aspect-[4/3] rounded-lg overflow-hidden cursor-pointer border border-theme hover:border-primary/50 transition-all"
                        onClick={() => onSelectPhoto(photo)}
                      >
                        <img
                          src={photo.src.medium}
                          alt={photo.alt}
                          className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                          loading="lazy"
                        />
                        {/* Hover overlay */}
                        <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-200 flex flex-col justify-end p-2.5">
                          <span className="text-white text-[10px] font-medium truncate">
                            {photo.photographer}
                          </span>
                          <span className="text-white/60 text-[9px] truncate">
                            {photo.alt || 'Foto Pexels'}
                          </span>
                        </div>
                        {/* Importing indicator */}
                        {importing === photo.id && (
                          <div className="absolute inset-0 bg-black/60 flex items-center justify-center">
                            <Loader2
                              size={24}
                              className="text-primary animate-spin"
                            />
                          </div>
                        )}
                        {/* Download icon */}
                        <div className="absolute top-2 right-2 p-1.5 rounded-lg bg-black/40 backdrop-blur-sm text-white opacity-0 group-hover:opacity-100 transition-opacity">
                          <Download size={12} />
                        </div>
                      </div>
                    ))
                  : videos.map((video) => (
                      <div
                        key={video.id}
                        className="group relative aspect-[4/3] rounded-lg overflow-hidden cursor-pointer border border-theme hover:border-primary/50 transition-all"
                        onClick={() => onSelectVideo(video)}
                      >
                        <img
                          src={video.image}
                          alt="Video"
                          className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                          loading="lazy"
                        />
                        {/* Duration badge */}
                        <div className="absolute top-2 left-2 px-1.5 py-0.5 rounded text-[10px] font-medium bg-black/60 text-white backdrop-blur-sm flex items-center gap-1">
                          <Film size={10} /> {video.duration}s
                        </div>
                        {/* Hover overlay */}
                        <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-200 flex flex-col justify-end p-2.5">
                          <span className="text-white text-[10px] font-medium truncate">
                            {video.user.name}
                          </span>
                        </div>
                        {/* Importing indicator */}
                        {importing === video.id && (
                          <div className="absolute inset-0 bg-black/60 flex items-center justify-center">
                            <Loader2
                              size={24}
                              className="text-primary animate-spin"
                            />
                          </div>
                        )}
                        {/* Download icon */}
                        <div className="absolute top-2 right-2 p-1.5 rounded-lg bg-black/40 backdrop-blur-sm text-white opacity-0 group-hover:opacity-100 transition-opacity">
                          <Download size={12} />
                        </div>
                      </div>
                    ))}
              </div>

              {/* Load More */}
              {hasMore && (
                <div className="flex justify-center mt-4 pb-2">
                  <button
                    onClick={onLoadMore}
                    disabled={loading}
                    className="px-6 py-2 text-xs font-semibold rounded-lg border border-theme text-theme-primary transition-all hover:border-primary hover:text-primary disabled:opacity-50"
                    style={{ cursor: 'pointer' }}
                    onMouseEnter={(e) =>
                      (e.currentTarget.style.backgroundColor =
                        'var(--df-bg-hover)')
                    }
                    onMouseLeave={(e) =>
                      (e.currentTarget.style.backgroundColor = 'transparent')
                    }
                  >
                    {loading ? (
                      <Loader2 size={14} className="animate-spin mx-auto" />
                    ) : (
                      'Carregar mais'
                    )}
                  </button>
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
