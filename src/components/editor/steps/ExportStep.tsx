import React, { useState } from 'react';
import { 
  Film, 
  Settings, 
  Play, 
  Loader2, 
  CheckCircle2, 
  AlertCircle, 
  FolderOpen, 
  Monitor, 
  Smartphone,
  ChevronRight,
  Settings2
} from 'lucide-react';
import { 
  VideoProject, 
  ChannelProfile, 
  VideoFormat, 
  StoryboardSegment, 
  PipelineStage, 
  ProjectStatus 
} from '../../../types';
import { renderProjectVideo, VideoRenderProgress, VideoRenderResult } from '../../../services/VideoRenderService';
import { saveAudio } from '../../../services/AudioStorageService';

interface ExportStepProps {
  projectId: string;
  segments: StoryboardSegment[];
  audioBytes: Uint8Array | null;
  assContent: string;
  activeProfile?: ChannelProfile;
  onExportComplete: (videoUrl: string) => void;
  status: 'pending' | 'processing' | 'completed' | 'error';
}

export const ExportStep: React.FC<ExportStepProps> = ({ 
  projectId, 
  segments, 
  audioBytes, 
  assContent, 
  activeProfile, 
  onExportComplete,
  status: parentStatus 
}) => {
  const [isExporting, setIsExporting] = useState(false);
  const [progress, setProgress] = useState<VideoRenderProgress | null>(null);
  const [result, setResult] = useState<VideoRenderResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  
  // Opções locais de render
  const [format, setFormat] = useState<VideoFormat>(activeProfile?.format || VideoFormat.SHORTS);
  const [quality, setQuality] = useState<'high' | 'standard'>('high');

  const handleExport = async () => {
    if (!audioBytes) {
      setError("Áudio não encontrado. Por favor, gere o áudio antes de exportar.");
      return;
    }

    if (!assContent) {
      setError("Legendas não encontradas. Por favor, gere as legendas antes de exportar.");
      return;
    }

    if (segments.length === 0 || !segments.some(s => s.assets?.imageUrl)) {
      setError("Imagens não encontradas. Por favor, gere as imagens antes de exportar.");
      return;
    }

    setIsExporting(true);
    setError(null);
    setResult(null);

    try {
      // 1. Garantir que o áudio está no disco para o render service encontrar
      await saveAudio(projectId, audioBytes);

      // 2. Construir um projeto "fake" para o render service
      const dummyProject: VideoProject = {
        id: projectId,
        channelId: activeProfile?.id || 'default',
        title: activeProfile?.name || 'Projeto Editor',
        currentStage: PipelineStage.VIDEO,
        status: 'processing' as ProjectStatus,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        stageData: {
          subtitles: {
            srtContent: "", // Not used by render service for now (uses ASS)
            assContent: assContent,
            segments: segments,
            segmentCount: segments.length,
            totalDuration: segments.reduce((acc, s) => acc + s.duration, 0),
            mode: 'manual'
          },
          audio: {
            fileUrl: `disk://${projectId}`,
            mode: 'manual'
          }
        }
      };

      // 3. Chamar o serviço de render
      const renderResult = await renderProjectVideo(
        dummyProject, 
        { ...activeProfile!, format }, // Aplica o formato selecionado no UI
        (p) => setProgress(p)
      );

      setResult(renderResult);
      onExportComplete(renderResult.outputPath);
    } catch (err: any) {
      console.error("Erro na exportação:", err);
      setError(err.message || "Ocorreu um erro durante a renderização.");
    } finally {
      setIsExporting(false);
    }
  };

  const openFolder = async () => {
    if (result?.outputPath) {
      try {
        const { revealItemInDir } = await import('@tauri-apps/plugin-opener');
        await revealItemInDir(result.outputPath);
      } catch (err) {
        console.error("Erro ao abrir pasta:", err);
      }
    }
  };

  // Calcula percentual baseado na fase
  const getPhasePercent = (phase: string) => {
    switch (phase) {
      case 'preparing': return 5;
      case 'exporting_audio': return 15;
      case 'exporting_subtitles': return 25;
      case 'exporting_images': return 40;
      case 'rendering': return 80;
      case 'saving': return 95;
      case 'cleanup': return 98;
      case 'done': return 100;
      default: return 0;
    }
  };

  return (
    <div className="space-y-4">
      {/* Settings & Export Action */}
      <div className="flex flex-col gap-4 p-5 bg-theme-secondary/30 rounded-2xl border border-theme">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Settings className="text-primary animate-spin-slow" size={24} />
            <div>
              <h5 className="text-sm font-black text-theme-primary uppercase tracking-tight">Finalização & Render</h5>
              <p className="text-[10px] text-theme-muted uppercase tracking-wider">Exportando via FFmpeg nativo</p>
            </div>
          </div>
          
          <button
            onClick={handleExport}
            disabled={isExporting}
            className="flex items-center gap-3 px-6 py-2.5 bg-primary text-white rounded-xl hover:opacity-90 transition-all disabled:opacity-40 shadow-xl shadow-primary/30 font-black text-xs uppercase tracking-widest group"
          >
            {isExporting ? (
              <>
                <Loader2 size={16} className="animate-spin" />
                <span>Renderizando...</span>
              </>
            ) : (
              <>
                <Play size={16} className="group-hover:translate-x-0.5 transition-transform" />
                <span>Exportar Vídeo</span>
              </>
            )}
          </button>
        </div>

        {/* Options Row */}
        {!isExporting && !result && (
          <div className="grid grid-cols-2 gap-4 pt-2">
            <div>
              <label className="text-[10px] font-black text-theme-muted uppercase tracking-widest mb-2 block">Formato de Saída</label>
              <div className="flex gap-2">
                <button 
                  onClick={() => setFormat(VideoFormat.SHORTS)}
                  className={`flex-1 flex flex-col items-center gap-2 p-3 rounded-xl border transition-all ${format === VideoFormat.SHORTS ? 'bg-primary/20 border-primary text-primary shadow-lg shadow-primary/10' : 'bg-theme-secondary border-theme text-theme-muted hover:bg-theme-hover'}`}
                >
                  <Smartphone size={18} />
                  <span className="text-[9px] font-bold uppercase">Shorts (9:16)</span>
                </button>
                <button 
                  onClick={() => setFormat(VideoFormat.LONG_FORM)}
                  className={`flex-1 flex flex-col items-center gap-2 p-3 rounded-xl border transition-all ${format === VideoFormat.LONG_FORM ? 'bg-primary/20 border-primary text-primary shadow-lg shadow-primary/10' : 'bg-theme-secondary border-theme text-theme-muted hover:bg-theme-hover'}`}
                >
                  <Monitor size={18} />
                  <span className="text-[9px] font-bold uppercase">Long (16:9)</span>
                </button>
              </div>
            </div>
            <div>
              <label className="text-[10px] font-black text-theme-muted uppercase tracking-widest mb-2 block">Qualidade (CRF)</label>
              <div className="flex gap-2">
                <button 
                  onClick={() => setQuality('high')}
                  className={`flex-1 flex flex-col items-center gap-2 p-3 rounded-xl border transition-all ${quality === 'high' ? 'bg-primary/10 border-primary/50 text-primary shadow-md shadow-primary/5' : 'bg-theme-secondary border-theme text-theme-muted hover:bg-theme-hover'}`}
                >
                  <Settings2 size={18} />
                  <span className="text-[9px] font-bold uppercase text-center">Alta Qualidade<br/>(Visual PRO)</span>
                </button>
                <button 
                  onClick={() => setQuality('standard')}
                  className={`flex-1 flex flex-col items-center gap-2 p-3 rounded-xl border transition-all ${quality === 'standard' ? 'bg-primary/10 border-primary/50 text-primary shadow-md shadow-primary/5' : 'bg-theme-secondary border-theme text-theme-muted hover:bg-theme-hover'}`}
                >
                  <Loader2 size={18} />
                  <span className="text-[9px] font-bold uppercase text-center">Equilibrada<br/>(Render Rápido)</span>
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Export Progress */}
        {isExporting && progress && (
          <div className="space-y-3 pt-4 border-t border-theme animate-in fade-in slide-in-from-top-2 duration-300">
            <div className="flex justify-between items-end">
              <div>
                <span className="text-[10px] font-black text-primary uppercase tracking-widest block mb-1">
                  Status: {progress.phase.replace('_', ' ')}
                </span>
                <p className="text-[11px] text-theme-primary font-medium">{progress.message}</p>
              </div>
              <span className="text-[11px] font-mono font-bold text-primary">
                {getPhasePercent(progress.phase)}%
              </span>
            </div>
            
            <div className="w-full h-3 bg-theme-hover rounded-full overflow-hidden border border-theme p-0.5">
              <div 
                className="h-full bg-gradient-to-r from-primary/80 to-primary rounded-full shadow-[0_0_12px_rgba(var(--df-primary-rgb),0.5)] transition-all duration-500 ease-out"
                style={{ width: `${getPhasePercent(progress.phase)}%` }}
              />
            </div>

            {progress.total > 0 && (
              <p className="text-[10px] text-theme-muted text-right italic">
                Elemento {progress.current} de {progress.total} processado
              </p>
            )}
          </div>
        )}
      </div>

      {error && (
        <div className="p-4 bg-red-500/10 border border-red-500/30 rounded-2xl flex items-start gap-3 text-red-400 text-xs animate-in shake-2 duration-300">
          <AlertCircle size={18} className="shrink-0 mt-0.5" />
          <div className="flex-1">
            <p className="font-black uppercase tracking-widest mb-1">Erro na Renderização</p>
            <p className="opacity-90">{error}</p>
          </div>
        </div>
      )}

      {/* Success View */}
      {result && (
        <div className="p-6 bg-green-500/10 border border-green-500/30 rounded-2xl space-y-4 animate-in zoom-in-95 duration-500">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-full bg-green-500/20 flex items-center justify-center text-green-500 shadow-lg shadow-green-500/10">
              <CheckCircle2 size={24} />
            </div>
            <div className="flex-1">
              <h4 className="text-base font-black text-green-500 uppercase tracking-tight">Renderização Finalizada!</h4>
              <p className="text-[11px] text-theme-muted">Seu vídeo está pronto para ser publicado em seus canais.</p>
            </div>
          </div>

          <div className="grid grid-cols-3 gap-3">
            <div className="p-3 rounded-xl bg-black/40 border border-theme">
              <span className="text-[9px] text-theme-muted uppercase block mb-1">Duração</span>
              <p className="text-xs font-bold text-theme-primary">{result.duration.toFixed(1)}s</p>
            </div>
            <div className="p-3 rounded-xl bg-black/40 border border-theme">
              <span className="text-[9px] text-theme-muted uppercase block mb-1">Tamanho</span>
              <p className="text-xs font-bold text-theme-primary">{(result.fileSize / 1024 / 1024).toFixed(1)} MB</p>
            </div>
            <div className="p-3 rounded-xl bg-black/40 border border-theme">
              <span className="text-[9px] text-theme-muted uppercase block mb-1">Resolução</span>
              <p className="text-xs font-bold text-theme-primary">{result.resolution}</p>
            </div>
          </div>

          <div className="flex gap-2">
            <button 
              onClick={openFolder}
              className="flex-1 flex items-center justify-center gap-2 py-3 bg-theme-secondary text-theme-primary border border-theme rounded-xl hover:bg-theme-hover transition-all text-[11px] font-black uppercase tracking-widest"
            >
              <FolderOpen size={16} />
              Abrir Pasta
            </button>
            <button 
              className="flex-1 flex items-center justify-center gap-2 py-3 bg-primary text-white rounded-xl hover:opacity-90 transition-all text-[11px] font-black uppercase tracking-widest shadow-lg shadow-primary/20"
            >
              Assista agora
              <ChevronRight size={16} />
            </button>
          </div>

          <div className="p-3 bg-black/20 rounded-lg border border-theme border-dashed">
            <p className="text-[9px] text-theme-muted font-mono break-all truncate">
              {result.outputPath}
            </p>
          </div>
        </div>
      )}
    </div>
  );
};
