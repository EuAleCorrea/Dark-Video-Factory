import React from 'react';
import { EditorShell } from './EditorShell';
import { EngineConfig, ChannelProfile } from '../../types';

interface VideoEditorProps {
  config: EngineConfig;
  profiles: ChannelProfile[];
  activeProfileId?: string;
}

/**
 * Legacy entry point for the Visual Editor.
 * Now using EditorShell as the core layout engine.
 */
export function VideoEditor({ config, profiles, activeProfileId }: VideoEditorProps) {
  return (
    <EditorShell 
      config={config} 
      profiles={profiles}
      activeProfileId={activeProfileId}
    />
  );
}

export default VideoEditor;
