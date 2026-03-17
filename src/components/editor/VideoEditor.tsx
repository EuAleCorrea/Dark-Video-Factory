import React, { useState, useRef, useCallback, useEffect } from 'react';
import { MediaLibraryPanel } from './MediaLibraryPanel';
import { PreviewPanel } from './PreviewPanel';
import { PropertiesPanel } from './PropertiesPanel';
import { TimelinePanel } from './TimelinePanel';
import { EditorProject, createEmptyEditorProject } from '../../types/editor';

// ─── Layout Constraints ──────────────────────────────────────
const MIN_LEFT = 180;
const MAX_LEFT = 500;
const DEFAULT_LEFT = 260;

const MIN_RIGHT = 200;
const MAX_RIGHT = 500;
const DEFAULT_RIGHT = 280;

const MIN_TIMELINE = 120;
const MAX_TIMELINE = 500;
const DEFAULT_TIMELINE = 250;

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
        [isVertical ? 'width' : 'height']: '5px',
        position: 'relative',
        zIndex: 30,
        flexShrink: 0,
      }}
    >
      {/* Visual Indicator */}
      <div
        className="editor-resize-indicator"
        style={{
          position: 'absolute',
          [isVertical ? 'left' : 'top']: '50%',
          transform: isVertical ? 'translateX(-50%)' : 'translateY(-50%)',
          [isVertical ? 'width' : 'height']: '1px',
          [isVertical ? 'height' : 'width']: '100%',
          backgroundColor: 'var(--df-border)',
          transition: 'background-color 0.15s',
        }}
      />
    </div>
  );
}

// ─── Main Component ─────────────────────────────────────────
export function VideoEditor() {
  // Panel sizes
  const [leftWidth, setLeftWidth] = useState(DEFAULT_LEFT);
  const [rightWidth, setRightWidth] = useState(DEFAULT_RIGHT);
  const [timelineHeight, setTimelineHeight] = useState(DEFAULT_TIMELINE);

  // Editor project state
  const [project] = useState<EditorProject>(() => createEmptyEditorProject('Novo Projeto'));

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

  return (
    <div className="flex flex-col h-full overflow-hidden" style={{ backgroundColor: 'var(--df-bg-primary)' }}>
      {/* ─── Top Section (3 columns) ─── */}
      <div className="flex flex-1 overflow-hidden min-h-0">
        {/* Left Panel — Media Library */}
        <div
          className="editor-panel shrink-0 overflow-hidden"
          style={{ width: `${leftWidth}px` }}
        >
          <MediaLibraryPanel />
        </div>

        {/* Resize Handle: Left ↔ Center */}
        <ResizeHandle
          direction="vertical"
          onMouseDown={(e) => handleMouseDown('left', e)}
        />

        {/* Center Panel — Preview */}
        <div className="editor-panel flex-1 overflow-hidden min-w-[300px]">
          <PreviewPanel resolution={project.resolution} />
        </div>

        {/* Resize Handle: Center ↔ Right */}
        <ResizeHandle
          direction="vertical"
          onMouseDown={(e) => handleMouseDown('right', e)}
        />

        {/* Right Panel — Properties */}
        <div
          className="editor-panel shrink-0 overflow-hidden"
          style={{ width: `${rightWidth}px` }}
        >
          <PropertiesPanel />
        </div>
      </div>

      {/* Resize Handle: Top ↔ Timeline */}
      <ResizeHandle
        direction="horizontal"
        onMouseDown={(e) => handleMouseDown('timeline', e)}
      />

      {/* Bottom Panel — Timeline */}
      <div
        className="editor-panel shrink-0 overflow-hidden"
        style={{ height: `${timelineHeight}px` }}
      >
        <TimelinePanel tracks={project.tracks} />
      </div>
    </div>
  );
}
