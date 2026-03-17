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
  Zap
} from 'lucide-react';
import { EngineConfig, ElevenLabsVoice } from '../../../types';
import { generateSpeech } from '../../../services/geminiService';
import { ElevenLabsService } from '../../../services/ElevenLabsService';
import { GOOGLE_VOICES } from '../../GoogleTTSPanel';
import { pcmToWav } from '../../../lib/audioUtils';

interface AudioStepProps {
  config: EngineConfig;
  script: string;
  onAudioGenerated: (audioUrl: string, audioBytes: Uint8Array) => void;
  initialAudio?: string;
}

export const AudioStep: React.FC<AudioStepProps> = ({ 
  config, 
  script,
  onAudioGenerated,
  initialAudio
}) => {
  const [provider, setProvider] = useState<'GEMINI' | 'ELEVENLABS'>(config.providers.tts || 'GEMINI');
  const [isGenerating, setIsGenerating] = useState(false);
  const [pcmBase64, setPcmBase64] = useState<string | null>(null);
  const [audioUrl, setAudioUrl] = useState<string | null>(initialAudio || null);
  const [error, setError] = useState<string | null>(null);
  
  // Voice selection states
  const [selectedVoiceId, setSelectedVoiceId] = useState(provider === 'GEMINI' ? 'Kore' : '');
  const [elevenVoices, setElevenVoices] = useState<ElevenLabsVoice[]>([]);
  const [isLoadingVoices, setIsLoadingVoices] = useState(false);

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

  const handleGenerate = async () => {
    if (!script) {
      setError("Sem roteiro para converter. Complete o passo anterior.");
      return;
    }

    setIsGenerating(true);
    setError(null);

    try {
      if (provider === 'GEMINI') {
        const base64 = await generateSpeech(script, selectedVoiceId, config);
        if (base64) {
          setPcmBase64(base64);
          const url = pcmToWav(base64, 24000);
          setAudioUrl(url);
          
          // Convert to bytes for persistent storage/callback
          const bytes = Uint8Array.from(atob(base64), c => c.charCodeAt(0));
          onAudioGenerated(url, bytes);
        }
      } else {
        const service = new ElevenLabsService(config.apiKeys.elevenLabs);
        const blob = await service.generateAudio(selectedVoiceId, script);
        const bytes = new Uint8Array(await blob.arrayBuffer());
        const url = URL.createObjectURL(blob);
        setAudioUrl(url);
        onAudioGenerated(url, bytes);
      }
    } catch (err: any) {
      setError(err.message || "Erro na síntese de voz");
    } finally {
      setIsGenerating(false);
    }
  };

  if (!script && !audioUrl) {
    return (
      <div className="p-8 flex flex-col items-center justify-center text-center gap-4 border-2 border-dashed border-theme rounded-3xl opacity-60">
        <AudioWaveform size={32} className="text-theme-muted" />
        <div>
          <h4 className="text-sm font-bold text-theme-primary">Roteiro Ausente</h4>
          <p className="text-xs text-theme-muted mt-1 max-w-[200px]">
            Você precisa aprovar ou gerar um roteiro no passo 2 antes de criar a narração.
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
        onClick={handleGenerate}
        disabled={isGenerating}
        className="w-full py-4 bg-primary text-white font-black uppercase tracking-[0.2em] rounded-2xl hover:opacity-90 disabled:opacity-50 transition-all flex items-center justify-center gap-3 shadow-xl shadow-primary/30 text-xs"
      >
        {isGenerating ? (
          <>
            <Loader2 size={16} className="animate-spin" />
            Sintetizando Voz...
          </>
        ) : (
          <>
            <Zap size={16} className="fill-white" />
            {audioUrl ? 'Regerar Narração' : 'Gerar Narração'}
          </>
        )}
      </button>

      {/* Audio Results */}
      {audioUrl && !isGenerating && (
        <div className="bg-theme-primary border border-theme rounded-2xl p-5 flex flex-col gap-4 animate-in slide-in-from-bottom-2 duration-500">
           <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                 <div className="w-10 h-10 bg-green-500/10 text-green-500 rounded-full flex items-center justify-center">
                    <CheckCircle2 size={20} />
                 </div>
                 <div>
                    <h4 className="text-xs font-bold text-theme-primary">Narração Concluída</h4>
                    <p className="text-[10px] text-theme-muted uppercase font-bold mt-0.5 tracking-wider">Pronta para a Timeline</p>
                 </div>
              </div>
              <div className="flex items-center gap-1.5">
                 <button className="p-2 hover:bg-theme-hover rounded-lg text-theme-muted transition-colors">
                    <Download size={14} />
                 </button>
                 <button onClick={handleGenerate} className="p-2 hover:bg-theme-hover rounded-lg text-theme-muted transition-colors">
                    <RotateCcw size={14} />
                 </button>
              </div>
           </div>

           <div className="flex flex-col gap-2">
              <audio key={audioUrl} src={audioUrl} controls className="w-full h-8 brightness-95 rounded-lg" />
              <div className="flex justify-between px-1">
                 <span className="text-[9px] font-black text-theme-muted uppercase">Qualidade: High (MP3/WAV)</span>
                 <span className="text-[9px] font-black text-primary uppercase">Mono / 24kHz</span>
              </div>
           </div>
        </div>
      )}

      {/* Timeline Warning */}
      {audioUrl && (
        <div className="p-3 bg-blue-500/10 border border-blue-500/20 rounded-xl flex items-center gap-3 text-blue-500 text-[10px] font-bold uppercase tracking-wider">
           <Settings2 size={14} />
           Áudio será adicionado automaticamente à Timeline ao prosseguir.
        </div>
      )}
    </div>
  );
};
