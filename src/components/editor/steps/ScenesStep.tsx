import React, { useState } from 'react';
import { Layout, Wand2, CheckCircle2, AlertCircle, Loader2 } from 'lucide-react';
import { EngineConfig, ChannelProfile, SceneData } from '../../../types';
import { smartChunkScript } from '../../../lib/smartChunker';
import { generateVisualPromptsForSegments } from '../../../services/geminiService';

interface ScenesStepProps {
  config: EngineConfig;
  script: string;
  activeProfile?: ChannelProfile;
  initialScenes?: SceneData[];
  onScenesGenerated: (scenes: SceneData[]) => void;
  status: 'pending' | 'processing' | 'completed' | 'error';
}

export const ScenesStep: React.FC<ScenesStepProps> = ({ 
  config, 
  script, 
  activeProfile,
  initialScenes = [],
  onScenesGenerated,
  status: parentStatus
}) => {
  const [isGenerating, setIsGenerating] = useState(false);
  const [scenes, setScenes] = useState<SceneData[]>(initialScenes);
  const [error, setError] = useState<string | null>(null);

  const wordsPerScene = config.sceneConfig?.wordsPerScene || 250;
  const maxScenes = config.sceneConfig?.maxScenes || 15;

  const handleGenerate = async () => {
    if (!script) {
        setError("Script não encontrado. Gere o roteiro primeiro.");
        return;
    }

    setIsGenerating(true);
    setError(null);

    try {
        // 1. Chunk script using the new scene constraints
        const chunks = smartChunkScript(script, wordsPerScene, maxScenes);
        
        // 2. Setup initial scenes
        const initialScenesData: SceneData[] = chunks.map(chunk => ({
            id: chunk.id,
            scriptText: chunk.text,
            visualPrompt: '',
            status: 'pending' as const
        }));

        // 3. Generate visual prompts using AI
        const visualStyle = activeProfile?.visualStyle || "cinematic, 8k, detailed, photorealistic";
        const modelId = activeProfile?.scriptingModel || config.scriptingModel || 'gemini-2.0-flash-exp';
        const provider = (activeProfile?.scriptingProvider || config.scriptingProvider || 'GEMINI') as 'GEMINI' | 'OPENAI' | 'OPENROUTER';

        const visualPromptsRaw = await generateVisualPromptsForSegments(
            initialScenesData.map(s => ({ id: s.id, scriptText: s.scriptText })),
            visualStyle,
            modelId,
            provider,
            config
        );

        // 4. Merge prompts back
        const finalScenes: SceneData[] = initialScenesData.map(scene => {
            const promptObj = visualPromptsRaw.find(p => p.id === scene.id);
            return {
                ...scene,
                visualPrompt: promptObj ? promptObj.visualPrompt : "Cinematic scene, detailed atmosphere"
            };
        });

        setScenes(finalScenes);
        onScenesGenerated(finalScenes);
    } catch (err: any) {
        console.error("Erro ao gerar cenas:", err);
        setError(err.message || "Erro desconhecido ao gerar cenas.");
    } finally {
        setIsGenerating(false);
    }
  };

  const updateSceneText = (id: number, text: string) => {
    const updated = scenes.map(s => s.id === id ? { ...s, scriptText: text } : s);
    setScenes(updated);
    onScenesGenerated(updated);
  };

  const updateScenePrompt = (id: number, prompt: string) => {
    const updated = scenes.map(s => s.id === id ? { ...s, visualPrompt: prompt } : s);
    setScenes(updated);
    onScenesGenerated(updated);
  };

  return (
    <div className="space-y-6">
      {/* Header Info */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white border border-[#E2E8F0] p-4 rounded-xl shadow-sm">
        <div>
          <h3 className="font-bold text-[#0F172A] flex items-center gap-2">
            <Layout className="text-[#14B8A6]" size={20} />
            Divisão em Cenas
          </h3>
          <p className="text-sm text-[#64748B] mt-1">
            Divide o roteiro longo em cenas curtas para gerar áudio e imagem individualmente. (Aprox. {wordsPerScene} palavras por cena).
          </p>
        </div>
        
        <button
          onClick={handleGenerate}
          disabled={isGenerating || !script}
          className="flex items-center gap-2 px-6 py-3 bg-[#14B8A6] hover:bg-[#0D9488] text-white rounded-lg font-bold transition disabled:opacity-50 whitespace-nowrap shadow-sm"
        >
          {isGenerating ? <Loader2 size={18} className="animate-spin" /> : <Wand2 size={18} />}
          {scenes.length > 0 ? 'Regerar Cenas' : 'Gerar Cenas e Prompts'}
        </button>
      </div>

      {error && (
        <div className="p-4 bg-red-50 text-red-600 border border-red-200 rounded-xl flex items-start gap-3 text-sm">
          <AlertCircle size={18} className="shrink-0 mt-0.5" />
          <p>{error}</p>
        </div>
      )}

      {/* Generated Scenes List */}
      {scenes.length > 0 && (
        <div className="space-y-4">
          <div className="flex items-center justify-between border-b border-[#E2E8F0] pb-2 px-2">
            <h4 className="font-bold text-[#0F172A] flex items-center gap-2">
              <CheckCircle2 size={18} className="text-emerald-500" />
              {scenes.length} Cenas Geradas
            </h4>
          </div>

          <div className="grid grid-cols-1 gap-4 mt-4">
            {scenes.map((scene) => (
              <div key={scene.id} className="bg-white border border-[#E2E8F0] rounded-xl p-4 shadow-sm hover:border-[#14B8A6] transition group">
                <div className="flex items-center justify-between mb-3 border-b border-[#E2E8F0] pb-2">
                  <span className="font-bold text-[#14B8A6] bg-[#F0FDFA] px-2 py-1 rounded text-sm">
                    Cena {scene.id}
                  </span>
                  <span className="text-xs text-[#64748B] font-mono">
                    {scene.scriptText.split(/\s+/).length} palavras
                  </span>
                </div>
                
                <div className="space-y-4">
                  <div>
                    <label className="block text-xs font-bold text-[#64748B] uppercase mb-1">
                      Texto do Roteiro (Áudio/Legenda)
                    </label>
                    <textarea 
                      value={scene.scriptText}
                      onChange={(e) => updateSceneText(scene.id, e.target.value)}
                      className="w-full text-sm text-[#0F172A] bg-[#F8FAFC] border border-[#E2E8F0] rounded p-2 outline-none focus:border-[#14B8A6] resize-y min-h-[80px]"
                    />
                  </div>
                  
                  <div>
                    <label className="block text-xs font-bold text-[#64748B] uppercase mb-1">
                      Prompt Visual (Imagem)
                    </label>
                    <textarea 
                      value={scene.visualPrompt}
                      onChange={(e) => updateScenePrompt(scene.id, e.target.value)}
                      className="w-full text-sm text-[#0F172A] bg-[#F8FAFC] border border-[#E2E8F0] rounded p-2 outline-none focus:border-[#F97316] resize-y min-h-[60px]"
                    />
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};
