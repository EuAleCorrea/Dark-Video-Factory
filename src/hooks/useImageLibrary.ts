import { useState, useEffect, useCallback } from 'react';
import { save, open as openDialog } from '@tauri-apps/plugin-dialog';
import { invoke, convertFileSrc } from '@tauri-apps/api/core';
import { mkdir, exists, writeFile, readDir, readFile, BaseDirectory, remove } from '@tauri-apps/plugin-fs';
import { join, pictureDir } from '@tauri-apps/api/path';
import type { GeneratedImage } from '../types/images';

const DIR = 'DarkVideoFactory/Generated';

export function useImageLibrary(statusError: (msg: string) => void) {
    const [images, setImages] = useState<GeneratedImage[]>([]);

    const loadSavedImages = useCallback(async () => {
        try {
            const dirExists = await exists(DIR, { baseDir: BaseDirectory.Picture });
            if (!dirExists) return;

            const entries = await readDir(DIR, { baseDir: BaseDirectory.Picture });
            const picDir = await join(await pictureDir(), 'DarkVideoFactory', 'Generated');

            const allImages = entries
                .filter(entry => entry.name && (entry.name.endsWith('.png') || entry.name.endsWith('.jpg') || entry.name.endsWith('.webp')));

            allImages.sort((a, b) => (b.name ?? '').localeCompare(a.name ?? ''));
            const recentEntries = allImages.slice(0, 3);

            const loadedImages: GeneratedImage[] = await Promise.all(
                recentEntries.map(async entry => {
                    const fullPath = await join(picDir, entry.name);
                    return {
                        id: entry.name,
                        url: convertFileSrc(fullPath),
                        prompt: 'Imagem Salva',
                        aspectRatio: '16:9',
                        timestamp: 0
                    };
                })
            );

            setImages(loadedImages);
        } catch (e) {
            console.error('Failed to load saved images:', e);
        }
    }, []);

    useEffect(() => {
        loadSavedImages();
    }, [loadSavedImages]);

    const autoSaveImage = async (url: string, id: string): Promise<string | null> => {
        try {
            const dirExists = await exists(DIR, { baseDir: BaseDirectory.Picture });
            if (!dirExists) {
                await mkdir(DIR, { baseDir: BaseDirectory.Picture, recursive: true });
            }

            const response = await fetch(url);
            const blob = await response.blob();
            const arrayBuffer = await blob.arrayBuffer();
            const uint8Array = new Uint8Array(arrayBuffer);

            const now = new Date();
            const timestamp = now.toISOString().replace(/[:.]/g, '-');
            const filename = `${DIR}/${timestamp}_${id}.png`;

            await writeFile(filename, uint8Array, { baseDir: BaseDirectory.Picture });
            console.log("Auto-saved to:", filename);
            return filename;
        } catch (e) {
            console.error("Auto-save failed:", e);
            return null;
        }
    };

    const handleOpenFolder = async (setEditingImage: (img: GeneratedImage) => void) => {
        try {
            const defaultPath = await join(await pictureDir(), 'DarkVideoFactory', 'Generated');
            const selected = await openDialog({
                title: 'Selecionar Imagem para Editar',
                defaultPath,
                multiple: false,
                filters: [{
                    name: 'Imagens',
                    extensions: ['png', 'jpg', 'jpeg', 'webp']
                }]
            });

            if (selected) {
                const filePath = typeof selected === 'string' ? selected : String(selected);
                const fileBytes = await readFile(filePath);
                const extension = filePath.split('.').pop()?.toLowerCase() || 'png';
                const mimeType = extension === 'jpg' || extension === 'jpeg' ? 'image/jpeg'
                    : extension === 'webp' ? 'image/webp'
                        : 'image/png';

                const bytes = new Uint8Array(fileBytes);
                const CHUNK = 8192;
                const chunks: string[] = [];
                for (let i = 0; i < bytes.length; i += CHUNK) {
                    chunks.push(String.fromCharCode(...bytes.subarray(i, i + CHUNK)));
                }
                const base64 = btoa(chunks.join(''));
                const dataUrl = `data:${mimeType};base64,${base64}`;

                setEditingImage({
                    id: 'picked-image',
                    url: dataUrl,
                    prompt: 'Imagem Selecionada',
                    aspectRatio: '16:9',
                    timestamp: Date.now()
                });
            }
        } catch (e) {
            console.error('Failed to open file picker:', e);
        }
    };

    const handleDownload = async (image: GeneratedImage) => {
        try {
            const response = await fetch(image.url);
            const blob = await response.blob();
            const arrayBuffer = await blob.arrayBuffer();
            const byteArray = new Uint8Array(arrayBuffer);

            const filePath = await save({
                filters: [{ name: 'Images', extensions: ['png'] }],
                defaultPath: `generated-${image.id}.png`
            });

            if (filePath) {
                await invoke('write_file', { path: filePath, content: Array.from(byteArray) });
            }
        } catch (err) {
            console.error("Erro ao salvar:", err);
            statusError("Erro ao salvar imagem: " + (err instanceof Error ? err.message : "Erro desconhecido"));
        }
    };

    const handleRemove = async (id: string) => {
        try {
            if (id.includes('.')) {
                await remove(`${DIR}/${id}`, { baseDir: BaseDirectory.Picture });
            }
            setImages(prev => prev.filter(img => img.id !== id));
        } catch (e) {
            console.error("Failed to delete", e);
            statusError("Erro ao deletar imagem.");
        }
    };

    return {
        images,
        setImages,
        autoSaveImage,
        handleOpenFolder,
        handleDownload,
        handleRemove,
        loadSavedImages,
    };
}
