import React from 'react';
import { X, Plus, FileVideo } from 'lucide-react';
import { EditorProject } from '../../types/editor';

interface ProjectTabsProps {
  projects: EditorProject[];
  activeProjectId: string;
  onSelectProject: (id: string) => void;
  onCloseProject: (id: string) => void;
  onNewProject: () => void;
}

export function ProjectTabs({
  projects,
  activeProjectId,
  onSelectProject,
  onCloseProject,
  onNewProject
}: ProjectTabsProps) {
  return (
    <div className="flex items-center bg-theme-primary border-b border-theme h-9 px-2 gap-1 overflow-x-auto no-scrollbar">
      {projects.map((project) => {
        const isActive = project.id === activeProjectId;
        
        return (
          <div
            key={project.id}
            onClick={() => onSelectProject(project.id)}
            className={`
              group relative flex items-center h-7 px-3 gap-2 min-w-[120px] max-w-[200px] 
              rounded-t-md cursor-pointer transition-all text-xs font-medium
              ${isActive 
                ? 'bg-theme-secondary text-theme-primary border-x border-t border-theme border-b-theme-secondary' 
                : 'text-theme-muted hover:bg-theme-secondary/50 hover:text-theme-primary'
              }
            `}
            style={{ marginBottom: '-1px' }}
          >
            <FileVideo size={12} className={isActive ? 'text-primary' : 'text-theme-muted'} />
            <span className="truncate flex-1">{project.name}</span>
            
            <button
              onClick={(e) => {
                e.stopPropagation();
                onCloseProject(project.id);
              }}
              className={`
                p-0.5 rounded-full hover:bg-theme-hover transition-opacity
                ${isActive ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'}
              `}
            >
              <X size={10} />
            </button>

            {/* Active Indicator Line */}
            {isActive && (
              <div className="absolute top-0 left-0 right-0 h-0.5 bg-primary rounded-t-full" />
            )}
          </div>
        );
      })}

      <button
        onClick={onNewProject}
        className="p-1.5 ml-1 rounded-md text-theme-muted hover:text-theme-primary hover:bg-theme-secondary transition-all"
        title="Novo Projeto"
      >
        <Plus size={14} />
      </button>
    </div>
  );
}
