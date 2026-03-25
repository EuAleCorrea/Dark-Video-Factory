import React, { useState } from 'react';
import { 
  FileText, 
  Captions, 
  Palette, 
  Search, 
  Languages, 
  Type, 
  Wand2, 
  Save, 
  ChevronRight, 
  Settings2,
  AlertCircle,
  Hash,
  PenTool,
  Clock,
  Sparkles
} from 'lucide-react';
import { VideoProject, SubtitleConfig, PipelineStage, StoryboardSegment } from '../../types';
import { SubtitleStyleGallery } from './SubtitleStyleGallery';
import { SubtitlePreset } from '../../lib/subtitlePresets';

interface TextToolsPanelProps {
  project: VideoProject;
  config: any; // EngineConfig
}

const FONTS = ['Montserrat ExtraBold', 'Roboto Slab', 'Bebas Neue', 'Courier New', 'Arial Black', 'Outfit', 'Inter'];

export const TextToolsPanel: React.FC<TextToolsPanelProps> = ({ project, config }) => {
  const [activeSubTab, setActiveSubTab] = useState<'script' | 'captions' | 'styles' | 'seo'>('script');
  const [scriptText, setScriptText] = useState(project.stageData.script?.text || '');
  const [subtitleConfig, setSubtitleConfig] = useState<SubtitleConfig>(
    project.stageData.subtitles?.mode === 'manual' // Not really a place for it yet, but using default
    ? {
        fontName: 'Montserrat ExtraBold',
        fontSize: 100,
        primaryColor: '#FFFFFF',
        outlineColor: '#000000',
        backgroundColor: 'rgba(0,0,0,0.5)',
        alignment: 'BOTTOM'
      }
    : {
        fontName: 'Montserrat ExtraBold',
        fontSize: 100,
        primaryColor: '#FFFFFF',
        outlineColor: '#000000',
        backgroundColor: '#000000',
        alignment: 'BOTTOM'
      }
  );


  const renderScriptTab = () => (
    <div className="flex flex-col h-full animate-in fade-in slide-in-from-bottom-2 duration-300">
      <div className="p-4 border-b border-white/5 flex items-center justify-between bg-white/2">
        <div className="flex items-center gap-2">
          <div className="p-1.5 bg-blue-500/10 rounded-lg">
            <FileText size={16} className="text-blue-400" />
          </div>
          <span className="text-xs font-bold text-white/70 uppercase tracking-widest">Editor de Roteiro</span>
        </div>
        <button className="p-2 hover:bg-white/5 rounded-lg text-white/40 hover:text-white transition-colors">
          <Wand2 size={16} />
        </button>
      </div>
      
      <div className="flex-1 relative group">
        <textarea
          value={scriptText}
          onChange={(e) => setScriptText(e.target.value)}
          className="w-full h-full bg-transparent p-6 text-white/90 text-sm leading-relaxed outline-none resize-none font-sans custom-scrollbar"
          placeholder="O roteiro do seu vídeo aparecerá aqui..."
        />
        <div className="absolute bottom-4 right-4 flex items-center gap-2">
            <span className="text-[10px] font-mono text-white/20 bg-black/40 px-2 py-1 rounded-md backdrop-blur-md border border-white/5">
                {scriptText.split(/\s+/).filter(Boolean).length} palavras
            </span>
        </div>
      </div>

      <div className="p-4 bg-white/2 border-t border-white/5">
        <button className="w-full py-3 bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold rounded-xl flex items-center justify-center gap-2 transition-all active:scale-95 shadow-lg shadow-blue-900/20">
          <Save size={16} />
          Salvar Alterações
        </button>
      </div>
    </div>
  );

  const renderCaptionsTab = () => (
    <div className="flex flex-col h-full animate-in fade-in slide-in-from-bottom-2 duration-300">
      <div className="p-4 border-b border-white/5 flex items-center justify-between bg-white/2">
        <div className="flex items-center gap-2">
          <div className="p-1.5 bg-emerald-500/10 rounded-lg">
            <Captions size={16} className="text-emerald-400" />
          </div>
          <span className="text-xs font-bold text-white/70 uppercase tracking-widest">Segmentos & Timing</span>
        </div>
        <button className="text-[10px] font-bold text-emerald-400 bg-emerald-400/10 px-2 py-1 rounded hover:bg-emerald-400/20 transition-colors">
          REGERAR SRT
        </button>
      </div>

      <div className="flex-1 overflow-y-auto custom-scrollbar p-4 space-y-3">
        {project.stageData.subtitles?.segments ? (
          project.stageData.subtitles.segments.map((segment: StoryboardSegment, idx: number) => (
            <div key={idx} className="group bg-white/2 border border-white/5 hover:border-white/10 rounded-2xl p-4 transition-all hover:bg-white/5">
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                  <span className="text-[10px] font-black text-white/20 uppercase tracking-tighter">#{String(idx + 1).padStart(2, '0')}</span>
                  <div className="flex items-center gap-1 text-[10px] font-mono text-white/40">
                    <Clock size={10} />
                    {segment.timeRange}
                  </div>
                </div>
                <div className="opacity-0 group-hover:opacity-100 transition-opacity">
                    <Settings2 size={12} className="text-white/30 cursor-pointer hover:text-white" />
                </div>
              </div>
              <textarea 
                className="w-full bg-transparent text-white/80 text-xs leading-relaxed outline-none resize-none overflow-hidden"
                value={segment.scriptText}
                rows={2}
                onChange={() => {}} // Handle change later
              />
            </div>
          ))
        ) : (
          <div className="h-full flex flex-col items-center justify-center text-center p-8 opacity-40">
            <Languages size={40} className="mb-4" />
            <p className="text-sm font-medium">Nenhuma legenda gerada ainda.</p>
            <p className="text-[10px] mt-2">Processe o estágio de legendas para ver os segmentos aqui.</p>
          </div>
        )}
      </div>
    </div>
  );

  const handleSelectPreset = (preset: SubtitlePreset) => {
    setSubtitleConfig({
      ...subtitleConfig,
      styleId: preset.id,
      fontName: preset.fontName,
      fontSize: preset.fontSize,
      primaryColor: preset.primaryColor,
      outlineColor: preset.outlineColor,
      backgroundColor: preset.backgroundColor,
      animationType: preset.animationType,
      activeColor: preset.activeColor
    });
  };

  const renderStylesTab = () => (
    <div className="flex flex-col h-full animate-in fade-in slide-in-from-bottom-2 duration-300">
      <div className="p-4 border-b border-white/5 flex items-center gap-2 bg-white/2">
        <div className="p-1.5 bg-purple-500/10 rounded-lg">
          <Palette size={16} className="text-purple-400" />
        </div>
        <span className="text-xs font-bold text-white/70 uppercase tracking-widest">Estilização Visual</span>
      </div>

      <div className="flex-1 overflow-y-auto custom-scrollbar p-6 space-y-8">
        {/* Galeria de Presets */}
        <section>
          <SubtitleStyleGallery 
            selectedStyleId={subtitleConfig.styleId} 
            onSelect={handleSelectPreset} 
          />
        </section>

        <div className="h-px bg-white/5" />

        {/* Tipografia */}
        <section className="space-y-4">
          <label className="text-[10px] font-black text-white/30 uppercase tracking-[0.2em] flex items-center gap-2">
            <Type size={12} /> Tipografia
          </label>
          <div className="grid grid-cols-1 gap-3">
             <div className="space-y-2">
                <span className="text-[10px] text-white/40">Família da Fonte</span>
                <select 
                  value={subtitleConfig.fontName}
                  onChange={(e) => setSubtitleConfig({...subtitleConfig, fontName: e.target.value})}
                  className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-2 text-xs text-white outline-none focus:border-purple-500/50 transition-all font-medium"
                >
                  {FONTS.map(f => <option key={f} value={f} className="bg-slate-900">{f}</option>)}
                </select>
             </div>
             <div className="space-y-2">
                <div className="flex justify-between items-center">
                    <span className="text-[10px] text-white/40">Tamanho da Fonte</span>
                    <span className="text-[10px] font-mono text-purple-400">{subtitleConfig.fontSize}px</span>
                </div>
                <input 
                    type="range" min="20" max="250" step="5"
                    value={subtitleConfig.fontSize}
                    onChange={(e) => setSubtitleConfig({...subtitleConfig, fontSize: parseInt(e.target.value)})}
                    className="w-full accent-purple-500 h-1 bg-white/10 rounded-lg appearance-none cursor-pointer" 
                />
             </div>
          </div>
        </section>

        {/* Cores */}
        <section className="space-y-4">
          <label className="text-[10px] font-black text-white/30 uppercase tracking-[0.2em] flex items-center gap-2">
            <Sparkles size={12} /> Esquema de Cores
          </label>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <span className="text-[10px] text-white/40">Principal</span>
              <div className="flex items-center gap-2 p-2 bg-white/5 rounded-xl border border-white/10">
                <input 
                  type="color" 
                  value={subtitleConfig.primaryColor}
                  onChange={(e) => setSubtitleConfig({...subtitleConfig, primaryColor: e.target.value})}
                  className="w-8 h-8 rounded-lg bg-transparent border-0 cursor-pointer overflow-hidden p-0" 
                />
                <span className="text-[10px] font-mono text-white/60">{subtitleConfig.primaryColor.toUpperCase()}</span>
              </div>
            </div>
            <div className="space-y-2">
              <span className="text-[10px] text-white/40">Contorno</span>
              <div className="flex items-center gap-2 p-2 bg-white/5 rounded-xl border border-white/10">
                <input 
                  type="color" 
                  value={subtitleConfig.outlineColor}
                  onChange={(e) => setSubtitleConfig({...subtitleConfig, outlineColor: e.target.value})}
                  className="w-8 h-8 rounded-lg bg-transparent border-0 cursor-pointer overflow-hidden p-0" 
                />
                <span className="text-[10px] font-mono text-white/60">{subtitleConfig.outlineColor.toUpperCase()}</span>
              </div>
            </div>
          </div>
        </section>

        {/* Preview Container */}
        <div className="mt-8 p-8 bg-black/40 rounded-[2rem] border border-white/5 flex items-center justify-center relative overflow-hidden group min-h-[160px]">
           <div className="absolute inset-0 opacity-10 blur-3xl bg-gradient-to-tr from-purple-500 via-transparent to-blue-500" />
           <p 
            style={{ 
                fontFamily: subtitleConfig.fontName, 
                color: subtitleConfig.primaryColor,
                textShadow: `2px 2px 0px ${subtitleConfig.outlineColor}, -2px -2px 0px ${subtitleConfig.outlineColor}, 2px -2px 0px ${subtitleConfig.outlineColor}, -2px 2px 0px ${subtitleConfig.outlineColor}`
            }}
            className="text-2xl text-center relative z-10 font-bold uppercase tracking-tight"
           >
             Estilo de Exemplo
           </p>
           <div className="absolute top-2 left-4 text-[8px] font-black text-white/10 uppercase tracking-widest">Preview Estático</div>
        </div>
      </div>

      <div className="p-4 bg-white/2 border-t border-white/5">
        <button className="w-full py-3 bg-purple-600 hover:bg-purple-500 text-white text-xs font-bold rounded-xl flex items-center justify-center gap-2 transition-all active:scale-95 shadow-lg shadow-purple-900/20">
          <Save size={16} />
          Aplicar Estilo Global
        </button>
      </div>
    </div>
  );

  const renderSEOTab = () => (
    <div className="flex flex-col h-full animate-in fade-in slide-in-from-bottom-2 duration-300">
      <div className="p-4 border-b border-white/5 flex items-center gap-2 bg-white/2">
        <div className="p-1.5 bg-orange-500/10 rounded-lg">
          <Search size={16} className="text-orange-400" />
        </div>
        <span className="text-xs font-bold text-white/70 uppercase tracking-widest">Metadados & Viralidade</span>
      </div>

      <div className="flex-1 overflow-y-auto custom-scrollbar p-6 space-y-6">
        <div className="space-y-4">
          <div className="space-y-2">
             <label className="text-[10px] font-black text-white/30 uppercase tracking-wider flex items-center gap-2">
                <PenTool size={12} /> Título Sugerido
             </label>
             <input 
                type="text"
                defaultValue={project.stageData.script?.title || ""}
                className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-xs text-white outline-none focus:border-orange-500/50 transition-all font-bold"
                placeholder="Título do vídeo..."
             />
          </div>

          <div className="space-y-2">
             <label className="text-[10px] font-black text-white/30 uppercase tracking-wider flex items-center gap-2">
                <FileText size={12} /> Descrição Viral
             </label>
             <textarea 
                defaultValue={project.stageData.script?.description || ""}
                className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-xs text-white/70 outline-none focus:border-orange-500/50 transition-all min-h-[120px] resize-none leading-relaxed"
                placeholder="Descrição para YouTube/Social..."
             />
          </div>

          <div className="space-y-2">
             <label className="text-[10px] font-black text-white/30 uppercase tracking-wider flex items-center gap-2">
                <Hash size={12} /> Tags & SEO
             </label>
             <div className="flex flex-wrap gap-2 p-4 bg-white/5 border border-white/10 rounded-xl">
                 {(project.stageData.script?.tags || []).length > 0 ? (
                     project.stageData.script?.tags?.map((tag: string, i: number) => (
                        <span key={i} className="px-2 py-1 bg-white/5 text-[10px] text-white/50 rounded-md border border-white/5">#{tag}</span>
                     ))
                 ) : (
                    <span className="text-[10px] text-white/20 italic">Nenhuma tag gerada.</span>
                 )}
                 <input 
                    type="text"
                    className="flex-1 bg-transparent text-[10px] outline-none text-orange-400 placeholder:text-white/10"
                    placeholder="+ Adicionar tag..."
                 />
             </div>
          </div>
        </div>

        <div className="bg-orange-500/5 border border-orange-500/10 rounded-2xl p-4 flex gap-4">
             <div className="p-2 bg-orange-500/20 rounded-full h-fit">
                <AlertCircle size={16} className="text-orange-400" />
             </div>
             <div>
                <h5 className="text-[10px] font-bold text-orange-400 uppercase mb-1">Dica Viral</h5>
                <p className="text-[10px] text-white/50 leading-relaxed italic">
                    Use ganchos emocionais nos primeiros 3 segundos. O modelo Gemini gerou estes metadados com base no perfil do seu canal.
                </p>
             </div>
        </div>
      </div>

      <div className="p-4 bg-white/2 border-t border-white/5">
        <button className="w-full py-3 bg-orange-600 hover:bg-orange-500 text-white text-xs font-bold rounded-xl flex items-center justify-center gap-2 transition-all active:scale-95 shadow-lg shadow-orange-900/20">
          <Save size={16} />
          Atualizar Metadados
        </button>
      </div>
    </div>
  );

  return (
    <div className="h-full flex flex-col bg-theme-primary">
      {/* Sub Tabs Navigation */}
      <div className="flex p-2 gap-1 bg-black/20 border-b border-white/5">
        <button 
          onClick={() => setActiveSubTab('script')}
          className={`flex-1 flex items-center justify-center gap-2 py-2 rounded-lg text-[10px] font-bold uppercase tracking-widest transition-all ${activeSubTab === 'script' ? 'bg-white/10 text-white shadow-sm' : 'text-white/40 hover:text-white/60 hover:bg-white/5'}`}
        >
          <FileText size={14} /> Roteiro
        </button>
        <button 
          onClick={() => setActiveSubTab('captions')}
          className={`flex-1 flex items-center justify-center gap-2 py-2 rounded-lg text-[10px] font-bold uppercase tracking-widest transition-all ${activeSubTab === 'captions' ? 'bg-white/10 text-white shadow-sm' : 'text-white/40 hover:text-white/60 hover:bg-white/5'}`}
        >
          <Captions size={14} /> Legendas
        </button>
        <button 
          onClick={() => setActiveSubTab('styles')}
          className={`flex-1 flex items-center justify-center gap-2 py-2 rounded-lg text-[10px] font-bold uppercase tracking-widest transition-all ${activeSubTab === 'styles' ? 'bg-white/10 text-white shadow-sm' : 'text-white/40 hover:text-white/60 hover:bg-white/5'}`}
        >
          <Palette size={14} /> Estilos
        </button>
        <button 
          onClick={() => setActiveSubTab('seo')}
          className={`flex-1 flex items-center justify-center gap-2 py-2 rounded-lg text-[10px] font-bold uppercase tracking-widest transition-all ${activeSubTab === 'seo' ? 'bg-white/10 text-white shadow-sm' : 'text-white/40 hover:text-white/60 hover:bg-white/5'}`}
        >
          <Search size={14} /> SEO
        </button>
      </div>

      {/* Content Area */}
      <div className="flex-1 overflow-hidden">
        {activeSubTab === 'script' && renderScriptTab()}
        {activeSubTab === 'captions' && renderCaptionsTab()}
        {activeSubTab === 'styles' && renderStylesTab()}
        {activeSubTab === 'seo' && renderSEOTab()}
      </div>
    </div>
  );
};

