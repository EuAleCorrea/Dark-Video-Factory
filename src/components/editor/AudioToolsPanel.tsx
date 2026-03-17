import React, { useState } from 'react';
import { GoogleTTSPanel } from '../GoogleTTSPanel';
import { ElevenLabsPanel } from '../ElevenLabsPanel';
import { ExtractAudioPanel } from '../ExtractAudioPanel';
import { EngineConfig } from '../../types';
import { Mic, Speech, Music, Scissors } from 'lucide-react';

interface AudioToolsPanelProps {
  config: EngineConfig;
}

type AudioSubTab = 'google' | 'eleven' | 'extract';

export const AudioToolsPanel: React.FC<AudioToolsPanelProps> = ({ config }) => {
  const [activeSubTab, setActiveSubTab] = useState<AudioSubTab>('google');

  const tabs: { id: AudioSubTab; label: string; icon: any }[] = [
    { id: 'google', label: 'Google TTS', icon: Speech },
    { id: 'eleven', label: 'ElevenLabs', icon: Mic },
    { id: 'extract', label: 'Extrair', icon: Scissors },
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
      <div className="flex-1 overflow-y-auto custom-scrollbar p-4">
        {activeSubTab === 'google' && (
          <div className="bg-theme-primary rounded-2xl border border-theme overflow-hidden">
            <GoogleTTSPanel config={config} onClose={() => {}} />
          </div>
        )}
        
        {activeSubTab === 'eleven' && (
          <div className="bg-theme-primary rounded-2xl border border-theme overflow-hidden">
            <ElevenLabsPanel 
              apiKey={config.apiKeys.elevenLabs} 
              onClose={() => {}} 
            />
          </div>
        )}

        {activeSubTab === 'extract' && (
          <div className="bg-theme-primary rounded-2xl border border-theme overflow-hidden p-4">
            <h3 className="text-sm font-bold text-theme-primary mb-4 flex items-center gap-2">
              <Scissors size={16} className="text-primary" />
              Extração de Áudio de Vídeos
            </h3>
            <ExtractAudioPanel config={config} />
          </div>
        )}
      </div>
    </div>
  );
};

export default AudioToolsPanel;
