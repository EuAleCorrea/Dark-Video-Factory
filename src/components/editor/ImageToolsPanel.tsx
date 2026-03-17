import React, { useState } from 'react';
import { ImageGeneratorPanel } from '../ImageGeneratorPanel';
import { EngineConfig } from '../../types';
import { ImageIcon, Sparkles, FolderHeart } from 'lucide-react';
import { useImageLibrary } from '../../hooks/useImageLibrary';
import { useStatusModal } from '../../contexts/StatusModalContext';
import { GeneratedImage } from '../../types/images';

interface ImageToolsPanelProps {
  config: EngineConfig;
}

type ImageSubTab = 'generate' | 'library';

export const ImageToolsPanel: React.FC<ImageToolsPanelProps> = ({ config }) => {
  const [activeSubTab, setActiveSubTab] = useState<ImageSubTab>('generate');
  const status = useStatusModal();
  const { images, handleDownload, handleRemove } = useImageLibrary(status.error);

  const tabs: { id: ImageSubTab; label: string; icon: any }[] = [
    { id: 'generate', label: 'Gerar', icon: Sparkles },
    { id: 'library', label: 'Biblioteca', icon: FolderHeart },
  ];

  return (
    <div className="flex flex-col h-full bg-theme-secondary overflow-hidden">
      {/* Sub-tabs header */}
      <div className="flex items-center gap-1 p-2 bg-theme-primary border-b border-theme overflow-x-auto no-scrollbar">
        {tabs.map((tab) => {
          const isActive = activeSubTab === tab.id;
          const Icon = tab.icon;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveSubTab(tab.id)}
              className={`
                flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-bold transition-all whitespace-nowrap
                ${isActive 
                  ? 'bg-primary text-white shadow-lg shadow-primary/20' 
                  : 'text-theme-muted hover:text-theme-primary hover:bg-theme-hover'
                }
              `}
            >
              <Icon size={14} />
              {tab.label}
            </button>
          );
        })}
      </div>

      {/* Tools Content */}
      <div className="flex-1 overflow-y-auto custom-scrollbar">
        {activeSubTab === 'generate' && (
          <div className="h-full bg-theme-primary">
            {/* Note: ImageGeneratorPanel has its own internal styling and padding, we might need to adjust it later */}
            <ImageGeneratorPanel config={config} />
          </div>
        )}
        
        {activeSubTab === 'library' && (
          <div className="p-4 flex flex-col gap-4">
            <h3 className="text-sm font-bold text-theme-primary mb-2 flex items-center gap-2">
              <ImageIcon size={16} className="text-primary" />
              Imagens Geradas
            </h3>
            
            {images.length > 0 ? (
              <div className="grid grid-cols-2 gap-3">
                {images.map((image: GeneratedImage) => (
                  <div key={image.id} className="group relative aspect-square rounded-xl overflow-hidden border border-theme bg-theme-hover">
                    <img 
                      src={image.url} 
                      alt={image.prompt} 
                      className="w-full h-full object-cover transition-transform group-hover:scale-110"
                    />
                    <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2">
                      <button 
                         onClick={() => handleDownload(image)}
                         className="p-1.5 bg-white/20 hover:bg-white/40 rounded-lg text-white"
                         title="Download"
                      >
                        <ImageIcon size={14} />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center py-12 text-center text-theme-muted">
                <ImageIcon size={40} strokeWidth={1} className="mb-3 opacity-20" />
                <p className="text-xs">Nenhuma imagem gerada ainda.</p>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

export default ImageToolsPanel;
