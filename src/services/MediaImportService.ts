import { open } from '@tauri-apps/plugin-dialog';
import { EditorProject, Track, createClip, generateId } from '../types/editor';
import { TimelineEngineService } from './TimelineEngineService';
import { convertFileSrc } from '@tauri-apps/api/core';

// Utility to get duration from a local file via Tauri's convertFileSrc
const getMediaDuration = (path: string, type: 'video' | 'audio'): Promise<number> => {
  return new Promise((resolve) => {
    const url = convertFileSrc(path);
    const element = type === 'video' ? document.createElement('video') : document.createElement('audio');
    
    element.onloadedmetadata = () => {
      resolve(element.duration || 0);
      element.remove();
    };
    
    element.onerror = () => {
      console.warn(`Failed to load metadata for ${path}`);
      resolve(0);
      element.remove();
    };

    element.src = url;
  });
};

/**
 * Media Import Service
 * Handles the logic for selecting local files and adding them to the project database.
 */
export const MediaImportService = {
  /**
   * Opens a native file dialog and imports selected media files.
   * Filters for video, audio, images, and subtitles.
   */
  async importMediaFiles(): Promise<any[]> {
    try {
      const selected = await open({
        multiple: true,
        filters: [
          {
            name: 'Media Files',
            extensions: ['mp4', 'mkv', 'avi', 'mov', 'mp3', 'wav', 'ogg', 'm4a', 'jpg', 'jpeg', 'png', 'webp', 'srt', 'vtt']
          },
          { name: 'Videos', extensions: ['mp4', 'mkv', 'avi', 'mov'] },
          { name: 'Audio', extensions: ['mp3', 'wav', 'ogg', 'm4a'] },
          { name: 'Images', extensions: ['jpg', 'jpeg', 'png', 'webp'] },
          { name: 'Subtitles', extensions: ['srt', 'vtt'] }
        ]
      });

      if (!selected) return [];

      const filePaths = Array.isArray(selected) ? selected : [selected];
      
      // Map files to our library items (async to get durations)
      const libraryItems = await Promise.all(filePaths.map(async path => {
        const fileName = path.split(/[\\/]/).pop() || 'Arquivo sem nome';
        const ext = fileName.split('.').pop()?.toLowerCase() || '';
        
        // Determine type based on extension
        let type: 'video' | 'audio' | 'image' | 'subtitle' = 'video';
        if (['mp3', 'wav', 'ogg', 'm4a'].includes(ext)) type = 'audio';
        else if (['jpg', 'jpeg', 'png', 'webp'].includes(ext)) type = 'image';
        else if (['srt', 'vtt'].includes(ext)) type = 'subtitle';

        let duration = type === 'image' ? 5 : 0;
        
        if (type === 'video' || type === 'audio') {
          duration = await getMediaDuration(path, type);
        }

        return {
          id: generateId(),
          name: fileName,
          path: path,
          type: type,
          thumbnail: type === 'image' ? `asset://${path}` : undefined,
          duration: duration,
          addedAt: new Date().toISOString()
        };
      }));

      return libraryItems;
    } catch (error) {
      console.error('Failed to import media files:', error);
      throw error;
    }
  }
};
