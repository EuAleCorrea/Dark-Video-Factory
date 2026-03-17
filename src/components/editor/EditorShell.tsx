import React, { useState, useRef, useCallback, useEffect } from 'react';
import { EditorTabBar, EditorTabItem } from './EditorTabBar';
import { MediaLibraryPanel } from './MediaLibraryPanel';
import { PreviewPanel } from './PreviewPanel';
import { PropertiesPanel } from './PropertiesPanel';
import { TimelinePanel } from './TimelinePanel';
import { EditorProject, createEmptyEditorProject, createClip } from '../../types/editor';
import { EngineConfig, ChannelProfile, PipelineStage } from '../../types';
import { AudioToolsPanel } from './AudioToolsPanel';
import { ImageToolsPanel } from './ImageToolsPanel';

import { TextToolsPanel } from './TextToolsPanel';
import { WorkflowPanel } from './WorkflowPanel';
import { EffectsToolsPanel } from './EffectsToolsPanel';
import { ProjectTabs } from './ProjectTabs';
import { EditorPersistenceService } from '../../services/EditorPersistenceService';
import { Save, FolderOpen, MousePointer2 } from 'lucide-react';

const persistence = new EditorPersistenceService();

// ─── Layout Constraints ──────────────────────────────────────
const MIN_LEFT = 220; // Slightly more for tabs content
const MAX_LEFT = 600;
const DEFAULT_LEFT = 320;

const MIN_RIGHT = 200;
const MAX_RIGHT = 500;
const DEFAULT_RIGHT = 280;

const MIN_TIMELINE = 150;
const MAX_TIMELINE = 600;
const DEFAULT_TIMELINE = 300;

// ─── Resize Handle Component ────────────────────────────────
interface ResizeHandleProps {
  direction: 'vertical' | 'horizontal';
  onMouseDown: (e: React.MouseEvent) => void;
}

function ResizeHandle({ direction, onMouseDown }: ResizeHandleProps) {
  const isVertical = direction === 'vertical';

  return (
    <div
      className={`editor-resize-handle ${isVertical ? 'editor-resize-vertical' : 'editor-resize-horizontal'}`}
      onMouseDown={onMouseDown}
      style={{
        cursor: isVertical ? 'col-resize' : 'row-resize',
        [isVertical ? 'width' : 'height']: '4px',
        position: 'relative',
        zIndex: 40,
        flexShrink: 0,
      }}
    >
      <div
        className="editor-resize-indicator"
        style={{
          position: 'absolute',
          [isVertical ? 'left' : 'top']: '50%',
          transform: isVertical ? 'translateX(-50%)' : 'translateY(-50%)',
          [isVertical ? 'width' : 'height']: '1px',
          [isVertical ? 'height' : 'width']: '100%',
          backgroundColor: 'var(--df-border)',
          opacity: 0.5,
          transition: 'all 0.2s',
        }}
      />
    </div>
  );
}

// ─── Main Component ─────────────────────────────────────────
interface EditorShellProps {
  config: EngineConfig;
  profiles: ChannelProfile[];
  activeProfileId?: string;
}

export function EditorShell({ config, profiles, activeProfileId }: EditorShellProps) {
  // Navigation State (Internal to Editor)
  const [activeEditorTab, setActiveEditorTab] = useState<EditorTabItem>('media');
  
  // Panel sizes
  const [leftWidth, setLeftWidth] = useState(DEFAULT_LEFT);
  const [rightWidth, setRightWidth] = useState(DEFAULT_RIGHT);
  const [timelineHeight, setTimelineHeight] = useState(DEFAULT_TIMELINE);

  // Editor project state
  const [currentTime, setCurrentTime] = useState(0);

  // Multi-project history management
  const historyMapRef = useRef<Map<string, { history: EditorProject[], index: number }>>(new Map());
  const [projects, setProjects] = useState<EditorProject[]>([]);
  const [activeProjectId, setActiveProjectId] = useState<string>('');
  const [isLoading, setIsLoading] = useState(true);

  // Initialize storage and load last projects
  useEffect(() => {
    const init = async () => {
      try {
        await persistence.initEditorStorage();
        persistence.updateConfig(config);
        
        const existing = await persistence.listEditorProjects();
        if (existing.length > 0) {
          setProjects(existing);
          setActiveProjectId(existing[0].id);
          existing.forEach(p => {
            historyMapRef.current.set(p.id, { history: [p], index: 0 });
          });
        } else {
          // Fallback if no projects exist
          handleNewProject();
        }
      } catch (e) {
        console.error("Failed to init persistence:", e);
        handleNewProject();
      } finally {
        setIsLoading(false);
      }
    };
    init();
  }, []);

  const activeProject = projects.find(p => p.id === activeProjectId);

  const handleProjectUpdate = useCallback((updated: Partial<EditorProject>) => {
    if (!activeProjectId) return;

    setProjects(prev => prev.map(p => {
      if (p.id === activeProjectId) {
        const newProject = { ...p, ...updated };
        
        // Update history
        const state = historyMapRef.current.get(p.id) || { history: [], index: -1 };
        const newIndex = state.index + 1;
        const newHistory = state.history.slice(0, newIndex).concat(newProject);
        
        if (newHistory.length > 50) newHistory.shift();
        historyMapRef.current.set(p.id, { 
          history: newHistory, 
          index: newHistory.length - 1 
        });

        // Auto-save periodically or on important changes (simplified: every update)
        persistence.saveEditorProject(newProject).catch(console.error);

        return newProject;
      }
      return p;
    }));
  }, [activeProjectId]);

  const undo = useCallback(() => {
    const state = historyMapRef.current.get(activeProjectId);
    if (state && state.index > 0) {
      state.index -= 1;
      const prevProject = state.history[state.index];
      setProjects(prev => prev.map(p => p.id === activeProjectId ? prevProject : p));
    }
  }, [activeProjectId]);

  const redo = useCallback(() => {
    const state = historyMapRef.current.get(activeProjectId);
    if (state && state.index < state.history.length - 1) {
      state.index += 1;
      const nextProject = state.history[state.index];
      setProjects(prev => prev.map(p => p.id === activeProjectId ? nextProject : p));
    }
  }, [activeProjectId]);

  const handleNewProject = useCallback(() => {
    const p = createEmptyEditorProject(`Projeto ${projects.length + 1}`);
    setProjects(prev => [...prev, p]);
    setActiveProjectId(p.id);
    historyMapRef.current.set(p.id, { history: [p], index: 0 });
  }, [projects.length]);

  const handleCloseProject = useCallback((id: string) => {
    if (projects.length <= 1) return; // Don't close last project

    setProjects(prev => {
      const filtered = prev.filter(p => p.id !== id);
      if (activeProjectId === id) {
        setActiveProjectId(filtered[filtered.length - 1].id);
      }
      return filtered;
    });
    historyMapRef.current.delete(id);
  }, [activeProjectId, projects.length]);

  // Keyboard events for undo/redo
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const isInput = e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement;
      if (isInput) return;

      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'z') {
        e.preventDefault();
        if (e.shiftKey) redo(); else undo();
      } else if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'y') {
        e.preventDefault();
        redo();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [undo, redo]);

  // Dummy VideoProject
  const dummyVideoProject = {
    id: 'dummy',
    channelId: 'dummy-channel',
    title: activeProject?.name || 'Sem Título',
    currentStage: PipelineStage.SCRIPT,
    status: 'ready' as const,
    createdAt: activeProject?.createdAt || '',
    updatedAt: activeProject?.updatedAt || '',
    stageData: {
        script: { text: "", title: "", description: "", tags: [], wordCount: 0, mode: 'auto' as const },
        subtitles: { segments: [], srtContent: "", assContent: "", segmentCount: 0, totalDuration: 10, mode: 'auto' as const }
    }
  };

  // Resize logic
  const resizingRef = useRef<{
    type: 'left' | 'right' | 'timeline';
    startPos: number;
    startSize: number;
  } | null>(null);

  const handleMouseDown = useCallback((
    type: 'left' | 'right' | 'timeline',
    e: React.MouseEvent
  ) => {
    e.preventDefault();
    const startPos = type === 'timeline' ? e.clientY : e.clientX;
    const startSize = type === 'left' ? leftWidth : type === 'right' ? rightWidth : timelineHeight;
    resizingRef.current = { type, startPos, startSize };
    document.body.style.cursor = type === 'timeline' ? 'row-resize' : 'col-resize';
    document.body.style.userSelect = 'none';
  }, [leftWidth, rightWidth, timelineHeight]);

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (!resizingRef.current) return;
      const { type, startPos, startSize } = resizingRef.current;

      if (type === 'left') {
        const delta = e.clientX - startPos;
        setLeftWidth(Math.max(MIN_LEFT, Math.min(MAX_LEFT, startSize + delta)));
      } else if (type === 'right') {
        const delta = startPos - e.clientX;
        setRightWidth(Math.max(MIN_RIGHT, Math.min(MAX_RIGHT, startSize + delta)));
      } else if (type === 'timeline') {
        const delta = startPos - e.clientY;
        setTimelineHeight(Math.max(MIN_TIMELINE, Math.min(MAX_TIMELINE, startSize + delta)));
      }
    };

    const handleMouseUp = () => {
      if (resizingRef.current) {
        resizingRef.current = null;
        document.body.style.cursor = '';
        document.body.style.userSelect = '';
      }
    };

    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);

    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };
  }, []);

  // Helper to render left panel content based on tab
  const renderLeftPanel = () => {
    switch (activeEditorTab) {
      case 'workflow':
        return (
          <WorkflowPanel 
            config={config} 
            onProjectUpdate={handleProjectUpdate} 
            project={activeProject} 
            profiles={profiles}
            activeProfileId={activeProfileId}
          />
        );


      case 'audio':
        return <AudioToolsPanel config={config} />;
      case 'images':
        return <ImageToolsPanel config={config} />;
      case 'text':
        return <TextToolsPanel project={dummyVideoProject as any} config={config} />;
      case 'effects':
        return <EffectsToolsPanel />;
      case 'media':
      default:
        return <MediaLibraryPanel config={config} />;
    }
  };



  return (
    <div className="flex flex-col h-full overflow-hidden bg-theme-primary">
      
      {/* Top Header / Project Info Bar */}
      <div className="flex items-center justify-between px-4 h-10 border-b border-theme bg-theme-secondary/30">
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2 text-xs font-semibold text-theme-primary">
            <span className="text-primary uppercase tracking-wider text-[10px]">Editor Mode</span>
            <span className="text-theme-muted">/</span>
            <span>{activeProject?.name || 'Carregando...'}</span>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button 
            onClick={() => activeProject && persistence.saveEditorProject(activeProject)}
            className="flex items-center gap-1.5 px-2.5 py-1 text-[11px] font-medium text-theme-primary hover:bg-theme-secondary rounded transition-colors"
          >
            <Save size={14} className="text-primary" />
            <span>Salvar</span>
          </button>
          <button 
             onClick={async () => {
               const list = await persistence.listEditorProjects();
               console.log("Projetos disponíveis:", list);
               // Aqui poderíamos abrir um modal de "Abrir Projeto" futuramente
             }}
            className="flex items-center gap-1.5 px-2.5 py-1 text-[11px] font-medium text-theme-primary hover:bg-theme-secondary rounded transition-colors"
          >
            <FolderOpen size={14} />
            <span>Abrir</span>
          </button>
        </div>
      </div>

      {/* Editor Sub-Navigation Bar */}
      <EditorTabBar 
        activeTab={activeEditorTab} 
        onTabChange={setActiveEditorTab} 
      />

      {/* Project Tabs (Multi-Project Support) */}
      {!isLoading && projects.length > 0 && (
        <ProjectTabs
          projects={projects}
          activeProjectId={activeProjectId}
          onSelectProject={(id) => {
            setActiveProjectId(id);
            setCurrentTime(0);
          }}
          onCloseProject={handleCloseProject}
          onNewProject={handleNewProject}
        />
      )}

      {/* Resizable Content Area */}
      {isLoading ? (
        <div className="flex-1 flex items-center justify-center text-theme-muted gap-3">
          <div className="animate-spin rounded-full h-5 w-5 border-2 border-primary border-t-transparent"></div>
          <span className="text-sm font-medium">Sincronizando projetos...</span>
        </div>
      ) : (
        <div className="flex-1 flex flex-col overflow-hidden">
          {/* Top Region: Panels */}
          <div className="flex flex-1 overflow-hidden min-h-0">
            {/* LEFT PANEL: Tools/Library */}
            <div
              className="editor-panel shrink-0 overflow-hidden"
              style={{ width: `${leftWidth}px` }}
            >
              {renderLeftPanel()}
            </div>

            <ResizeHandle
              direction="vertical"
              onMouseDown={(e) => handleMouseDown('left', e)}
            />

            {/* CENTER PANEL: Preview */}
            <div className="editor-panel flex-1 overflow-hidden min-w-[300px] border-x border-theme">
              {activeProject ? (
                <PreviewPanel 
                  resolution={activeProject.resolution} 
                  project={activeProject}
                  currentTime={currentTime}
                  onTimeChange={setCurrentTime}
                />
              ) : (
                <div className="flex-1 flex items-center justify-center h-full text-theme-muted italic text-xs">
                   Nenhum projeto ativo
                </div>
              )}
            </div>

            <ResizeHandle
              direction="vertical"
              onMouseDown={(e) => handleMouseDown('right', e)}
            />

            {/* RIGHT PANEL: Properties */}
            <div
              className="editor-panel shrink-0 overflow-hidden"
              style={{ width: `${rightWidth}px` }}
            >
              <PropertiesPanel />
            </div>
          </div>

          <ResizeHandle
            direction="horizontal"
            onMouseDown={(e) => handleMouseDown('timeline', e)}
          />

          {/* BOTTOM REGION: Timeline */}
          <div
            className="editor-panel shrink-0 overflow-hidden"
            style={{ height: `${timelineHeight}px` }}
          >
            {activeProject && (
              <TimelinePanel 
                tracks={activeProject.tracks} 
                currentTime={currentTime}
                onTimeChange={setCurrentTime}
                onUpdateTracks={(tracks) => handleProjectUpdate({ tracks })} 
              />
            )}
          </div>
        </div>
      )}
    </div>
  );
}

export default EditorShell;
