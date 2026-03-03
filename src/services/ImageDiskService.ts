/**
 * ImageDiskService — Salva imagens em disco via Tauri
 * 
 * Resolve o QuotaExceededError do localStorage ao mover imagens
 * para o disco (Pictures/DarkVideoFactory/Generated/) e guardar
 * apenas o path local no stageData dos projetos.
 */

import { invoke, convertFileSrc } from '@tauri-apps/api/core';

const IMG_SUBFOLDER = 'DarkVideoFactory';
const IMG_GENERATED = 'Generated';

/**
 * Returns the base directory for image storage.
 * e.g. C:\Users\user\Pictures\DarkVideoFactory\Generated
 */
async function getImageDir(): Promise<string> {
    // Use the same Pictures dir already configured in capabilities
    const tempDir = await invoke<string>('get_temp_dir');
    const sep = tempDir.includes('\\') ? '\\' : '/';

    // Derive Pictures path from temp dir
    // tempDir = C:\Users\user\AppData\Local\Temp\DarkVideoFactory
    const parts = tempDir.split(sep);
    // Go up to user home (first 3 parts on Windows: C:, Users, username)
    const homeParts = parts.slice(0, 3);
    const picturesDir = [...homeParts, 'Pictures', IMG_SUBFOLDER, IMG_GENERATED].join(sep);

    return picturesDir;
}

/**
 * Downloads/decodes an image and saves it to disk.
 * Returns the local file path.
 * 
 * @param imageUrl - HTTP URL or data:image/...;base64,... 
 * @param projectId - Project ID for subfolder
 * @param segmentId - Segment ID for filename
 */
export async function saveImageToDisk(
    imageUrl: string,
    projectId: string,
    segmentId: number
): Promise<string> {
    const baseDir = await getImageDir();
    const sep = baseDir.includes('\\') ? '\\' : '/';
    const projectDir = `${baseDir}${sep}${projectId}`;
    const filename = `seg_${segmentId}.jpg`;
    const filePath = `${projectDir}${sep}${filename}`;

    let imageBytes: Uint8Array;

    if (imageUrl.startsWith('data:')) {
        // Decode base64
        const base64 = imageUrl.split(',')[1];
        const binaryString = atob(base64);
        imageBytes = new Uint8Array(binaryString.length);
        for (let i = 0; i < binaryString.length; i++) {
            imageBytes[i] = binaryString.charCodeAt(i);
        }
    } else if (imageUrl.startsWith('http')) {
        // Download from URL
        const response = await fetch(imageUrl);
        if (!response.ok) throw new Error(`Download failed: ${response.status}`);
        const blob = await response.blob();
        imageBytes = new Uint8Array(await blob.arrayBuffer());
    } else {
        // Already a local path or unknown format — return as-is
        return imageUrl;
    }

    // Save to disk via Tauri
    await invoke('write_file', { path: filePath, content: Array.from(imageBytes) });
    console.log(`[ImageDisk] 💾 Saved: ${filePath} (${(imageBytes.length / 1024).toFixed(0)} KB)`);

    return filePath;
}

/**
 * Sanitizes all image URLs in segments for localStorage storage.
 * Replaces data: URIs (base64) with a placeholder to prevent QuotaExceededError.
 * HTTP URLs are kept as-is (they're small strings).
 * Local file paths are kept as-is.
 * 
 * This should be called before saving to localStorage.
 */
export function sanitizeSegmentImagesForStorage(
    segments: any[]
): any[] {
    return segments.map(seg => {
        const imageUrl = seg.assets?.imageUrl;
        if (!imageUrl) return seg;

        // Base64 images are the main offender (~500KB-2MB each)
        if (imageUrl.startsWith('data:')) {
            return {
                ...seg,
                assets: {
                    ...seg.assets,
                    imageUrl: '[base64-stripped]' // Will need to re-generate or load from disk
                }
            };
        }

        // HTTP URLs and file paths are small — keep them
        return seg;
    });
}

/**
 * Resolves an image URL for display in the webview.
 * - HTTP URLs → returned as-is
 * - data: URIs → returned as-is 
 * - Local paths → converted via Tauri convertFileSrc
 * - Empty → returns empty string
 */
export function resolveImageSrc(imageUrl: string | undefined): string {
    if (!imageUrl || imageUrl === '[base64-stripped]') return '';
    if (imageUrl.startsWith('data:') || imageUrl.startsWith('http')) return imageUrl;

    // Local file path — needs convertFileSrc from Tauri
    return convertFileSrc(imageUrl);
}
