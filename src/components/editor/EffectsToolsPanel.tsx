import React from 'react';
import { Sparkles, Wand2, Scissors, Zap } from 'lucide-react';

export const EffectsToolsPanel: React.FC = () => {
  return (
    <div className="flex flex-col h-full bg-theme-secondary animate-in fade-in duration-300">
      <div className="p-4 border-b border-theme bg-theme-primary/30">
        <h3 className="text-sm font-bold text-theme-primary flex items-center gap-2">
          <Sparkles size={16} className="text-primary" />
          Efeitos e Filtros
        </h3>
        <p className="text-xs text-theme-muted mt-1">Aplique efeitos visuais e transições aos clips.</p>
      </div>

      <div className="flex-1 p-4 flex flex-col items-center justify-center text-center gap-4">
        <div className="w-16 h-16 bg-theme-hover rounded-full flex items-center justify-center text-theme-muted">
          <Zap size={32} />
        </div>
        <div>
          <h4 className="text-sm font-semibold text-theme-primary">Efeitos em Breve</h4>
          <p className="text-xs text-theme-muted max-w-[200px] mt-2 leading-relaxed">
            Estamos preparando filtros cinematográficos e transições suaves para seus vídeos dark.
          </p>
        </div>
        
        <div className="grid grid-cols-2 gap-2 w-full mt-4">
          {[
            { icon: Wand2, label: 'Filtros' },
            { icon: Sparkles, label: 'Partículas' },
            { icon: Zap, label: 'Glitches' },
            { icon: Scissors, label: 'Transições' }
          ].map(tool => (
            <div key={tool.label} className="p-3 bg-theme-primary border border-theme rounded-xl flex flex-col items-center gap-2 opacity-50">
              <tool.icon size={18} className="text-theme-muted" />
              <span className="text-[10px] font-medium text-theme-muted">{tool.label}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};
