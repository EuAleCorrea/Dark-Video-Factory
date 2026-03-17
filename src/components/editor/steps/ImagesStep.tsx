import React, { useState, useEffect } from 'react';
import { Image as ImageIcon, Wand2, CheckCircle2, AlertCircle, Loader2, Layout, Clock, ChevronDown } from 'lucide-react';
import { EngineConfig, ChannelProfile, StoryboardSegment, PipelineStage } from '../../../types';
import { 
  getImageModelsByGroup, 
  getImageProvider, 
  getImageModel, 
  IMAGE_MODELS,
  ImageModel
} from '../../../services/imageProviders';

interface ImagesStepProps {
  config: EngineConfig;
  segments: StoryboardSegment[];
  activeProfile?: ChannelProfile;
  onImagesGenerated: (updatedSegments: StoryboardSegment[]) => void;
  status: 'pending' | 'processing' | 'completed' | 'error';
  width?: number;
  height?: number;
}

export const ImagesStep: React.FC<ImagesStepProps> = ({ 
  config, 
  segments, 
  activeProfile, 
  onImagesGenerated,
  status: parentStatus,
  width = 1080,
  height = 1920
}) => {
  const [isGenerating, setIsGenerating] = useState(false);
  const [generationProgress, setGenerationProgress] = useState(0);
  const [logs, setLogs] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [selectedModelId, setSelectedModelId] = useState<string>(IMAGE_MODELS[0].id);
  const [localSegments, setLocalSegments] = useState<StoryboardSegment[]>(segments);

  useEffect(() => {
    setLocalSegments(segments);
  }, [segments]);

  const modelsByGroup = getImageModelsByGroup();

  const handleGenerateAll = async () => {
    if (localSegments.length === 0) {
      setError("Nenhum segmento encontrado para gerar imagens.");
      return;
    }

    const model = getImageModel(selectedModelId);
    if (!model) {
      setError("Modelo selecionado é inválido.");
      return;
    }

    const apiKey = (config.apiKeys as any)[model.apiKeyField];
    if (!apiKey) {
      setError(`API Key para ${model.providerGroup} não configurada.`);
      return;
    }

    setIsGenerating(true);
    setGenerationProgress(0);
    setError(null);
    setLogs([`🎬 Iniciando geração em lote para ${localSegments.length} cenas...`]);

    const provider = getImageProvider(selectedModelId);
    const updatedSegments = [...localSegments];
    let completedCount = 0;

    try {
      for (let i = 0; i < updatedSegments.length; i++) {
        const seg = updatedSegments[i];
        try {
          setLogs(prev => [...prev, `[${i + 1}/${localSegments.length}] Gerando imagem para: "${seg.visualPrompt.substring(0, 40)}..."`]);
          
          const result = await provider.generate(
            seg.visualPrompt,
            width,
            height,
            1,
            apiKey,
            (msg) => setLogs(prev => [...prev, `  ↳ ${msg}`])
          );

          updatedSegments[i] = {
            ...seg,
            assets: {
              ...seg.assets,
              imageUrl: result.urls[0]
            }
          };

          completedCount++;
          setGenerationProgress(Math.round((completedCount / localSegments.length) * 100));
          setLocalSegments([...updatedSegments]); // Update UI incrementally
        } catch (err: any) {
          console.error(`Erro no segmento ${i + 1}:`, err);
          setLogs(prev => [...prev, `❌ Erro no segmento ${i + 1}: ${err.message || 'Falha na geração'}`]);
        }
      }

      onImagesGenerated(updatedSegments);
      setLogs(prev => [...prev, `✅ Processo concluído! ${completedCount} imagens geradas.`]);
    } catch (err: any) {
      setError(err.message || "Erro fatal durante a geração de imagens.");
    } finally {
      setIsGenerating(false);
    }
  };

  return (
    <div className="space-y-4">
      {/* Model Selector & Action */}
      <div className="flex flex-col gap-4 p-4 bg-theme-secondary/30 rounded-xl border border-theme">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <ImageIcon className="text-primary" size={24} />
            <div>
              <h5 className="text-sm font-bold text-theme-primary uppercase tracking-tight">Geração de Ativos Visuais</h5>
              <p className="text-[10px] text-theme-muted uppercase tracking-wider">IA Generativa ({IMAGE_MODELS.length} modelos)</p>
            </div>
          </div>
          
          <div className="flex items-center gap-3">
            <div className="relative group">
              <select 
                value={selectedModelId}
                onChange={(e) => setSelectedModelId(e.target.value)}
                disabled={isGenerating}
                className="appearance-none bg-theme-primary/50 border border-theme rounded-lg px-4 py-2 pr-10 text-[11px] font-bold text-theme-primary focus:border-primary outline-none cursor-pointer hover:bg-theme-hover transition-all uppercase tracking-widest"
              >
                {Object.entries(modelsByGroup).map(([group, models]) => (
                  <optgroup key={group} label={group} className="bg-theme-secondary text-[10px] font-bold uppercase py-2">
                    {models.map(m => (
                      <option key={m.id} value={m.id} className="text-theme-primary font-normal">
                        {m.label}
                      </option>
                    ))}
                  </optgroup>
                ))}
              </select>
              <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 text-theme-muted pointer-events-none group-hover:text-primary transition-colors" size={14} />
            </div>

            <button
              onClick={handleGenerateAll}
              disabled={isGenerating || localSegments.length === 0}
              className="flex items-center gap-2 px-5 py-2 bg-primary text-white rounded-lg hover:opacity-90 transition-all disabled:opacity-40 shadow-lg shadow-primary/20 font-bold text-[11px] uppercase tracking-widest"
            >
              {isGenerating ? (
                <>
                  <Loader2 size={16} className="animate-spin" />
                  <span>{generationProgress}%</span>
                </>
              ) : (
                <>
                  <Wand2 size={16} />
                  <span>Gerar Tudo</span>
                </>
              )}
            </button>
          </div>
        </div>

        {/* Progress Bar */}
        {isGenerating && (
          <div className="w-full h-1.5 bg-theme-hover rounded-full overflow-hidden border border-theme">
            <div 
              className="h-full bg-primary shadow-[0_0_8px_rgba(var(--df-primary-rgb),0.5)] transition-all duration-300"
              style={{ width: `${generationProgress}%` }}
            />
          </div>
        )}
      </div>

      {error && (
        <div className="p-3 bg-red-500/10 border border-red-500/20 rounded-lg flex items-center gap-3 text-red-500 text-xs">
          <AlertCircle size={14} />
          <span>{error}</span>
        </div>
      )}

      {/* Logs Area */}
      {logs.length > 0 && (
        <div className="p-3 bg-black/40 rounded-xl border border-theme font-mono text-[9px] text-theme-muted h-24 overflow-y-auto custom-scrollbar flex flex-col-reverse">
          <div className="space-y-1">
            {logs.map((log, i) => (
              <div key={i} className={log.startsWith('❌') ? 'text-red-400' : log.startsWith('✅') ? 'text-green-400' : ''}>
                {log}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Grid de Cenas */}
      <div className="grid grid-cols-2 gap-3 max-h-[400px] overflow-y-auto pr-2 custom-scrollbar">
        {localSegments.length > 0 ? (
          localSegments.map((seg, idx) => (
            <div key={seg.id} className="relative aspect-[9/16] rounded-xl overflow-hidden border border-theme bg-theme-secondary/20 group hover:border-primary/50 transition-all">
              {seg.assets?.imageUrl ? (
                <img 
                  src={seg.assets.imageUrl} 
                  alt={`Cena ${idx + 1}`}
                  className="w-full h-full object-cover animate-in fade-in zoom-in-95 duration-500"
                />
              ) : (
                <div className="absolute inset-0 flex flex-col items-center justify-center p-4 text-center">
                  <div className="w-10 h-10 rounded-full bg-theme-hover flex items-center justify-center text-theme-muted mb-2 mb-2 group-hover:scale-110 transition-transform">
                    <ImageIcon size={20} strokeWidth={1.5} />
                  </div>
                  <p className="text-[8px] font-bold text-theme-muted uppercase tracking-widest leading-tight">Segmento #{seg.id}</p>
                  <p className="text-[7px] text-theme-muted/60 mt-2 line-clamp-3 italic px-2">"{seg.scriptText}"</p>
                </div>
              )}
              
              {/* Overlay Info */}
              <div className="absolute inset-x-0 bottom-0 p-3 bg-gradient-to-t from-black/80 to-transparent translate-y-full group-hover:translate-y-0 transition-transform duration-300">
                <div className="flex items-center justify-between mb-1.5">
                  <span className="text-[8px] font-black text-white px-1.5 py-0.5 bg-primary rounded uppercase">Scene #{seg.id}</span>
                  <span className="text-[8px] text-white/70 flex items-center gap-1 font-mono">
                    <Clock size={8} /> {seg.duration}s
                  </span>
                </div>
                <p className="text-[8px] text-white/90 line-clamp-2 leading-tight font-medium">"{seg.visualPrompt}"</p>
              </div>

              {/* Status Indicator */}
              {seg.assets?.imageUrl && (
                <div className="absolute top-2 right-2 p-1 bg-green-500 rounded-full text-white shadow-lg animate-in zoom-in duration-300">
                  <CheckCircle2 size={12} />
                </div>
              )}
            </div>
          ))
        ) : (
          <div className="col-span-2 flex flex-col items-center justify-center py-12 text-theme-muted opacity-30">
            <Layout size={40} strokeWidth={1} className="mb-3" />
            <p className="text-[10px] font-bold uppercase tracking-widest text-center">Nenhum segmento storyboard<br/>encontrado para renderização</p>
          </div>
        )}
      </div>
    </div>
  );
};
