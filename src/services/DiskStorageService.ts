/**
 * DiskStorageService — Central service for reading/writing JSON and binary files to disk.
 *
 * Replaces localStorage and IndexedDB with native Tauri filesystem operations.
 * All data is stored under {PROJECT_DIR}/data/ — on the same drive as the project source.
 * This avoids using C:\AppData which may have limited space.
 */

import { invoke } from '@tauri-apps/api/core';
import { convertFileSrc } from '@tauri-apps/api/core';

let _basePath: string | null = null;
let _sep: string = '\\';

/**
 * Returns the base directory for all app data.
 * Uses the project directory (where the Tauri app runs from) + /data/
 * e.g. Z:\Documentos\Projetos\Dark Video Factory\data
 */
export async function getBasePath(): Promise<string> {
    if (_basePath) return _basePath;
    const projectDir = await invoke<string>('get_project_dir');
    _sep = projectDir.includes('\\') ? '\\' : '/';
    _basePath = `${projectDir}${_sep}data`;
    return _basePath;
}

/** Returns the OS path separator */
export function getSep(): string {
    return _sep;
}

/** Join path segments using the OS separator */
export function joinPath(...parts: string[]): string {
    return parts.join(_sep);
}

/** Ensure a directory exists (creates recursively via write_file trick) */
export async function ensureDir(dirPath: string): Promise<void> {
    const exists = await invoke<boolean>('file_exists', { path: dirPath });
    if (!exists) {
        // write_file auto-creates parent dirs, so we create a temp marker then delete it
        const marker = `${dirPath}${_sep}.init`;
        await invoke('write_file', { path: marker, content: [] });
        await invoke('delete_file_cmd', { path: marker }).catch(() => { });
    }
}

/**
 * Initialize the base directory structure on first boot.
 * Creates: {PROJECT_DIR}/data/ and {PROJECT_DIR}/data/projects/
 */
export async function initStorage(): Promise<void> {
    const base = await getBasePath();
    await ensureDir(base);
    await ensureDir(joinPath(base, 'projects'));
    console.log(`[DiskStorage] ✅ Storage initialized at: ${base}`);
}

// ─── JSON Operations ─────────────────────────────────────

/** Read a JSON file and parse it. Returns null if file doesn't exist. */
export async function readJson<T>(relativePath: string): Promise<T | null> {
    const base = await getBasePath();
    const fullPath = joinPath(base, relativePath);
    try {
        const exists = await invoke<boolean>('file_exists', { path: fullPath });
        if (!exists) return null;
        const bytes = await invoke<number[]>('read_file', { path: fullPath });
        const text = new TextDecoder().decode(new Uint8Array(bytes));
        return JSON.parse(text) as T;
    } catch (e) {
        console.error(`[DiskStorage] Failed to read JSON: ${relativePath}`, e);
        return null;
    }
}

/** Write data as a JSON file. Creates parent dirs automatically. */
export async function writeJson(relativePath: string, data: unknown): Promise<void> {
    const base = await getBasePath();
    const fullPath = joinPath(base, relativePath);
    const text = JSON.stringify(data, null, 2);
    const bytes = Array.from(new TextEncoder().encode(text));
    await invoke('write_file', { path: fullPath, content: bytes });
}

// ─── Binary Operations ───────────────────────────────────

/** Read a binary file. Returns null if not found. */
export async function readBinary(relativePath: string): Promise<Uint8Array | null> {
    const base = await getBasePath();
    const fullPath = joinPath(base, relativePath);
    try {
        const exists = await invoke<boolean>('file_exists', { path: fullPath });
        if (!exists) return null;
        const bytes = await invoke<number[]>('read_file', { path: fullPath });
        return new Uint8Array(bytes);
    } catch (e) {
        console.error(`[DiskStorage] Failed to read binary: ${relativePath}`, e);
        return null;
    }
}

/** Write binary data to a file. Creates parent dirs automatically. */
export async function writeBinary(relativePath: string, data: Uint8Array): Promise<void> {
    const base = await getBasePath();
    const fullPath = joinPath(base, relativePath);
    await invoke('write_file', { path: fullPath, content: Array.from(data) });
}

// ─── File/Directory Operations ───────────────────────────

/** Check if a file or directory exists */
export async function exists(relativePath: string): Promise<boolean> {
    const base = await getBasePath();
    const fullPath = joinPath(base, relativePath);
    return invoke<boolean>('file_exists', { path: fullPath });
}

/** Delete a file */
export async function deleteFile(relativePath: string): Promise<void> {
    const base = await getBasePath();
    const fullPath = joinPath(base, relativePath);
    await invoke('delete_file_cmd', { path: fullPath });
}

/** Delete a directory recursively */
export async function deleteDir(relativePath: string): Promise<void> {
    const base = await getBasePath();
    const fullPath = joinPath(base, relativePath);
    await invoke('delete_dir_cmd', { path: fullPath });
}

/** List subdirectory names inside a directory */
export async function listDirs(relativePath: string): Promise<string[]> {
    const base = await getBasePath();
    const fullPath = joinPath(base, relativePath);
    try {
        const exists = await invoke<boolean>('file_exists', { path: fullPath });
        if (!exists) return [];
        return invoke<string[]>('list_dir_entries', { path: fullPath });
    } catch {
        return [];
    }
}

/**
 * Get the absolute path for a relative path (for convertFileSrc usage).
 * Used when you need to display a file as an asset URL in the webview.
 */
export async function getAbsolutePath(relativePath: string): Promise<string> {
    const base = await getBasePath();
    return joinPath(base, relativePath);
}

/**
 * Get a webview-compatible URL for a file stored in disk storage.
 * Uses Tauri's convertFileSrc to create an asset:// URL.
 */
export async function getAssetUrl(relativePath: string): Promise<string> {
    const absPath = await getAbsolutePath(relativePath);
    return convertFileSrc(absPath);
}
