import React from 'react';
import { 
  GitBranch, 
  Files, 
  Music, 
  Type, 
  Image as ImageIcon, 
  Sparkles 
} from 'lucide-react';

export type EditorTabItem = 'workflow' | 'media' | 'audio' | 'text' | 'images' | 'effects';

interface EditorTabBarProps {
  activeTab: EditorTabItem;
  onTabChange: (tab: EditorTabItem) => void;
}

const TABS: { id: EditorTabItem; label: string; icon: any }[] = [
  { id: 'workflow', label: 'Workflow', icon: GitBranch },
  { id: 'media', label: 'Mídia', icon: Files },
  { id: 'audio', label: 'Áudio', icon: Music },
  { id: 'text', label: 'Texto', icon: Type },
  { id: 'images', label: 'Imagens', icon: ImageIcon },
  { id: 'effects', label: 'Efeitos', icon: Sparkles },
];

export const EditorTabBar: React.FC<EditorTabBarProps> = ({ activeTab, onTabChange }) => {
  return (
    <div className="h-14 border-b flex items-center px-4 gap-1 overflow-x-auto no-scrollbar border-theme shrink-0" style={{ backgroundColor: 'var(--df-bg-secondary)' }}>
      {TABS.map((tab) => {
        const isActive = activeTab === tab.id;
        const Icon = tab.icon;
        
        return (
          <button
            key={tab.id}
            onClick={() => onTabChange(tab.id)}
            className={`
              flex flex-col items-center justify-center min-w-[80px] h-12 gap-1 rounded-xl transition-all duration-200 group
              ${isActive ? 'text-primary bg-primary/10' : 'text-theme-muted hover:text-theme-primary hocus:bg-theme-hover'}
            `}
          >
            <Icon 
              size={18} 
              className={`transition-transform duration-200 ${isActive ? 'scale-110' : 'group-hover:scale-110'}`} 
              strokeWidth={isActive ? 2.5 : 2}
            />
            <span className={`text-[11px] font-semibold uppercase tracking-wider ${isActive ? 'opacity-100' : 'opacity-70 group-hover:opacity-100'}`}>
              {tab.label}
            </span>
            
            {/* Active Indicator Line */}
            {isActive && (
              <div className="absolute bottom-0 w-8 h-1 bg-primary rounded-t-full shadow-[0_-2px_8px_rgba(var(--df-primary-rgb),0.5)]" />
            )}
          </button>
        );
      })}
    </div>
  );
};

export default EditorTabBar;
