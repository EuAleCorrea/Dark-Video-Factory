import React, { useState, useEffect } from 'react';
import { Image as ImageIcon, Wand2, CheckCircle2, AlertCircle, Loader2, Layout, Clock, ChevronDown, RotateCcw } from 'lucide-react';
import { EngineConfig, ChannelProfile, SceneData } from '../../../types';
import { 
  getImageModelsByGroup, 
  getImageProvider, 
  getImageModel, 
  IMAGE_MODELS
} from '../../../services/imageProviders';

interface ImagesStepProps {
  config: EngineConfig;
  scenes: SceneData[];
  activeProfile?: ChannelProfile;
  onImagesGenerated: (updatedScenes: SceneData[]) => void;
  status: 'pending' | 'processing' | 'completed' | 'error';
  width?: number;
  height?: number;
}

export const ImagesStep: React.FC<ImagesStepProps> = ({ 
  config, 
  scenes, 
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
  const [localScenes, setLocalScenes] = useState<SceneData[]>(scenes);

  useEffect(() => {
    setLocalScenes(scenes);
  }, [scenes]);

  const modelsByGroup = getImageModelsByGroup();

  const generateImageForScene = async (scene: SceneData, index: number, total: number): Promise<SceneData> => {
    const model = getImageModel(selectedModelId);
    if (!model) throw new Error("Modelo selecionado é inválido.");

    const apiKey = (config.apiKeys as any)[model.apiKeyField];
    if (!apiKey) throw new Error(`API Key para ${model.providerGroup} não configurada.`);

    const provider = getImageProvider(selectedModelId);
    setLogs(prev => [...prev, `[${index + 1}/${total}] Gerando imagem para cena ${scene.id}...`]);

    const result = await provider.generate(
      scene.visualPrompt,
      width,
      height,
      1,
      apiKey,
      (msg) => setLogs(prev => [...prev, `  ↳ ${msg}`])
    );

    return {
      ...scene,
      imageUrl: result.urls[0]
    };
  };

  const handleGenerateAll = async () => {
    if (localScenes.length === 0) {
      setError("Nenhuma cena encontrada para gerar imagens.");
      return;
    }

    setIsGenerating(true);
    setGenerationProgress(0);
    setError(null);
    setLogs([`🎬 Iniciando geração em lote para faltantes dentre ${localScenes.length} cenas...`]);

    const updatedScenes = [...localScenes];
    let completedCount = 0;

    try {
      for (let i = 0; i < updatedScenes.length; i++) {
        const scene = updatedScenes[i];
        if (!scene.imageUrl) {
            try {
              updatedScenes[i] = await generateImageForScene(scene, i, localScenes.length);
              completedCount++;
              setGenerationProgress(Math.round((completedCount / localScenes.length) * 100));
              setLocalScenes([...updatedScenes]); 
            } catch (err: any) {
              console.error(`Erro na cena ${i + 1}:`, err);
              setLogs(prev => [...prev, `❌ Erro na cena ${i + 1}: ${err.message || 'Falha na geração'}`]);
            }
        } else {
            completedCount++;
            setGenerationProgress(Math.round((completedCount / localScenes.length) * 100));
        }
      }

      onImagesGenerated(updatedScenes);
      setLogs(prev => [...prev, `✅ Processo concluído! Imagens prontas.`]);
    } catch (err: any) {
      setError(err.message || "Erro fatal durante a geração de imagens.");
    } finally {
      setIsGenerating(false);
    }
  };

  const handleRegenerateScene = async (index: number) => {
    setError(null);
    const updatedScenes = [...localScenes];
    setLogs([`🎬 Regerando imagem para a cena ${updatedScenes[index].id}...`]);
    try {
       updatedScenes[index] = await generateImageForScene(updatedScenes[index], index, localScenes.length);
       setLocalScenes([...updatedScenes]);
       onImagesGenerated(updatedScenes);
    } catch(err: any) {
        console.error(`Erro ao regerar cena ${index + 1}:`, err);
        setError(`Erro ao regerar cena ${index + 1}: ${err.message}`);
    }
  };

  return (
    <div className="space-y-4">
      {/* Model Selector & Action */}
      <div className="flex flex-col gap-4 p-4 bg-theme-secondary/30 rounded-xl border border-theme">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <ImageIcon className="text-primary" size={24} />
            <div>
              <h5 className="text-sm font-bold text-theme-primary uppercase tracking-tight">Geração de Visuais</h5>
              <p className="text-[10px] text-theme-muted uppercase tracking-wider">IA Generativa ({IMAGE_MODELS.length} modelos)</p>
            </div>
          </div>
          
          <div className="flex flex-wrap items-center gap-3">
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
              disabled={isGenerating || localScenes.length === 0}
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
                  <span>Gerar Faltantes</span>
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
        {localScenes.length > 0 ? (
          localScenes.map((scene, idx) => (
            <div key={scene.id} className="relative aspect-[9/16] rounded-xl overflow-hidden border border-theme bg-theme-secondary/20 group hover:border-primary/50 transition-all">
              {scene.imageUrl ? (
                <img 
                  src={scene.imageUrl} 
                  alt={`Cena ${scene.id}`}
                  className="w-full h-full object-cover animate-in fade-in zoom-in-95 duration-500"
                />
              ) : (
                <div className="absolute inset-0 flex flex-col items-center justify-center p-4 text-center">
                  <div className="w-10 h-10 rounded-full bg-theme-hover flex items-center justify-center text-theme-muted mb-2 group-hover:scale-110 transition-transform">
                    <ImageIcon size={20} strokeWidth={1.5} />
                  </div>
                  <p className="text-[8px] font-bold text-theme-muted uppercase tracking-widest leading-tight">Cena #{scene.id}</p>
                </div>
              )}
              
              {/* Overlay Info */}
              <div className="absolute inset-x-0 bottom-0 p-3 bg-gradient-to-t from-black/80 to-transparent translate-y-full group-hover:translate-y-0 transition-transform duration-300">
                <div className="flex items-center justify-between mb-1.5">
                  <span className="text-[8px] font-black text-white px-1.5 py-0.5 bg-primary rounded uppercase">Scene #{scene.id}</span>
                  <div className="flex gap-2">
                     <button 
                       onClick={() => handleRegenerateScene(idx)}
                       className="p-1 bg-white/20 hover:bg-white/40 rounded text-white transition-colors"
                       title="Regerar esta imagem"
                     >
                       <RotateCcw size={12} />
                     </button>
                  </div>
                </div>
                <p className="text-[8px] text-white/90 line-clamp-2 leading-tight font-medium">"{scene.visualPrompt}"</p>
              </div>

              {/* Status Indicator */}
              {scene.imageUrl && (
                <div className="absolute top-2 right-2 p-1 bg-green-500 rounded-full text-white shadow-lg animate-in zoom-in duration-300 pointer-events-none">
                  <CheckCircle2 size={12} />
                </div>
              )}
            </div>
          ))
        ) : (
          <div className="col-span-2 flex flex-col items-center justify-center py-12 text-theme-muted opacity-30">
            <Layout size={40} strokeWidth={1} className="mb-3" />
            <p className="text-[10px] font-bold uppercase tracking-widest text-center">Nenhuma cena<br/>encontrada para renderização</p>
          </div>
        )}
      </div>
    </div>
  );
};
