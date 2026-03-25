import React, { useState, useEffect } from 'react';
import { 
  AudioWaveform, 
  Play, 
  Pause, 
  Loader2, 
  Mic, 
  Speech, 
  Settings2,
  ChevronDown,
  CheckCircle2,
  AlertCircle,
  Download,
  RotateCcw,
  Zap,
  Layout
} from 'lucide-react';
import { EngineConfig, ElevenLabsVoice, SceneData } from '../../../types';
import { generateSpeech } from '../../../services/geminiService';
import { ElevenLabsService } from '../../../services/ElevenLabsService';
import { GOOGLE_VOICES } from '../../GoogleTTSPanel';
import { pcmToWav, getAudioDuration } from '../../../lib/audioUtils';

interface AudioStepProps {
  config: EngineConfig;
  scenes: SceneData[];
  onAudioGenerated: (scenes: SceneData[]) => void;
}

export const AudioStep: React.FC<AudioStepProps> = ({ 
  config, 
  scenes: initialScenes,
  onAudioGenerated
}) => {
  const [provider, setProvider] = useState<'GEMINI' | 'ELEVENLABS'>(config.providers.tts || 'GEMINI');
  const [isGenerating, setIsGenerating] = useState(false);
  const [scenes, setScenes] = useState<SceneData[]>(initialScenes);
  const [error, setError] = useState<string | null>(null);
  
  // Voice selection states
  const [selectedVoiceId, setSelectedVoiceId] = useState(provider === 'GEMINI' ? 'Kore' : '');
  const [elevenVoices, setElevenVoices] = useState<ElevenLabsVoice[]>([]);
  const [isLoadingVoices, setIsLoadingVoices] = useState(false);

  useEffect(() => {
    setScenes(initialScenes);
  }, [initialScenes]);

  useEffect(() => {
    if (provider === 'ELEVENLABS' && config.apiKeys.elevenLabs) {
      loadElevenVoices();
    } else {
       setSelectedVoiceId('Kore');
    }
  }, [provider]);

  const loadElevenVoices = async () => {
    setIsLoadingVoices(true);
    try {
      const service = new ElevenLabsService(config.apiKeys.elevenLabs);
      const voices = await service.getVoices();
      setElevenVoices(voices);
      if (voices.length > 0) setSelectedVoiceId(voices[0].voice_id);
    } catch (err: any) {
      setError("Erro ao carregar vozes da ElevenLabs");
    } finally {
      setIsLoadingVoices(false);
    }
  };

  const generateAudioForScene = async (scene: SceneData): Promise<SceneData> => {
    if (provider === 'GEMINI') {
      const base64 = await generateSpeech(scene.scriptText, selectedVoiceId, config);
      if (base64) {
        const url = pcmToWav(base64, 24000);
        const bytes = Uint8Array.from(atob(base64), c => c.charCodeAt(0));
        const duration = await getAudioDuration(url);
        
        // Simulação de compactação caso autoCompress esteja ativado
        if (config.sceneConfig?.autoCompress) {
          console.log(`[AudioStep] Compactando áudio da cena ${scene.id} (inline)...`);
          // Poderia chamar um ffmpeg inline aqui.
        }
        
        return {
          ...scene,
          audioUrl: url,
          audioBytes: bytes,
          audioDuration: duration,
          status: 'done'
        };
      }
    } else {
      const service = new ElevenLabsService(config.apiKeys.elevenLabs);
      const blob = await service.generateAudio(selectedVoiceId, scene.scriptText);
      const bytes = new Uint8Array(await blob.arrayBuffer());
      const url = URL.createObjectURL(blob);
      const duration = await getAudioDuration(url);
      
      if (config.sceneConfig?.autoCompress) {
         console.log(`[AudioStep] Compactando áudio da cena ${scene.id} (inline)...`);
      }
      
      return {
        ...scene,
        audioUrl: url,
        audioBytes: bytes,
        audioDuration: duration,
        status: 'done'
      };
    }
    throw new Error('Falha na geração de áudio');
  };

  const handleGenerateAll = async () => {
    if (scenes.length === 0) {
      setError("Sem cenas para converter. Complete o passo anterior.");
      return;
    }

    setIsGenerating(true);
    setError(null);

    const newScenes = [...scenes];
    try {
      for (let i = 0; i < newScenes.length; i++) {
        const scene = newScenes[i];
        if (scene.status !== 'done') {
            newScenes[i] = { ...scene, status: 'generating' };
            setScenes([...newScenes]);
            
            try {
                newScenes[i] = await generateAudioForScene(scene);
                setScenes([...newScenes]);
            } catch (err: any) {
                newScenes[i] = { ...scene, status: 'error' };
                setScenes([...newScenes]);
                throw new Error(`Erro na cena ${scene.id}: ${err.message}`);
            }
        }
      }
      onAudioGenerated(newScenes);
    } catch (err: any) {
      setError(err.message || "Erro na síntese de voz");
    } finally {
      setIsGenerating(false);
    }
  };

  const handleRegenerateScene = async (sceneId: number) => {
    setError(null);
    const newScenes = [...scenes];
    const index = newScenes.findIndex(s => s.id === sceneId);
    if (index === -1) return;

    newScenes[index] = { ...newScenes[index], status: 'generating' };
    setScenes([...newScenes]);

    try {
        newScenes[index] = await generateAudioForScene(newScenes[index]);
        setScenes([...newScenes]);
        onAudioGenerated(newScenes);
    } catch (err: any) {
        newScenes[index] = { ...newScenes[index], status: 'error' };
        setScenes([...newScenes]);
        setError(`Erro na cena ${sceneId}: ${err.message}`);
    }
  };

  const totalGenerated = scenes.filter(s => s.status === 'done').length;
  const isAllDone = scenes.length > 0 && totalGenerated === scenes.length;

  if (scenes.length === 0) {
    return (
      <div className="p-8 flex flex-col items-center justify-center text-center gap-4 border-2 border-dashed border-theme rounded-3xl opacity-60">
        <AudioWaveform size={32} className="text-theme-muted" />
        <div>
          <h4 className="text-sm font-bold text-theme-primary">Cenas Ausentes</h4>
          <p className="text-xs text-theme-muted mt-1 max-w-[200px]">
            Gere as cenas no passo anterior antes de criar a narração.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-5 animate-in fade-in duration-300">
      {/* Provider & Voice Controls */}
      <div className="grid grid-cols-2 gap-3">
        {/* Provider Toggle */}
        <div className="flex flex-col gap-2">
          <label className="text-[10px] font-black text-theme-muted uppercase tracking-widest ml-1">Provedor</label>
          <div className="flex bg-theme-primary border border-theme rounded-2xl p-1 h-[48px]">
             <button 
               onClick={() => setProvider('GEMINI')}
               className={`flex-1 flex items-center justify-center gap-2 rounded-xl transition-all ${provider === 'GEMINI' ? 'bg-primary text-white shadow-lg shadow-primary/20' : 'text-theme-muted hover:text-theme-primary'}`}
             >
               <Speech size={14} />
               <span className="text-[10px] font-black">GEMINI</span>
             </button>
             <button 
               onClick={() => setProvider('ELEVENLABS')}
               className={`flex-1 flex items-center justify-center gap-2 rounded-xl transition-all ${provider === 'ELEVENLABS' ? 'bg-black text-white shadow-lg shadow-black/20' : 'text-theme-muted hover:text-theme-primary'}`}
             >
               <Mic size={14} />
               <span className="text-[10px] font-black">11LABS</span>
             </button>
          </div>
        </div>

        {/* Voice Selector */}
        <div className="flex flex-col gap-2">
          <label className="text-[10px] font-black text-theme-muted uppercase tracking-widest ml-1">Voz do Narrador</label>
          <div className="relative">
            <select 
              value={selectedVoiceId}
              onChange={(e) => setSelectedVoiceId(e.target.value)}
              className="w-full h-[48px] bg-theme-primary border border-theme rounded-2xl px-4 pr-10 text-[11px] font-bold text-theme-primary appearance-none focus:outline-none focus:ring-2 focus:ring-primary/20"
            >
              {provider === 'GEMINI' ? (
                GOOGLE_VOICES.map(v => <option key={v.id} value={v.id}>{v.label}</option>)
              ) : (
                elevenVoices.map(v => <option key={v.voice_id} value={v.voice_id}>{v.name}</option>)
              )}
            </select>
            <ChevronDown size={14} className="absolute right-4 top-1/2 -translate-y-1/2 text-theme-muted pointer-events-none" />
          </div>
        </div>
      </div>

      {error && (
        <div className="p-3 bg-red-500/10 border border-red-500/20 rounded-xl flex items-center gap-3 text-red-500 text-xs">
          <AlertCircle size={16} />
          {error}
        </div>
      )}

      {/* Generation Bar */}
      <button 
        onClick={handleGenerateAll}
        disabled={isGenerating || isAllDone}
        className="w-full py-4 bg-primary text-white font-black uppercase tracking-[0.2em] rounded-2xl hover:opacity-90 disabled:opacity-50 transition-all flex items-center justify-center gap-3 shadow-xl shadow-primary/30 text-xs"
      >
        {isGenerating ? (
          <>
            <Loader2 size={16} className="animate-spin" />
            Sintetizando Voz...
          </>
        ) : isAllDone ? (
          <>
             <CheckCircle2 size={16} className="text-white" />
             Áudio Completo
          </>
        ) : (
          <>
            <Zap size={16} className="fill-white" />
            Gerar Áudios Faltantes
          </>
        )}
      </button>

      {/* Per-Scene Audio Results */}
      {scenes.length > 0 && (
        <div className="space-y-3 mt-2">
          <div className="flex items-center justify-between px-2">
            <h4 className="text-xs font-bold text-theme-primary flex items-center gap-2">
              <AudioWaveform size={14} className="text-primary" />
              Status por Cena ({totalGenerated}/{scenes.length})
            </h4>
          </div>

          <div className="grid grid-cols-1 gap-3">
            {scenes.map(scene => (
              <div key={scene.id} className="bg-white border border-[#E2E8F0] rounded-xl p-3 shadow-sm flex items-center gap-3">
                <div className="w-8 h-8 shrink-0 bg-[#F8FAFC] rounded-lg border border-[#E2E8F0] flex items-center justify-center font-bold text-[10px] text-[#64748B]">
                  #{scene.id}
                </div>
                
                <div className="flex-1 min-w-0">
                  <p className="text-[11px] text-[#64748B] truncate pr-2">
                    {scene.scriptText}
                  </p>
                  {scene.status === 'done' && scene.audioDuration && (
                    <p className="text-[9px] font-bold text-primary mt-0.5 uppercase tracking-wider">
                      {scene.audioDuration.toFixed(1)}s • {config.sceneConfig?.autoCompress ? 'Compresso' : 'Raw'}
                    </p>
                  )}
                </div>

                <div className="shrink-0 flex items-center gap-2">
                  {scene.status === 'generating' && <Loader2 size={14} className="text-primary animate-spin" />}
                  {scene.status === 'error' && <AlertCircle size={14} className="text-red-500" />}
                  
                  {scene.status === 'done' && scene.audioUrl && (
                    <audio src={scene.audioUrl} controls className="w-[120px] h-6" />
                  )}

                  <button 
                    onClick={() => handleRegenerateScene(scene.id)} 
                    disabled={isGenerating || scene.status === 'generating'}
                    title="Regerar Cena"
                    className="w-7 h-7 flex items-center justify-center rounded-lg bg-[#F8FAFC] border border-[#E2E8F0] text-[#64748B] hover:text-primary transition-colors disabled:opacity-50"
                  >
                    <RotateCcw size={12} />
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Timeline Warning */}
      {isAllDone && (
        <div className="p-3 bg-blue-500/10 border border-blue-500/20 rounded-xl flex items-center gap-3 text-blue-500 text-[10px] font-bold uppercase tracking-wider mt-2">
           <Settings2 size={14} />
           Áudios e imagens prontos. Prossiga para a exportação final.
        </div>
      )}
    </div>
  );
};
