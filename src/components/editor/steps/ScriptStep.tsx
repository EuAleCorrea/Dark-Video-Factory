import React, { useState, useEffect } from 'react';
import { 
  Wand2, 
  FileText, 
  Sparkles, 
  Loader2, 
  CheckCircle2, 
  AlertCircle,
  ChevronDown,
  Layout,
  Tag,
  Copy,
  RotateCcw
} from 'lucide-react';
import { EngineConfig } from '../../../types';
import { rewriteTranscript, structureScript } from '../../../services/geminiService';

interface ScriptStepProps {
  config: EngineConfig;
  transcript: string;
  onScriptGenerated: (script: string, metadata: any) => void;
  initialScript?: string;
  initialMetadata?: any;
}

export const ScriptStep: React.FC<ScriptStepProps> = ({ 
  config, 
  transcript,
  onScriptGenerated,
  initialScript,
  initialMetadata
}) => {
  const [isGenerating, setIsGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  const [rewrittenText, setRewrittenText] = useState(initialScript || '');
  const [metadata, setMetadata] = useState<any>(initialMetadata || null);
  
  const [provider, setProvider] = useState<'GEMINI' | 'OPENAI' | 'OPENROUTER'>(config.providers.scripting || 'GEMINI');
  const [model, setModel] = useState(provider === 'GEMINI' ? 'gemini-1.5-flash' : 'gpt-4o');

  const handleGenerate = async () => {
    if (!transcript) {
      setError('Nenhuma transcrição de referência encontrada. Volte ao passo 1.');
      return;
    }

    setIsGenerating(true);
    setError(null);
    
    try {
      // P1: Rewrite
      const p1Result = await rewriteTranscript(
        transcript, 
        '', // No custom prompt for now
        model,
        provider,
        config
      );
      
      setRewrittenText(p1Result.text);

      // P2: Structure
      const p2Result = await structureScript(
        p1Result.text,
        '', // No custom prompt
        model,
        provider,
        config
      );
      
      setMetadata(p2Result);
      onScriptGenerated(p1Result.text, p2Result);
      
    } catch (err: any) {
      setError(err.message || 'Erro na geração do roteiro');
    } finally {
      setIsGenerating(false);
    }
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    // Could add a toast here
  };

  if (!transcript && !rewrittenText) {
    return (
      <div className="p-8 flex flex-col items-center justify-center text-center gap-4 border-2 border-dashed border-theme rounded-3xl opacity-60">
        <AlertCircle size={32} className="text-theme-muted" />
        <div>
          <h4 className="text-sm font-bold text-theme-primary">Etapa Bloqueada</h4>
          <p className="text-xs text-theme-muted mt-1 max-w-[200px]">
            Você precisa primeiro selecionar e transcrever um vídeo na etapa anterior.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-5 animate-in fade-in duration-300">
      {/* Config Bar */}
      <div className="flex items-center justify-between p-3 bg-theme-primary border border-theme rounded-2xl">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 bg-primary/10 rounded-lg flex items-center justify-center text-primary">
            <Sparkles size={16} />
          </div>
          <div>
            <span className="text-[10px] font-black text-theme-muted uppercase tracking-wider block">Inteligência</span>
            <span className="text-xs font-bold text-theme-primary capitalize">{provider.toLowerCase()} / {model}</span>
          </div>
        </div>
        
        <button 
          onClick={handleGenerate}
          disabled={isGenerating}
          className="px-4 py-2 bg-primary text-white text-[11px] font-black uppercase tracking-widest rounded-xl hover:opacity-90 disabled:opacity-50 transition-all flex items-center gap-2 shadow-lg shadow-primary/20"
        >
          {isGenerating ? (
            <Loader2 size={14} className="animate-spin" />
          ) : (
            <Wand2 size={14} />
          )}
          {rewrittenText ? 'Regerar' : 'Gerar Roteiro'}
        </button>
      </div>

      {error && (
        <div className="p-3 bg-red-500/10 border border-red-500/20 rounded-xl flex items-center gap-3 text-red-500 text-xs">
          <AlertCircle size={16} />
          {error}
        </div>
      )}

      {/* Main Content Area */}
      <div className="flex flex-col gap-4">
        {/* Rewritten Text */}
        <div className="flex flex-col gap-2">
          <div className="flex items-center justify-between ml-1">
            <label className="text-[10px] font-black text-theme-muted uppercase tracking-[0.2em] flex items-center gap-2">
              <FileText size={12} /> Roteiro Final (Narrativo)
            </label>
            {rewrittenText && (
              <button onClick={() => copyToClipboard(rewrittenText)} className="text-theme-muted hover:text-primary transition-colors">
                <Copy size={12} />
              </button>
            )}
          </div>
          <textarea 
            value={rewrittenText}
            onChange={(e) => setRewrittenText(e.target.value)}
            placeholder="O roteiro gerado aparecerá aqui..."
            className="w-full h-48 p-4 bg-theme-hover/30 border border-theme rounded-2xl text-xs text-theme-primary leading-relaxed focus:ring-2 focus:ring-primary/20 transition-all resize-none custom-scrollbar"
          />
        </div>

        {/* Metadata Grid (P2) */}
        {metadata && (
          <div className="grid grid-cols-1 gap-4 animate-in slide-in-from-bottom-2 duration-500">
            {/* Title */}
            <div className="flex flex-col gap-2">
               <label className="text-[10px] font-black text-theme-muted uppercase tracking-[0.2em] ml-1 flex items-center gap-2">
                <Layout size={12} /> Título e Thumb
              </label>
              <div className="p-3 bg-theme-primary border border-theme rounded-xl">
                 <p className="text-xs font-bold text-theme-primary">{metadata.title}</p>
                 <div className="mt-2 text-[9px] font-bold text-primary uppercase bg-primary/10 px-2 py-0.5 rounded inline-block">
                    Thumb: {metadata.thumb_text}
                 </div>
              </div>
            </div>

            {/* Description */}
            <div className="flex flex-col gap-2">
               <label className="text-[10px] font-black text-theme-muted uppercase tracking-[0.2em] ml-1 flex items-center gap-2">
                <FileText size={12} /> Descrição SEO
              </label>
              <div className="p-3 bg-theme-primary border border-theme rounded-xl max-h-24 overflow-y-auto no-scrollbar">
                 <p className="text-[10px] text-theme-muted leading-relaxed line-clamp-3">{metadata.description}</p>
              </div>
            </div>

            {/* Tags */}
            <div className="flex flex-col gap-2">
               <label className="text-[10px] font-black text-theme-muted uppercase tracking-[0.2em] ml-1 flex items-center gap-2">
                <Tag size={12} /> Tags
              </label>
              <div className="flex flex-wrap gap-1.5">
                {metadata.tags?.map((tag: string, i: number) => (
                  <span key={i} className="px-2 py-1 bg-theme-hover border border-theme rounded-lg text-[9px] font-bold text-theme-muted uppercase tracking-wider">
                    {tag}
                  </span>
                ))}
              </div>
            </div>
          </div>
        )}
      </div>

      {isGenerating && (
        <div className="fixed inset-0 z-[110] flex items-center justify-center bg-theme-primary/60 backdrop-blur-sm animate-in fade-in">
           <div className="bg-theme-secondary p-8 rounded-3xl border border-theme shadow-2xl flex flex-col items-center gap-4 max-w-sm text-center">
              <div className="w-16 h-16 bg-primary/10 rounded-full flex items-center justify-center text-primary relative">
                 <Loader2 size={32} className="animate-spin" />
                 <Wand2 size={16} className="absolute -bottom-1 -right-1 text-primary shadow-lg bg-white rounded-full p-0.5" />
              </div>
              <div>
                <h4 className="text-sm font-bold text-theme-primary">Transformando Referência</h4>
                <p className="text-xs text-theme-muted mt-2 px-4">
                  O Gemini está analisando a estrutura viral e reescrevendo o roteiro para torná-lo magnético...
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
