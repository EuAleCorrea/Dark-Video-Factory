import React, { useState, useEffect } from 'react';
import { 
  Search, 
  Youtube, 
  Loader2, 
  Eye, 
  Calendar, 
  Clock, 
  FileText, 
  CheckCircle2, 
  AlertCircle,
  ExternalLink
} from 'lucide-react';
import { ReferenceVideo, EngineConfig } from '../../../types';
import { searchChannelVideos, transcribeVideo } from '../../../lib/youtubeMock';

interface ReferenceStepProps {
  config: EngineConfig;
  onReferenceSelected: (video: ReferenceVideo, transcript: string) => void;
  initialVideo?: ReferenceVideo;
  initialTranscript?: string;
}

export const ReferenceStep: React.FC<ReferenceStepProps> = ({ 
  config, 
  onReferenceSelected,
  initialVideo,
  initialTranscript
}) => {
  const [searchInput, setSearchInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [videos, setVideos] = useState<ReferenceVideo[]>([]);
  const [error, setError] = useState<string | null>(null);
  
  const [selectedVideo, setSelectedVideo] = useState<ReferenceVideo | null>(initialVideo || null);
  const [transcript, setTranscript] = useState<string>(initialTranscript || '');
  const [isTranscribing, setIsTranscribing] = useState(false);

  const handleSearch = async () => {
    if (!searchInput.trim()) return;
    
    setIsLoading(true);
    setError(null);
    setSelectedVideo(null);
    setTranscript('');
    
    try {
      const results = await searchChannelVideos(searchInput, config.apiKeys.youtube);
      setVideos(results);
    } catch (err: any) {
      setError(err.message || 'Erro ao buscar vídeos');
      setVideos([]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleTranscribe = async (video: ReferenceVideo) => {
    setSelectedVideo(video);
    setIsTranscribing(true);
    setError(null);
    
    try {
      const result = await transcribeVideo(video.id, config.apiKeys.apify);
      setTranscript(result.transcript);
      onReferenceSelected(video, result.transcript);
    } catch (err: any) {
      setError(err.message || 'Erro ao transcrever vídeo');
    } finally {
      setIsTranscribing(false);
    }
  };

  const reset = () => {
    setSelectedVideo(null);
    setTranscript('');
    setVideos([]);
    setSearchInput('');
  };

  if (selectedVideo && transcript) {
    return (
      <div className="flex flex-col gap-4 animate-in fade-in zoom-in-95 duration-300">
        <div className="p-4 bg-primary/5 border border-primary/20 rounded-2xl flex items-start gap-4">
          <img 
            src={selectedVideo.thumbnailUrl} 
            alt={selectedVideo.title}
            className="w-32 aspect-video object-cover rounded-xl shadow-lg"
          />
          <div className="flex-1">
            <h4 className="text-sm font-bold text-theme-primary leading-tight line-clamp-2">
              {selectedVideo.title}
            </h4>
            <div className="flex items-center gap-3 mt-2 text-[10px] font-bold text-theme-muted uppercase tracking-wider">
              <span className="flex items-center gap-1"><Youtube size={12} className="text-red-500" /> {selectedVideo.channelName}</span>
              <span className="flex items-center gap-1"><Clock size={12} /> {selectedVideo.duration}</span>
            </div>
          </div>
          <button 
            onClick={reset}
            className="p-2 hover:bg-theme-hover rounded-xl text-theme-muted hover:text-red-500 transition-colors"
            title="Remover Referência"
          >
            <AlertCircle size={18} />
          </button>
        </div>

        <div className="flex flex-col gap-2">
           <label className="text-[10px] font-black text-theme-muted uppercase tracking-[0.2em] ml-1">Transcrição Extraída</label>
           <div className="p-4 bg-theme-hover/40 border border-theme rounded-2xl max-h-[200px] overflow-y-auto custom-scrollbar">
              <p className="text-xs text-theme-primary leading-relaxed whitespace-pre-wrap">
                {transcript}
              </p>
           </div>
        </div>

        <div className="flex items-center justify-between p-3 bg-green-500/10 border border-green-500/20 rounded-xl">
           <div className="flex items-center gap-2 text-green-500">
              <CheckCircle2 size={16} />
              <span className="text-[10px] font-bold uppercase">Referência Pronta</span>
           </div>
           <button 
             onClick={() => window.open(`https://youtube.com/watch?v=${selectedVideo.id}`, '_blank')}
             className="text-[10px] font-bold text-primary hover:underline flex items-center gap-1"
          >
             Ver no Youtube <ExternalLink size={10} />
           </button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-5 animate-in fade-in duration-300">
      {/* Search Bar */}
      <div className="flex gap-2">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-theme-muted" size={16} />
          <input 
            type="text" 
            placeholder="Nome do canal ou URL do YouTube..."
            className="w-full pl-10 pr-4 py-2.5 bg-theme-primary border border-theme rounded-2xl text-sm focus:ring-2 focus:ring-primary/20 transition-all"
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
          />
        </div>
        <button 
          onClick={handleSearch}
          disabled={isLoading || !searchInput.trim()}
          className="px-6 py-2.5 bg-primary text-white rounded-2xl font-bold text-sm hover:opacity-90 disabled:opacity-50 transition-all flex items-center gap-2 shadow-lg shadow-primary/20"
        >
          {isLoading ? <Loader2 size={18} className="animate-spin" /> : <Search size={18} />}
          Buscar
        </button>
      </div>

      {error && (
        <div className="p-3 bg-red-500/10 border border-red-500/20 rounded-xl flex items-center gap-3 text-red-500 text-xs animate-in slide-in-from-top-2">
          <AlertCircle size={16} />
          {error}
        </div>
      )}

      {/* Results List */}
      <div className="flex flex-col gap-3 max-h-[400px] overflow-y-auto no-scrollbar pr-1">
        {videos.map((video) => (
          <div 
            key={video.id}
            className="group p-3 bg-theme-primary border border-theme rounded-2xl hover:border-primary/50 transition-all cursor-pointer flex gap-4 relative overflow-hidden"
          >
            <div className="w-28 shrink-0 aspect-video rounded-lg overflow-hidden relative">
              <img src={video.thumbnailUrl} alt={video.title} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" />
              <div className="absolute bottom-1 right-1 bg-black/80 text-[9px] font-bold text-white px-1.5 py-0.5 rounded flex items-center gap-1">
                <Clock size={10} /> {video.duration}
              </div>
            </div>
            
            <div className="flex-1 min-w-0">
              <h4 className="text-xs font-bold text-theme-primary truncate leading-tight group-hover:text-primary transition-colors">
                {video.title}
              </h4>
              <div className="flex items-center gap-3 mt-2 text-[10px] font-medium text-theme-muted">
                <span className="flex items-center gap-1"><Eye size={12} /> {video.views}</span>
                <span className="flex items-center gap-1"><Calendar size={12} /> {video.publishedAt}</span>
              </div>
              
              <button 
                onClick={(e) => {
                   e.stopPropagation();
                   handleTranscribe(video);
                }}
                disabled={isTranscribing && selectedVideo?.id === video.id}
                className="mt-3 w-full py-2 bg-theme-hover hover:bg-primary hover:text-white text-theme-primary text-[10px] font-black uppercase tracking-widest rounded-xl transition-all flex items-center justify-center gap-2"
              >
                {isTranscribing && selectedVideo?.id === video.id ? (
                  <>
                    <Loader2 size={12} className="animate-spin" />
                    Extraindo...
                  </>
                ) : (
                  <>
                    <FileText size={12} />
                    Usar como Referência
                  </>
                )}
              </button>
            </div>
          </div>
        ))}

        {!isLoading && videos.length === 0 && !error && !selectedVideo && (
          <div className="h-32 flex flex-col items-center justify-center text-theme-muted gap-2 border-2 border-dashed border-theme rounded-3xl opacity-40">
            <Youtube size={32} />
            <span className="text-[10px] font-bold uppercase tracking-widest">Aguardando busca...</span>
          </div>
        )}
      </div>

      {isTranscribing && (
        <div className="fixed inset-0 z-[110] flex items-center justify-center bg-theme-primary/60 backdrop-blur-sm animate-in fade-in">
           <div className="bg-theme-secondary p-8 rounded-3xl border border-theme shadow-2xl flex flex-col items-center gap-4 max-w-sm text-center">
              <div className="w-16 h-16 bg-primary/10 rounded-full flex items-center justify-center text-primary relative">
                 <Loader2 size={32} className="animate-spin" />
                 <Youtube size={16} className="absolute -bottom-1 -right-1 text-red-500" />
              </div>
              <div>
                <h4 className="text-sm font-bold text-theme-primary">Extraindo Transcrição</h4>
                <p className="text-xs text-theme-muted mt-2 px-4">
                  O robô está assistindo ao vídeo e extraindo o áudio para transformá-lo em texto. Aguarde um instante...
                </p>
              </div>
              <div className="w-full bg-theme-hover h-1.5 rounded-full overflow-hidden mt-2">
                 <div className="h-full bg-primary animate-progress-indefinite w-full" />
              </div>
           </div>
        </div>
      )}
    </div>
  );
};
