import { createClip, EditorProject, generateId, Track, TrackType } from '../types/editor';
import { EditorPersistenceService } from './EditorPersistenceService';
import { MediaImportService } from './MediaImportService';

/**
 * Media Library Service
 * Bridges the MediaImportService and EditorPersistenceService to handle
 * project-specific media management.
 */
export const MediaLibraryService = {
  /**
   * Imports files and adds them to the project's library metadata.
   */
  async importFilesToProject(project: EditorProject, persistence: EditorPersistenceService): Promise<EditorProject> {
    const newMedia = await MediaImportService.importMediaFiles();
    if (newMedia.length === 0) return project;

    const updatedProject = { ...project };
    if (!updatedProject.metadata) updatedProject.metadata = {};
    
    // Using a custom metadata field 'library' to store imported assets
    const currentLibrary = (updatedProject.metadata as any).library || [];
    
    // Avoid duplicates by path
    const filteredNewMedia = newMedia.filter(
      newItem => !currentLibrary.some((item: any) => item.path === newItem.path)
    );

    (updatedProject.metadata as any).library = [...currentLibrary, ...filteredNewMedia];

    // Save updated project
    await persistence.saveEditorProject(updatedProject);
    
    return updatedProject;
  },

  /**
   * Removes a file from the project's library metadata.
   */
  async removeFileFromProject(project: EditorProject, mediaId: string, persistence: EditorPersistenceService): Promise<EditorProject> {
    const updatedProject = { ...project };
    if (!updatedProject.metadata) return updatedProject;

    const currentLibrary = (updatedProject.metadata as any).library || [];
    const newLibrary = currentLibrary.filter((item: any) => item.id !== mediaId);
    
    (updatedProject.metadata as any).library = newLibrary;

    // Save updated project
    await persistence.saveEditorProject(updatedProject);
    
    return updatedProject;
  },

  /**
   * Helper to determine appropriate track for a media type
   */
  getTrackForType(tracks: Track[], type: string): string | undefined {
    const trackMapping: Record<string, TrackType> = {
      video: 'video',
      image: 'video',
      audio: 'audio',
      subtitle: 'subtitle'
    };

    const targetType = trackMapping[type];
    if (!targetType) return undefined;

    // Find first track of matching type
    const track = tracks.find(t => t.type === targetType);
    return track?.id;
  }
};
