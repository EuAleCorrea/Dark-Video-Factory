import React from 'react';
import { X } from 'lucide-react';

interface VideoPlayerModalProps {
    isOpen: boolean;
    onClose: () => void;
    videoId: string;
    videoTitle: string;
}

export default function VideoPlayerModal({ isOpen, onClose, videoId, videoTitle }: VideoPlayerModalProps) {
    if (!isOpen || !videoId) return null;

    // Converte ID para URL de embed
    const embedUrl = `https://www.youtube.com/embed/${videoId}?autoplay=1&rel=0`;

    return (
        <div
            className="fixed inset-0 z-[11000] flex items-center justify-center bg-black/80 backdrop-blur-md p-4 animate-in fade-in duration-300"
            onClick={onClose}
        >
            <div
                className="relative bg-slate-900 w-full max-w-5xl aspect-video rounded-3xl overflow-hidden shadow-[0_0_50px_rgba(0,0,0,0.5)] border border-white/10 animate-in zoom-in-95 duration-300"
                onClick={e => e.stopPropagation()}
            >
                {/* Header Overlay */}
                <div className="absolute top-0 left-0 right-0 p-4 bg-gradient-to-b from-black/80 to-transparent z-10 flex items-center justify-between opacity-0 hover:opacity-100 transition-opacity duration-300">
                    <h3 className="text-white font-bold text-lg truncate max-w-[80%]">{videoTitle}</h3>
                    <button
                        onClick={onClose}
                        className="p-2 bg-white/10 hover:bg-white/20 rounded-full text-white backdrop-blur-sm transition-all shadow-lg active:scale-90"
                    >
                        <X size={24} />
                    </button>
                </div>

                {/* Close Button UI (Visible Always) */}
                <button
                    onClick={onClose}
                    className="absolute top-4 right-4 z-20 p-2 bg-black/40 hover:bg-black/60 rounded-full text-white backdrop-blur-sm transition-all md:hidden"
                >
                    <X size={24} />
                </button>

                {/* iFrame Container */}
                <div className="w-full h-full bg-black">
                    <iframe
                        src={embedUrl}
                        title={videoTitle}
                        className="w-full h-full border-none"
                        allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
                        allowFullScreen
                    />
                </div>
            </div>
        </div>
    );
}
