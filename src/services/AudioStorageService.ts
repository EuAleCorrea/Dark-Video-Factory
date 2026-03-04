/**
 * AudioStorageService — Stores audio binary on disk via DiskStorageService.
 *
 * Replaces IndexedDB with native filesystem storage.
 * Audio files are stored at: projects/{projectId}/audio.wav (or audio_compressed.mp3)
 */

import * as DiskStorage from './DiskStorageService';
import { convertFileSrc } from '@tauri-apps/api/core';

/**
 * Resolves a storage key to a relative file path.
 * - "projectId" → projects/{projectId}/audio.wav
 * - "projectId_compressed" → projects/{projectId}/audio_compressed.mp3
 */
function resolveAudioPath(key: string): string {
    if (key.endsWith('_compressed')) {
        const projectId = key.replace('_compressed', '');
        return DiskStorage.joinPath('projects', projectId, 'audio_compressed.mp3');
    }
    return DiskStorage.joinPath('projects', key, 'audio.wav');
}

/** Saves audio binary (Uint8Array) to disk with key = projectId */
export async function saveAudio(projectId: string, wavData: Uint8Array): Promise<void> {
    const path = resolveAudioPath(projectId);
    await DiskStorage.writeBinary(path, wavData);
    console.log(`[AudioStorage] 💾 Saved: ${path} (${(wavData.length / 1024).toFixed(0)} KB)`);
}

/** Loads audio from disk and returns as Blob URL for playback */
export async function loadAudioBlobUrl(projectId: string): Promise<string | null> {
    const path = resolveAudioPath(projectId);
    const absPath = await DiskStorage.getAbsolutePath(path);
    const fileExists = await DiskStorage.exists(path);
    if (!fileExists) return null;
    // Use convertFileSrc for direct asset:// URL — more efficient than reading bytes
    return convertFileSrc(absPath);
}

/** Loads raw audio from disk as Uint8Array (for FFmpeg processing) */
export async function loadAudioRaw(projectId: string): Promise<Uint8Array | null> {
    const path = resolveAudioPath(projectId);
    return DiskStorage.readBinary(path);
}

/** Deletes audio file from disk */
export async function deleteAudio(projectId: string): Promise<void> {
    const path = resolveAudioPath(projectId);
    await DiskStorage.deleteFile(path);
}
