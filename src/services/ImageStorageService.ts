/**
 * ImageStorageService — Stores image binary on disk via DiskStorageService.
 *
 * Stores scene-specific images at: projects/{projectId}/scenes/scene_{sceneId}_{variant}.png
 */

import * as DiskStorage from './DiskStorageService';
import { convertFileSrc } from '@tauri-apps/api/core';

/** 
 * Saves scene-specific image binary to projects/{projectId}/scenes/scene_{sceneId}.png 
 * Supports base64 Data URL or Uint8Array.
 */
export async function saveSceneImage(projectId: string, sceneId: number, data: string | Uint8Array): Promise<string> {
    const path = DiskStorage.joinPath('projects', projectId, 'scenes', `scene_${sceneId}.png`);
    
    if (typeof data === 'string' && data.startsWith('data:')) {
        // Extract base64 part from Data URL
        const base64 = data.split(',')[1];
        await DiskStorage.writeBase64(path, base64);
    } else if (data instanceof Uint8Array) {
        await DiskStorage.writeBinary(path, data);
    } else {
        throw new Error("Formato de dados de imagem inválido (esperado DataURL ou Uint8Array)");
    }
    
    console.log(`[ImageStorage] 🎨 Scene ${sceneId} image saved: ${path}`);
    return path;
}

/** Loads image from disk and returns as asset:// URL for <img> tags */
export async function loadSceneImageSrc(projectId: string, sceneId: number): Promise<string | null> {
    const path = DiskStorage.joinPath('projects', projectId, 'scenes', `scene_${sceneId}.png`);
    const fileExists = await DiskStorage.exists(path);
    if (!fileExists) return null;
    
    const absPath = await DiskStorage.getAbsolutePath(path);
    return convertFileSrc(absPath);
}

/** Deletes image file from disk */
export async function deleteSceneImage(projectId: string, sceneId: number): Promise<void> {
    const path = DiskStorage.joinPath('projects', projectId, 'scenes', `scene_${sceneId}.png`);
    await DiskStorage.deleteFile(path);
}
