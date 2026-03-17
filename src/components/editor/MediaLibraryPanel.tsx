import React, { useState } from 'react';
import { FolderOpen, Search, Image, Mic, Film, Upload } from 'lucide-react';

type MediaTab = 'files' | 'pexels' | 'ai';

export function MediaLibraryPanel() {
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

      {/* Search */}
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

      {/* Content Area */}
      <div className="flex-1 flex flex-col items-center justify-center p-6 overflow-y-auto custom-scrollbar">
        <div
          className="flex flex-col items-center gap-3 p-6 rounded-xl border-2 border-dashed w-full max-w-[200px]"
          style={{ borderColor: 'var(--df-border)' }}
        >
          <div
            className="w-12 h-12 rounded-xl flex items-center justify-center"
            style={{ backgroundColor: 'var(--df-bg-hover)' }}
          >
            {activeTab === 'files' && <FolderOpen size={22} className="text-theme-muted" />}
            {activeTab === 'pexels' && <Search size={22} className="text-theme-muted" />}
            {activeTab === 'ai' && <Image size={22} className="text-theme-muted" />}
          </div>
          <span className="text-xs text-theme-muted text-center leading-relaxed">
            {activeTab === 'files' && 'Arraste arquivos aqui ou clique para importar'}
            {activeTab === 'pexels' && 'Busque imagens e vídeos no Pexels'}
            {activeTab === 'ai' && 'Gere imagens com inteligência artificial'}
          </span>
        </div>

        {/* Quick Media Icons */}
        <div className="flex items-center gap-4 mt-6">
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
      </div>
    </div>
  );
}
