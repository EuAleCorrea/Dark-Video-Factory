/**
 * AudioStorageService — Stores audio binary on disk via DiskStorageService.
 *
 * Replaces IndexedDB with native filesystem storage.
 * Audio files are stored at: projects/{projectId}/audio.wav (or audio_compressed.mp3)
 */

import * as DiskStorage from './DiskStorageService';
import { invoke, convertFileSrc } from '@tauri-apps/api/core';

/** 
 * Resolves a storage key to a relative file path.
 * - "projectId" → projects/{projectId}/audio.wav
 * - "projectId_compressed" → projects/{projectId}/audio_compressed.mp3
 * - "projectId:scene_N" → projects/{projectId}/scenes/scene_N.wav
 */
export function resolveAudioPath(key: string): string {
    if (key.includes(':scene_')) {
        const [projectId, scenePart] = key.split(':');
        return DiskStorage.joinPath('projects', projectId, 'scenes', `${scenePart}.wav`);
    }
    if (key.endsWith('_compressed')) {
        const projectId = key.replace('_compressed', '');
        return DiskStorage.joinPath('projects', projectId, 'audio_compressed.mp3');
    }
    return DiskStorage.joinPath('projects', key, 'audio.wav');
}

/** Saves scene-specific audio binary to projects/{projectId}/scenes/scene_{sceneId}.wav */
export async function saveSceneAudio(projectId: string, sceneId: number, wavData: Uint8Array): Promise<string> {
    const path = DiskStorage.joinPath('projects', projectId, 'scenes', `scene_${sceneId}.wav`);
    await DiskStorage.writeBinary(path, wavData);
    console.log(`[AudioStorage] 🎙️ Scene ${sceneId} saved: ${path} (${(wavData.length / 1024).toFixed(0)} KB)`);
    return path;
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
    const exists = await DiskStorage.exists(path);
    if (!exists) return null;
    return DiskStorage.readBinary(path);
}

/** 
 * Merges all scene audios into a single audio.wav 
 * Uses FFmpeg concat filter for reliability.
 * @param projectId - The project ID
 * @param sceneIds - Optional array of scene IDs, sorted. If not provided, probes scene_1..scene_50
 */
export async function mergeProjectAudio(projectId: string, sceneIds?: number[]): Promise<string> {
    const scenesPath = DiskStorage.joinPath('projects', projectId, 'scenes');
    const absScenesPath = await DiskStorage.getAbsolutePath(scenesPath);
    const sep = DiskStorage.getSep();

    // If no scene IDs provided, probe for existing files (scene_1..scene_50)
    let ids = sceneIds || [];
    if (ids.length === 0) {
        for (let i = 1; i <= 50; i++) {
            const filePath = DiskStorage.joinPath('projects', projectId, 'scenes', `scene_${i}.wav`);
            const fileExists = await DiskStorage.exists(filePath);
            if (fileExists) {
                ids.push(i);
            }
        }
    }

    if (ids.length === 0) {
        throw new Error("Nenhum áudio de cena encontrado para mesclar.");
    }

    // Cria arquivo de lista para o FFmpeg concat demuxer
    const listContent = ids.map(id => `file '${absScenesPath}${sep}scene_${id}.wav'`).join('\n');
    const listPathRelative = DiskStorage.joinPath('projects', projectId, 'concat_list.txt');
    const listPathAbs = await DiskStorage.getAbsolutePath(listPathRelative);
    
    const bytes = new Uint8Array(new TextEncoder().encode(listContent));
    await DiskStorage.writeBinary(listPathRelative, bytes);

    const outputPathRelative = resolveAudioPath(projectId);
    const outputPathAbs = await DiskStorage.getAbsolutePath(outputPathRelative);

    console.log(`[AudioStorage] 🔀 Merging ${ids.length} scenes into ${outputPathAbs}...`);

    const result = await invoke<{ success: boolean; stderr: string }>('run_ffmpeg', {
        args: ['-y', '-f', 'concat', '-safe', '0', '-i', listPathAbs, '-c', 'copy', outputPathAbs]
    });

    // Limpa arquivo de lista
    await DiskStorage.deleteFile(listPathRelative).catch(() => {});

    if (!result.success) {
        throw new Error(`Erro ao mesclar áudios: ${result.stderr}`);
    }

    console.log(`[AudioStorage] ✅ Merge concluído: ${outputPathAbs}`);
    return outputPathRelative;
}


/** Deletes audio file from disk */
export async function deleteAudio(projectId: string): Promise<void> {
    const path = resolveAudioPath(projectId);
    await DiskStorage.deleteFile(path);
}
