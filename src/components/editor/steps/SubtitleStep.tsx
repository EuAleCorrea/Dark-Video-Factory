import React, { useState } from 'react';
import { Captions, Wand2, CheckCircle2, AlertCircle, Loader2, Layout, Clock } from 'lucide-react';
import { EngineConfig, ChannelProfile, StoryboardSegment, VideoFormat } from '../../../types';
import { generateSrtContent, generateAssContent } from '../../../lib/subtitleGenerator';
import { smartChunkScript } from '../../../lib/smartChunker';
import { alignStoryboardToAudio } from '../../../lib/alignmentEngine';
import { generateVisualPromptsForSegments } from '../../../services/geminiService';
import { getAudioDuration } from '../../../lib/audioUtils';

interface SubtitleStepProps {
  config: EngineConfig;
  script: string;
  audioUrl?: string; // This should be the blob URL
  audioBytes?: Uint8Array;
  activeProfile?: ChannelProfile;
  onSubtitlesGenerated: (srt: string, ass: string, segments: StoryboardSegment[]) => void;
  status: 'pending' | 'processing' | 'completed' | 'error';
}

export const SubtitleStep: React.FC<SubtitleStepProps> = ({ 
  config, 
  script, 
  audioUrl, 
  audioBytes, 
  activeProfile, 
  onSubtitlesGenerated,
  status: parentStatus
}) => {
  const [isGenerating, setIsGenerating] = useState(false);
  const [segments, setSegments] = useState<StoryboardSegment[]>([]);
  const [error, setError] = useState<string | null>(null);

  const handleGenerate = async () => {
    if (!script) {
        setError("Script não encontrado. Gere o roteiro primeiro.");
        return;
    }
    if (!audioUrl || !audioBytes) {
        setError("Áudio não encontrado. Gere o áudio primeiro.");
        return;
    }

    setIsGenerating(true);
    setError(null);

    try {
        // 1. Get audio duration
        const duration = await getAudioDuration(audioUrl!);
        
        // 2. Chunk script
        const chunks = smartChunkScript(script);
        
        // 3. Convert to StoryboardSegments
        const initialSegments: StoryboardSegment[] = chunks.map(chunk => ({
            id: chunk.id,
            scriptText: chunk.text,
            visualPrompt: '',
            duration: chunk.durationEstimate,
            timeRange: `00:00 - 00:00`
        }));

        // 4. Align to actual audio duration
        const alignedSegments = alignStoryboardToAudio(initialSegments, duration);

        // 5. Generate visual prompts using AI
        const visualStyle = activeProfile?.visualStyle || "cinematic, 8k, detailed, photorealistic";
        const modelId = activeProfile?.scriptingModel || config.scriptingModel || 'gemini-2.0-flash-exp';
        const provider = (activeProfile?.scriptingProvider || config.scriptingProvider || 'GEMINI') as 'GEMINI' | 'OPENAI' | 'OPENROUTER';

        const visualPromptsRaw = await generateVisualPromptsForSegments(
            alignedSegments.map(s => ({ id: s.id, scriptText: s.scriptText })),
            visualStyle,
            modelId,
            provider,
            config
        );

        // Merge prompts back
        const finalSegments: StoryboardSegment[] = alignedSegments.map(seg => {
            const promptObj = visualPromptsRaw.find(p => p.id === seg.id);
            return {
                ...seg,
                visualPrompt: promptObj ? promptObj.visualPrompt : "Cinematic scene, detailed atmosphere"
            };
        });

        setSegments(finalSegments);

        // 6. Generate subtitle files
        const srt = generateSrtContent(finalSegments);
        
        // use provided profile or create a complete dummy fitting the ChannelProfile interface
        const profileForAss: ChannelProfile = activeProfile || {
            id: 'dummy',
            name: 'Default',
            format: VideoFormat.SHORTS,
            visualStyle: visualStyle,
            voiceProfile: '',
            bgmTheme: '',
            subtitleStyle: {
                fontName: 'Montserrat ExtraBold',
                fontSize: 100,
                primaryColor: '#FFFFFF',
                outlineColor: '#000000',
                backgroundColor: '#00000000',
                alignment: 'BOTTOM'
            },
            llmPersona: '',
            scriptingModel: modelId,
            scriptingProvider: provider,
            youtubeCredentials: false
        };

        const ass = generateAssContent(finalSegments, profileForAss);
        onSubtitlesGenerated(srt, ass, finalSegments);
    } catch (err: any) {
        console.error("Erro ao gerar legendas:", err);
        setError(err.message || "Erro desconhecido ao gerar legendas.");
    } finally {
        setIsGenerating(false);
    }
  };

  const updateSegmentPrompt = (id: number, prompt: string) => {
    const updated = segments.map(s => s.id === id ? { ...s, visualPrompt: prompt } : s);
    setSegments(updated);
    
    if (segments.length > 0) {
        const srt = generateSrtContent(updated);
        // Reuse logic from handleGenerate if profile is missing
        const profileForAss: ChannelProfile = activeProfile || {
            id: 'dummy',
            name: 'Default',
            format: VideoFormat.SHORTS,
            visualStyle: "cinematic",
            voiceProfile: '',
            bgmTheme: '',
            subtitleStyle: {
                fontName: 'Montserrat ExtraBold',
                fontSize: 100,
                primaryColor: '#FFFFFF',
                outlineColor: '#000000',
                backgroundColor: '#00000000',
                alignment: 'BOTTOM'
            },
            llmPersona: '',
            scriptingModel: 'gemini-2.0-flash-exp',
            scriptingProvider: 'GEMINI',
            youtubeCredentials: false
        };
        const ass = generateAssContent(updated, profileForAss);
        onSubtitlesGenerated(srt, ass, updated);
    }
  };

  return (
    <div className="space-y-4">
      {/* Action Header */}
      <div className="flex items-center justify-between p-4 bg-theme-secondary/30 rounded-xl border border-theme">
        <div className="flex items-center gap-3">
          <Captions className="text-primary" size={24} />
          <div>
            <h5 className="text-sm font-bold text-theme-primary uppercase tracking-tight">Criação de Storyboard</h5>
            <p className="text-[10px] text-theme-muted uppercase tracking-wider">Chunking, Timing e Visual Prompts</p>
          </div>
        </div>
        <button
          onClick={handleGenerate}
          disabled={isGenerating || !script || !audioUrl}
          className="flex items-center gap-2 px-4 py-2 bg-primary text-white rounded-lg hover:opacity-90 transition-all disabled:opacity-40 shadow-lg shadow-primary/20"
        >
          {isGenerating ? (
            <>
              <Loader2 size={16} className="animate-spin" />
              <span>Processando...</span>
            </>
          ) : (
            <>
              <Wand2 size={16} />
              <span>Gerar Legendas & Prompts</span>
            </>
          )}
        </button>
      </div>

      {error && (
        <div className="p-3 bg-red-500/10 border border-red-500/20 rounded-lg flex items-center gap-3 text-red-500 text-xs">
          <AlertCircle size={14} />
          <span>{error}</span>
        </div>
      )}

      {/* Segments List */}
      <div className="space-y-3 max-h-[400px] overflow-y-auto pr-2 custom-scrollbar">
        {segments.length > 0 ? (
          segments.map((seg) => (
            <div key={seg.id} className="p-4 bg-theme-secondary/20 rounded-xl border border-theme-hover group hover:border-primary/30 transition-all">
              <div className="flex items-center justify-between mb-2">
                <span className="text-[10px] font-black text-primary px-2 py-0.5 bg-primary/10 rounded uppercase tracking-widest leading-none">
                  Segmento #{seg.id}
                </span>
                <span className="text-[10px] font-mono text-theme-muted flex items-center gap-1.5">
                  <Clock size={10} />
                  {seg.timeRange} ({seg.duration}s)
                </span>
              </div>
              
              <p className="text-xs text-theme-primary mb-3 leading-relaxed italic border-l-2 border-theme-hover pl-3">
                "{seg.scriptText}"
              </p>

              <div>
                <label className="block text-[8px] font-bold text-theme-muted uppercase tracking-widest mb-1.5 ml-1">Prompt Visual (FLUX.1)</label>
                <textarea
                  className="w-full bg-theme-primary/30 border border-theme rounded-lg px-3 py-2 text-[10px] text-theme-primary focus:border-primary outline-none resize-none h-16 font-mono leading-tight hover:bg-theme-primary/50 transition-colors"
                  value={seg.visualPrompt}
                  onChange={(e) => updateSegmentPrompt(seg.id, e.target.value)}
                  placeholder="Descreva a imagem para este segmento..."
                />
              </div>
            </div>
          ))
        ) : (
          <div className="flex flex-col items-center justify-center py-12 text-theme-muted opacity-40">
            <Layout size={40} strokeWidth={1} className="mb-3" />
            <p className="text-[10px] font-bold uppercase tracking-widest">Aguardando geração do storyboard</p>
          </div>
        )}
      </div>

      {segments.length > 0 && (
         <div className="pt-4 border-t border-theme flex justify-end">
            <div className="flex items-center gap-2 text-green-500 text-[10px] font-bold uppercase tracking-widest animate-in fade-in slide-in-from-right duration-500">
               <CheckCircle2 size={14} />
               <span>Legendas Alinhadas & Storyboard Pronto</span>
            </div>
         </div>
      )}
    </div>
  );
};
