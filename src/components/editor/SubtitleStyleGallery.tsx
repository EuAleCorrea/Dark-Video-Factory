import React from 'react';
import { SUBTITLE_PRESETS, SubtitlePreset } from '../../lib/subtitlePresets';
import { Palette, CheckCircle2, Layout, Sparkles } from 'lucide-react';

interface SubtitleStyleGalleryProps {
  selectedStyleId?: string;
  onSelect: (preset: SubtitlePreset) => void;
}

export const SubtitleStyleGallery: React.FC<SubtitleStyleGalleryProps> = ({ 
  selectedStyleId, 
  onSelect 
}) => {
  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2 mb-2">
        <Sparkles size={14} className="text-primary" />
        <h6 className="text-[10px] font-black text-theme-muted uppercase tracking-widest">Modelos de Legenda (Presets)</h6>
      </div>

      <div className="grid grid-cols-2 gap-3">
        {SUBTITLE_PRESETS.map((preset) => (
          <button
            key={preset.id}
            onClick={() => onSelect(preset)}
            className={`relative group flex flex-col p-3 rounded-2xl border-2 transition-all text-left overflow-hidden ${
              selectedStyleId === preset.id 
                ? 'border-primary bg-primary/5 shadow-lg shadow-primary/10' 
                : 'border-theme-hover bg-theme-secondary/20 hover:border-theme shadow-sm'
            }`}
          >
            {/* Selection Badge */}
            {selectedStyleId === preset.id && (
              <div className="absolute top-2 right-2 text-primary z-20">
                <CheckCircle2 size={16} fill="currentColor" className="text-white" />
              </div>
            )}

            {/* Static Visual Preview (Mini Canvas) */}
            <div className="h-24 w-full bg-black/40 rounded-xl mb-3 flex items-center justify-center relative overflow-hidden group-hover:bg-black/60 transition-colors">
              <div className="absolute inset-0 opacity-10 bg-gradient-to-tr from-primary/30 to-transparent" />
              
              <span 
                style={{ 
                  fontFamily: preset.fontName,
                  color: preset.primaryColor,
                  fontSize: preset.fontSize * 0.15, // Scale for small preview
                  textShadow: `
                    1px 1px 0px ${preset.outlineColor}, 
                    -1px -1px 0px ${preset.outlineColor}, 
                    1px -1px 0px ${preset.outlineColor}, 
                    -1px 1px 0px ${preset.outlineColor}
                  `
                }}
                className="text-center font-bold px-2 relative z-10 leading-tight uppercase tracking-tight"
              >
                THE QUICK FOX
              </span>
              
              {/* Type Badge */}
              <div className="absolute bottom-1 right-1 text-[8px] font-black text-white/20 uppercase tracking-widest bg-black/40 px-1.5 py-0.5 rounded">
                {preset.animationType}
              </div>
            </div>

            {/* Labels */}
            <div className="space-y-0.5">
              <span className={`text-[10px] font-bold ${selectedStyleId === preset.id ? 'text-theme-primary' : 'text-theme-muted'}`}>
                {preset.name}
              </span>
              <p className="text-[8px] text-theme-muted/60 leading-tight line-clamp-2">
                {preset.description}
              </p>
            </div>
          </button>
        ))}
      </div>
    </div>
  );
};
