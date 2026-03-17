import React, { useState } from 'react';
import { FolderOpen, Search, Image, Mic, Film, Upload } from 'lucide-react';
import { EngineConfig } from '../../types';
import { PexelsHub } from '../PexelsHub';

type MediaTab = 'files' | 'pexels' | 'ai';

interface MediaLibraryPanelProps {
  config: EngineConfig;
}

export function MediaLibraryPanel({ config }: MediaLibraryPanelProps) {
  const [activeTab, setActiveTab] = useState<MediaTab>('files');

  const tabs: { id: MediaTab; label: string; icon: React.ElementType }[] = [
    { id: 'files', label: 'Arquivos', icon: FolderOpen },
    { id: 'pexels', label: 'Pexels', icon: Search },
    { id: 'ai', label: 'IA', icon: Image },
  ];

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div
        className="flex items-center justify-between px-3 py-2.5 border-b border-theme shrink-0"
        style={{ backgroundColor: 'var(--df-bg-secondary)' }}
      >
        <span className="text-sm font-semibold text-theme-primary">Mídia</span>
        <button
          className="p-1.5 rounded-lg text-theme-muted hover:text-theme-primary transition-colors"
          style={{ cursor: 'pointer' }}
          onMouseEnter={(e) => e.currentTarget.style.backgroundColor = 'var(--df-bg-hover)'}
          onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'transparent'}
          title="Importar arquivos"
        >
          <Upload size={15} />
        </button>
      </div>

      {/* Tabs */}
      <div className="flex border-b border-theme shrink-0" style={{ backgroundColor: 'var(--df-bg-secondary)' }}>
        {tabs.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`flex-1 flex items-center justify-center gap-1.5 py-2 text-xs font-medium transition-all ${
              activeTab === tab.id
                ? 'text-primary border-b-2 border-primary'
                : 'text-theme-muted hover:text-theme-primary'
            }`}
          >
            <tab.icon size={13} />
            {tab.label}
          </button>
        ))}
      </div>

      {/* Search - Ocultar se Pexels estiver ativo pois ele tem busca própria */}
      {activeTab !== 'pexels' && (
        <div className="px-3 py-2 shrink-0" style={{ backgroundColor: 'var(--df-bg-secondary)' }}>
          <div className="relative">
            <Search size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-theme-placeholder" />
            <input
              type="text"
              placeholder="Buscar mídia..."
              className="w-full pl-8 pr-3 py-1.5 text-xs rounded-lg border-theme"
              style={{ backgroundColor: 'var(--df-bg-input)', fontSize: '12px' }}
            />
          </div>
        </div>
      )}

      {/* Content Area */}
      <div className="flex-1 flex flex-col items-center justify-center p-0 overflow-hidden relative">
        {activeTab === 'pexels' ? (
          <div className="w-full h-full overflow-hidden bg-theme-primary">
            {/* PexelsHub in mode='hub' will render full content */}
            <PexelsHub 
              mode="hub" 
              config={config} 
              onSelect={(url, type) => {
                // Future: add to project timeline
                console.log('Selecionado do Pexels:', url, type);
              }}
            />
          </div>
        ) : (
          <div className="flex flex-col items-center p-6 h-full w-full overflow-y-auto custom-scrollbar">
            <div
              className="flex flex-col items-center gap-3 p-6 rounded-xl border-2 border-dashed w-full max-w-[200px] mb-6"
              style={{ borderColor: 'var(--df-border)' }}
            >
              <div
                className="w-12 h-12 rounded-xl flex items-center justify-center"
                style={{ backgroundColor: 'var(--df-bg-hover)' }}
              >
                {activeTab === 'files' && <FolderOpen size={22} className="text-theme-muted" />}
                {activeTab === 'ai' && <Image size={22} className="text-theme-muted" />}
              </div>
              <span className="text-xs text-theme-muted text-center leading-relaxed">
                {activeTab === 'files' && 'Arraste arquivos aqui ou clique para importar'}
                {activeTab === 'ai' && (
                   <div className="flex flex-col gap-2">
                      <span>Dica: Use a tab "Imagens" para criar com IA</span>
                   </div>
                )}
              </span>
            </div>

            {/* Mock Files for Drag & Drop Testing */}
            {activeTab === 'files' && (
              <div className="w-full space-y-2">
                <span className="text-xs font-semibold text-theme-muted mb-2 block">Arquivos de Projeto (Mock)</span>
                {[
                  { id: 'm1', type: 'video', name: 'cena_abertura.mp4', duration: 10, src: 'mock_abertura.mp4' },
                  { id: 'm2', type: 'audio', name: 'musica_fundo.mp3', duration: 30, src: 'mock_musica.mp3' },
                  { id: 'm3', type: 'image', name: 'logo.png', duration: 5, src: 'mock_logo.png' },
                ].map(f => (
                  <div 
                    key={f.id} 
                    className="p-2 border border-theme rounded flex items-center gap-2 cursor-grab transition-colors"
                    style={{ backgroundColor: 'var(--df-bg-secondary)' }}
                    onMouseEnter={e => e.currentTarget.style.backgroundColor = 'var(--df-bg-hover)'}
                    onMouseLeave={e => e.currentTarget.style.backgroundColor = 'var(--df-bg-secondary)'}
                    draggable
                    onDragStart={(e) => {
                      e.dataTransfer.setData('application/json', JSON.stringify({
                         type: 'media',
                         item: f
                      }));
                      e.dataTransfer.effectAllowed = 'copy';
                    }}
                  >
                    <div className="w-8 h-8 rounded shrink-0 flex items-center justify-center" style={{ backgroundColor: 'var(--df-bg-primary)' }}>
                      {f.type === 'video' ? <Film size={14} className="text-blue-500" /> : f.type === 'audio' ? <Mic size={14} className="text-green-500" /> : <Image size={14} className="text-purple-500" />}
                    </div>
                    <div className="flex flex-col flex-1 min-w-0">
                      <span className="text-xs text-theme-primary truncate">{f.name}</span>
                      <span className="text-[10px] text-theme-muted">{f.duration}s</span>
                    </div>
                  </div>
                ))}
              </div>
            )}
            
            {/* Quick Media Icons */}
            {activeTab === 'ai' && (
              <div className="flex items-center gap-4 mt-2">
                {[
                  { icon: Film, label: 'Vídeo' },
                  { icon: Mic, label: 'Áudio' },
                  { icon: Image, label: 'Imagem' },
                ].map((item) => (
                  <div key={item.label} className="flex flex-col items-center gap-1.5 cursor-pointer group">
                    <div
                      className="w-10 h-10 rounded-lg flex items-center justify-center transition-colors"
                      style={{ backgroundColor: 'var(--df-bg-hover)' }}
                    >
                      <item.icon size={18} className="text-theme-muted group-hover:text-primary transition-colors" />
                    </div>
                    <span className="text-[10px] text-theme-muted group-hover:text-theme-primary transition-colors">
                      {item.label}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
