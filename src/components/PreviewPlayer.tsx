import React, { useEffect, useRef, useState } from 'react';
import { Play, Pause, SkipBack, X } from 'lucide-react';
import { StoryboardSegment, SubtitleConfig, VideoFormat } from '../types';

interface PreviewPlayerProps {
    storyboard: StoryboardSegment[];
    audioUrl: string | undefined;
    subtitleConfig?: SubtitleConfig;
    format: VideoFormat;
    onClose: () => void;
}

const PreviewPlayer: React.FC<PreviewPlayerProps> = ({
    storyboard,
    audioUrl,
    subtitleConfig,
    format,
    onClose
}) => {
    const audioRef = useRef<HTMLAudioElement | null>(null);
    const [isPlaying, setIsPlaying] = useState(false);
    const [currentTime, setCurrentTime] = useState(0);
    const [duration, setDuration] = useState(0);

    // Aspect Ratio Styles
    const isShorts = format === VideoFormat.SHORTS;
    const containerClass = isShorts
        ? "aspect-[9/16] h-[600px]"
        : "aspect-[16/9] w-[800px]";

    // --- SYNC ENGINE ---
    // Find current segment based on time
    const currentSegmentIndex = storyboard.findIndex((seg, idx) => {
        // Calculate start time by summing previous durations
        let start = 0;
        for (let i = 0; i < idx; i++) start += storyboard[i].duration;
        const end = start + seg.duration;
        return currentTime >= start && currentTime < end;
    });

    const currentSegment = currentSegmentIndex !== -1
        ? storyboard[currentSegmentIndex]
        : (currentTime >= duration ? storyboard[storyboard.length - 1] : storyboard[0]);

    // Handle Play/Pause
    const togglePlay = () => {
        if (!audioRef.current || !audioUrl) return;
        if (isPlaying) {
            audioRef.current.pause();
        } else {
            audioRef.current.play();
        }
        setIsPlaying(!isPlaying);
    };

    const handleTimeUpdate = () => {
        if (audioRef.current) setCurrentTime(audioRef.current.currentTime);
    };

    const handleLoadedMetadata = () => {
        if (audioRef.current) setDuration(audioRef.current.duration);
    };

    const handleEnded = () => setIsPlaying(false);

    // --- SUBTITLE STYLES (Simulate .ass) ---
    const subStyle = subtitleConfig || {
        fontName: 'Arial',
        fontSize: 100,
        primaryColor: '#FFFFFF',
        outlineColor: '#000000',
        alignment: 'BOTTOM',
        backgroundColor: 'transparent'
    };

    const getAlignmentClass = () => {
        switch (subStyle.alignment) {
            case 'TOP': return 'top-10';
            case 'CENTER': return 'top-1/2 -translate-y-1/2';
            default: return 'bottom-10'; // BOTTOM
        }
    };

    return (
        <div className="fixed inset-0 z-50 bg-black/90 backdrop-blur-md overflow-y-auto">
            <div className="min-h-full flex flex-col items-center justify-center p-8">
                {/* Header */}
                <div className="fixed top-4 right-4 z-[60]">
                    <button onClick={onClose} className="p-2 bg-slate-800 rounded-full hover:bg-slate-700 text-white transition shadow-lg border border-slate-700">
                        <X size={24} />
                    </button>
                </div>

                <div className="text-white font-bold mb-6 flex items-center gap-2 shrink-0">
                    <span className="w-2 h-2 bg-red-500 rounded-full animate-pulse"></span>
                    LIVE PREVIEW RENDER
                </div>

                {/* Player Container */}
                <div className={`relative bg-black rounded-lg overflow-hidden shadow-2xl border border-slate-800 flex items-center justify-center shrink-0 ${containerClass}`}>

                    {/* 1. VISUAL LAYER */}
                    {currentSegment?.assets?.imageUrl ? (
                        <img
                            src={currentSegment.assets.imageUrl}
                            alt="Visual"
                            className="w-full h-full object-cover transition-opacity duration-500" // Simple fade attempt
                        />
                    ) : (
                        <div className="text-slate-500 font-mono text-xs">Gerando Visuais...</div>
                    )}

                    {/* 2. SUBTITLE LAYER (Overlay) */}
                    <div className={`absolute w-full px-8 text-center ${getAlignmentClass()}`}>
                        <span
                            style={{
                                fontFamily: subStyle.fontName,
                                color: subStyle.primaryColor,
                                WebkitTextStroke: `1px ${subStyle.outlineColor}`,
                                textShadow: `2px 2px 0px ${subStyle.outlineColor}`,
                                fontSize: isShorts ? '24px' : '32px', // Approximate relative scale
                                fontWeight: 'bold',
                                lineHeight: 1.2
                            }}
                            className="drop-shadow-lg"
                        >
                            {currentSegment?.scriptText}
                        </span>
                    </div>

                    {/* 3. AUDIO ENGINE (Invisible) */}
                    {audioUrl && (
                        <audio
                            ref={audioRef}
                            src={audioUrl}
                            onTimeUpdate={handleTimeUpdate}
                            onLoadedMetadata={handleLoadedMetadata}
                            onEnded={handleEnded}
                        />
                    )}

                    {/* 4. CONTROLS OVERLAY */}
                    <div className="absolute bottom-0 w-full bg-gradient-to-t from-black/80 to-transparent p-4 flex flex-col gap-2 opacity-0 hover:opacity-100 transition duration-300">
                        {/* Progress Bar */}
                        <div className="w-full h-1 bg-white/20 rounded-full overflow-hidden cursor-pointer" onClick={(e) => {
                            const rect = e.currentTarget.getBoundingClientRect();
                            const pos = (e.clientX - rect.left) / rect.width;
                            if (audioRef.current) audioRef.current.currentTime = pos * duration;
                        }}>
                            <div className="h-full bg-emerald-500" style={{ width: `${(currentTime / (duration || 1)) * 100}%` }}></div>
                        </div>

                        <div className="flex justify-between items-center">
                            <div className="flex items-center gap-4">
                                <button onClick={() => { if (audioRef.current) audioRef.current.currentTime = 0; }} className="text-white hover:text-emerald-400"><SkipBack size={20} /></button>
                                <button onClick={togglePlay} className="text-white hover:text-emerald-400">
                                    {isPlaying ? <Pause size={24} /> : <Play size={24} />}
                                </button>
                                <span className="text-xs font-mono text-slate-300">
                                    {currentTime.toFixed(1)}s / {duration.toFixed(1)}s
                                </span>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default PreviewPlayer;