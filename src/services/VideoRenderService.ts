/**
 * VideoRenderService — Renderiza vídeo final via FFmpeg nativo (Tauri)
 * 
 * Fluxo:
 * 1. Prepara diretório temporário para o projeto
 * 2. Exporta MP3 do disco → arquivo temporário
 * 3. Exporta legendas .ass → arquivo temporário
 * 4. Exporta imagens (download URL ou decode base64) → arquivos temporários
 * 5. Gera concat file para FFmpeg
 * 6. Executa FFmpeg (concat → mp4)
 * 7. Move vídeo final para pasta de destino
 * 8. Limpa arquivos temporários
 */

import { invoke } from '@tauri-apps/api/core';
import { VideoProject, ChannelProfile, VideoFormat, StoryboardSegment } from '../types';
import { loadAudioRaw } from './AudioStorageService';
import { checkFfmpegAvailable } from './AudioCompressService';
import { buildConcatFileContent, buildRenderArgs, RenderScene } from '../lib/ffmpegGenerator';

// --- Types ---

export interface VideoRenderProgress {
    phase: 'preparing' | 'exporting_audio' | 'exporting_images' | 'exporting_subtitles' | 'rendering' | 'saving' | 'cleanup' | 'done';
    current: number;
    total: number;
    message: string;
}

export interface VideoRenderResult {
    outputPath: string;
    duration: number;
    fileSize: number;
    resolution: string;
}

interface FfmpegResult {
    success: boolean;
    stdout: string;
    stderr: string;
    exit_code: number | null;
}

// --- Helper: Get temp path ---

async function getProjectTempDir(projectId: string): Promise<string> {
    const tempBase = await invoke<string>('get_temp_dir');
    const separator = tempBase.includes('\\') ? '\\' : '/';
    return `${tempBase}${separator}render_${projectId}`;
}

async function getOutputDir(): Promise<string> {
    const home = await getHomePath();
    const separator = home.includes('\\') ? '\\' : '/';
    return `${home}${separator}Videos${separator}DarkVideoFactory`;
}

async function getHomePath(): Promise<string> {
    const info = await invoke<{ os: string }>('get_system_info');
    if (info.os === 'windows') {
        // On Windows, use USERPROFILE equivalent — derive from temp dir
        const tempDir = await invoke<string>('get_temp_dir');
        // tempDir is like C:\Users\user\AppData\Local\Temp\DarkVideoFactory
        // We need C:\Users\user
        const parts = tempDir.split('\\');
        if (parts.length >= 3) {
            return parts.slice(0, 3).join('\\');
        }
    }
    // Fallback: use downloads dir and go up
    const downloads = await invoke<string>('get_downloads_dir');
    const sep = downloads.includes('\\') ? '\\' : '/';
    const parts = downloads.split(sep);
    parts.pop(); // Remove "Downloads"
    return parts.join(sep);
}

// --- Helper: Download or decode image to bytes ---

async function imageToBytes(imageUrl: string): Promise<Uint8Array> {
    if (imageUrl.startsWith('data:')) {
        const base64 = imageUrl.split(',')[1];
        const binaryString = atob(base64);
        const bytes = new Uint8Array(binaryString.length);
        for (let i = 0; i < binaryString.length; i++) {
            bytes[i] = binaryString.charCodeAt(i);
        }
        return bytes;
    }

    if (imageUrl.startsWith('http')) {
        const response = await fetch(imageUrl);
        if (!response.ok) throw new Error(`Failed to download image: ${response.status}`);
        const blob = await response.blob();
        return new Uint8Array(await blob.arrayBuffer());
    }

    throw new Error(`Unsupported image URL format: ${imageUrl.substring(0, 50)}...`);
}

// --- Helper: Group segments by sceneId to deduplicate images ---

interface SceneGroup {
    sceneId: number | undefined;
    imageUrl: string;
    totalDuration: number;
    segmentIds: number[];
}

function groupSegmentsIntoScenes(segments: StoryboardSegment[]): SceneGroup[] {
    const groups: SceneGroup[] = [];
    let currentGroup: SceneGroup | null = null;

    for (const seg of segments) {
        const imageUrl = seg.assets?.imageUrl;
        if (!imageUrl) continue;

        // Group by sceneId if available, otherwise by matching imageUrl
        if (currentGroup && (
            (seg.sceneId !== undefined && seg.sceneId === currentGroup.sceneId) ||
            (seg.sceneId === undefined && imageUrl === currentGroup.imageUrl)
        )) {
            // Same scene — accumulate duration
            currentGroup.totalDuration += seg.duration;
            currentGroup.segmentIds.push(seg.id);
        } else {
            // New scene
            currentGroup = {
                sceneId: seg.sceneId,
                imageUrl,
                totalDuration: seg.duration,
                segmentIds: [seg.id],
            };
            groups.push(currentGroup);
        }
    }

    return groups;
}

// --- Main Render Function ---

export async function renderProjectVideo(
    project: VideoProject,
    profile: ChannelProfile,
    onProgress: (progress: VideoRenderProgress) => void
): Promise<VideoRenderResult> {
    const log = (phase: VideoRenderProgress['phase'], message: string, current = 0, total = 0) => {
        console.log(`[VideoRender] ${message}`);
        onProgress({ phase, current, total, message });
    };

    // ==========================================
    // 0. VALIDATION
    // ==========================================
    log('preparing', '🔍 Verificando FFmpeg...');
    const ffmpegInfo = await checkFfmpegAvailable();
    if (!ffmpegInfo.installed) {
        throw new Error(
            'FFmpeg não encontrado! Instale o FFmpeg e adicione ao PATH.\n' +
            'Download: https://ffmpeg.org/download.html'
        );
    }
    log('preparing', `✅ FFmpeg encontrado: ${ffmpegInfo.version}`);

    // Validate required data
    const subtitleData = project.stageData.subtitles;
    const audioCompressData = project.stageData.audio_compress;
    const audioData = project.stageData.audio;

    if (!subtitleData?.segments || subtitleData.segments.length === 0) {
        throw new Error('Segmentos do storyboard não encontrados. Processe o estágio de Legendas primeiro.');
    }

    if (!subtitleData.assContent) {
        throw new Error('Conteúdo ASS de legendas não encontrado. Processe o estágio de Legendas primeiro.');
    }

    // Check that at least some segments have images
    const segmentsWithImages = subtitleData.segments.filter(s => s.assets?.imageUrl);
    if (segmentsWithImages.length === 0) {
        throw new Error('Nenhum segmento tem imagem gerada. Processe o estágio de Imagens primeiro.');
    }

    // Audio source: prefer compressed, fallback to raw
    const audioKey = audioCompressData?.fileUrl?.replace('disk://', '').replace('idb://', '')
        || audioData?.fileUrl?.replace('disk://', '').replace('idb://', '')
        || project.id;
    const audioDuration = subtitleData.totalDuration || audioCompressData?.duration || audioData?.duration || 0;

    if (audioDuration <= 0) {
        throw new Error('Duração do áudio não encontrada. Verifique os estágios de Áudio.');
    }

    // ==========================================
    // 1. PREPARE TEMP DIRECTORY
    // ==========================================
    const tempDir = await getProjectTempDir(project.id);
    const sep = tempDir.includes('\\') ? '\\' : '/';
    log('preparing', `📁 Preparando diretório: ${tempDir}`);

    // ==========================================
    // 2. EXPORT AUDIO (from disk → temp file)
    // ==========================================
    log('exporting_audio', '📥 Exportando áudio...', 0, 1);

    const audioRaw = await loadAudioRaw(audioKey);
    if (!audioRaw || audioRaw.length === 0) {
        throw new Error(`Áudio não encontrado no disco para key="${audioKey}". Processe os estágios de Áudio primeiro.`);
    }

    const audioExt = audioCompressData ? 'mp3' : 'wav';
    const audioPath = `${tempDir}${sep}audio.${audioExt}`;
    await invoke('write_file', { path: audioPath, content: Array.from(audioRaw) });
    log('exporting_audio', `✅ Áudio exportado: ${(audioRaw.length / 1024 / 1024).toFixed(2)} MB`, 1, 1);

    try {
        // ==========================================
        // 3. EXPORT SUBTITLES (.ass → temp file)
        // ==========================================
        log('exporting_subtitles', '📝 Exportando legendas .ass...', 0, 1);

        const assBytes = new TextEncoder().encode(subtitleData.assContent);
        const subtitlesPath = `${tempDir}${sep}subtitles.ass`;
        await invoke('write_file', { path: subtitlesPath, content: Array.from(assBytes) });
        log('exporting_subtitles', `✅ Legendas exportadas: ${subtitleData.assContent.length} chars`, 1, 1);

        // ==========================================
        // 4. EXPORT IMAGES (URLs/base64 → temp files)
        // ==========================================
        const sceneGroups = groupSegmentsIntoScenes(subtitleData.segments);
        const totalImages = sceneGroups.length;
        log('exporting_images', `🖼️ Exportando ${totalImages} imagens...`, 0, totalImages);

        const renderScenes: RenderScene[] = [];

        for (let i = 0; i < sceneGroups.length; i++) {
            const group = sceneGroups[i];
            const imgFilename = `img_${(i + 1).toString().padStart(3, '0')}.jpg`;
            const imgPath = `${tempDir}${sep}${imgFilename}`;

            try {
                const imgBytes = await imageToBytes(group.imageUrl);
                await invoke('write_file', { path: imgPath, content: Array.from(imgBytes) });

                renderScenes.push({
                    imagePath: imgPath,
                    duration: group.totalDuration,
                });

                log('exporting_images', `🖼️ Imagem ${i + 1}/${totalImages}: ${imgFilename} (${group.totalDuration.toFixed(1)}s)`, i + 1, totalImages);
            } catch (e) {
                console.warn(`[VideoRender] ⚠️ Falha ao exportar imagem ${i + 1}:`, e);
                // Create a black placeholder for missing images
                // Skip this scene instead of failing entirely
                log('exporting_images', `⚠️ Imagem ${i + 1} falhou — criando placeholder preto`, i + 1, totalImages);
            }
        }

        if (renderScenes.length === 0) {
            throw new Error('Nenhuma imagem pôde ser exportada. Verifique a conexão e regenere as imagens.');
        }

        // ==========================================
        // 5. GENERATE CONCAT FILE
        // ==========================================
        log('rendering', '📋 Gerando concat file...', 0, 2);

        const concatContent = buildConcatFileContent(renderScenes);
        const concatPath = `${tempDir}${sep}images.txt`;
        await invoke('write_file', {
            path: concatPath,
            content: Array.from(new TextEncoder().encode(concatContent)),
        });

        // ==========================================
        // 6. RENDER VIDEO (FFmpeg)
        // ==========================================
        const resolution = profile.format === VideoFormat.SHORTS ? '1080x1920' : '1920x1080';
        const outputTempPath = `${tempDir}${sep}output.mp4`;

        log('rendering', `🎬 Renderizando vídeo (${resolution}, CRF 20)...`, 1, 2);

        const ffmpegArgs = buildRenderArgs({
            concatFilePath: concatPath,
            audioPath,
            subtitlesPath,
            outputPath: outputTempPath,
            format: profile.format,
        });

        console.log(`[VideoRender] FFmpeg args:`, ffmpegArgs.join(' '));

        const result = await invoke<FfmpegResult>('run_ffmpeg', { args: ffmpegArgs });

        if (!result.success) {
            const errMsg = result.stderr || `FFmpeg falhou com exit code ${result.exit_code}`;
            console.error('[VideoRender] FFmpeg stderr:', result.stderr);
            throw new Error(`FFmpeg error: ${errMsg}`);
        }

        log('rendering', '✅ FFmpeg renderização concluída!', 2, 2);

        // ==========================================
        // 7. MOVE TO OUTPUT DIRECTORY
        // ==========================================
        log('saving', '💾 Movendo vídeo para pasta de saída...', 0, 1);

        const outputDir = await getOutputDir();
        const timestamp = new Date().toISOString().replace(/[:.]/g, '-').substring(0, 19);
        const safeTitle = (project.stageData.script?.title || project.title || project.id)
            .replace(/[<>:"/\\|?*\n\r]/g, '_')
            .substring(0, 80);
        const finalFilename = `${safeTitle}_${timestamp}.mp4`;
        const finalPath = `${outputDir}${sep}${finalFilename}`;

        // Read the rendered video
        const videoData = await invoke<number[]>('read_file', { path: outputTempPath });

        if (!videoData || videoData.length === 0) {
            throw new Error('Vídeo renderizado está vazio. Verifique os logs do FFmpeg.');
        }

        // Write to final destination
        await invoke('write_file', { path: finalPath, content: videoData });

        const fileSize = videoData.length;
        log('saving', `✅ Vídeo salvo: ${finalPath} (${(fileSize / 1024 / 1024).toFixed(1)} MB)`, 1, 1);

        // ==========================================
        // 8. CLEANUP
        // ==========================================
        log('cleanup', '🧹 Limpando arquivos temporários...', 0, 1);

        try {
            // Delete all temp files
            const filesToClean = [
                audioPath,
                subtitlesPath,
                concatPath,
                outputTempPath,
                ...renderScenes.map(s => s.imagePath),
            ];
            for (const file of filesToClean) {
                try {
                    await invoke('delete_file_cmd', { path: file });
                } catch { /* ignore individual cleanup errors */ }
            }
        } catch {
            console.warn('[VideoRender] Limpeza parcial — alguns temp files podem ter ficado.');
        }

        log('done', `🎉 Renderização concluída! ${(fileSize / 1024 / 1024).toFixed(1)} MB`, 1, 1);

        return {
            outputPath: finalPath,
            duration: audioDuration,
            fileSize,
            resolution,
        };

    } catch (error) {
        // Cleanup on error too
        try {
            const filesToClean = [audioPath];
            for (const file of filesToClean) {
                try { await invoke('delete_file_cmd', { path: file }); } catch { }
            }
        } catch { }

        throw error;
    }
}
