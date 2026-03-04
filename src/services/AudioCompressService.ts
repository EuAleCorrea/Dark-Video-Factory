/**
 * AudioCompressService — Comprime áudio WAV → MP3 via FFmpeg (Tauri)
 * 
 * Fluxo:
 * 1. Lê WAV do disco (projects/{id}/audio.wav)
 * 2. Grava em temp file via Tauri write_file
 * 3. FFmpeg comprime WAV → MP3 (128kbps, mono, 44100Hz)
 * 4. Lê MP3 comprimido via Tauri read_file
 * 5. Salva MP3 no disco (projects/{id}/audio_compressed.mp3)
 * 6. Limpa temp files
 */

import { invoke } from '@tauri-apps/api/core';
import { loadAudioRaw, saveAudio } from './AudioStorageService';

interface FfmpegResult {
    success: boolean;
    stdout: string;
    stderr: string;
    exit_code: number | null;
}

interface FfmpegInfo {
    installed: boolean;
    version: string;
    path: string;
}

interface CompressResult {
    compressedKey: string;
    originalSize: number;
    compressedSize: number;
    compressionRatio: number;
    format: string;
    bitrate: number;
}

/** Verifica se FFmpeg está instalado e acessível */
export async function checkFfmpegAvailable(): Promise<FfmpegInfo> {
    return invoke<FfmpegInfo>('check_ffmpeg');
}

/** Gera path temporário baseado no OS (via Tauri) */
async function getTempPath(filename: string): Promise<string> {
    const tempBase = await invoke<string>('get_temp_dir');
    // Normaliza separador de path para Windows
    const separator = tempBase.includes('\\') ? '\\' : '/';
    return `${tempBase}${separator}${filename}`;
}

/** Monta argumentos FFmpeg para compressão WAV → MP3 com filtros de limpeza */
function buildCompressArgs(inputPath: string, outputPath: string, bitrate: number = 128): string[] {
    // Filtros aplicados:
    // 1. afftdn: Redução de ruído FFT (remove chiado de fundo)
    // 2. highpass=f=100: Remove sons infra-graves indesejados
    // 3. lowpass=f=15000: Remove frequências ultra-altas inúteis para voz
    // 4. treble=g=-3:f=8000: Atenua levemente agudos para reduzir sibilância (de-esser)
    // 5. loudnorm: Normalização dinâmica para volume constante
    const audioFilters = 'afftdn,highpass=f=100,lowpass=f=15000,treble=g=-3:f=8000,loudnorm';

    return [
        '-y',                    // Overwrite output
        '-i', inputPath,         // Input WAV
        '-af', audioFilters,     // Aplicar filtros de áudio
        '-codec:a', 'libmp3lame', // MP3 encoder
        '-b:a', `${bitrate}k`,  // Bitrate (128kbps default)
        '-ar', '44100',          // Sample rate
        '-ac', '1',              // Mono (narração não precisa de stereo)
        outputPath               // Output file
    ];
}

/**
 * Comprime áudio de um projeto.
 * Lê WAV do disco, comprime via FFmpeg, salva MP3 no disco.
 * 
 * ⚠️ CUIDADO com WAV grandes: grava em temp file ao invés de manter em memória.
 */
export async function compressProjectAudio(
    projectId: string,
    onLog?: (msg: string) => void
): Promise<CompressResult> {
    const log = onLog || console.log;

    // 1. Verificar FFmpeg
    log('🔍 Verificando FFmpeg...');
    const ffmpegInfo = await checkFfmpegAvailable();
    if (!ffmpegInfo.installed) {
        throw new Error(
            'FFmpeg não encontrado! Instale o FFmpeg e adicione ao PATH.\n' +
            'Download: https://ffmpeg.org/download.html'
        );
    }
    log(`✅ FFmpeg encontrado: ${ffmpegInfo.version}`);

    // 2. Carregar WAV do disco
    log('📥 Carregando áudio WAV do disco...');
    const wavData = await loadAudioRaw(projectId);
    if (!wavData || wavData.length === 0) {
        throw new Error(`Áudio WAV não encontrado para projeto ${projectId}. Processe o estágio de áudio primeiro.`);
    }
    const originalSize = wavData.length;
    log(`📦 WAV carregado: ${(originalSize / 1024 / 1024).toFixed(2)} MB`);

    // 3. Garantir diretório temp existe e gravar WAV
    const inputPath = await getTempPath(`${projectId}_input.wav`);
    const outputPath = await getTempPath(`${projectId}_output.mp3`);

    log('💾 Gravando WAV em arquivo temporário...');
    // Criar diretório temp (write_file já cria parent dirs)
    await invoke('write_file', {
        path: inputPath,
        content: Array.from(wavData)
    });
    log(`💾 Temp WAV gravado: ${inputPath}`);

    try {
        // 4. Executar FFmpeg
        const bitrate = 128;
        const args = buildCompressArgs(inputPath, outputPath, bitrate);
        log(`🔧 Executando FFmpeg: ffmpeg ${args.join(' ')}`);

        const result = await invoke<FfmpegResult>('run_ffmpeg', { args });

        if (!result.success) {
            const errMsg = result.stderr || `FFmpeg falhou com exit code ${result.exit_code}`;
            throw new Error(`FFmpeg error: ${errMsg}`);
        }
        log('✅ FFmpeg compressão concluída!');

        // 5. Ler MP3 comprimido
        log('📥 Lendo MP3 comprimido...');
        const compressedData = await invoke<number[]>('read_file', { path: outputPath });
        const compressedBytes = new Uint8Array(compressedData);
        const compressedSize = compressedBytes.length;

        if (compressedSize === 0) {
            throw new Error('Arquivo MP3 comprimido está vazio. Verifique a instalação do FFmpeg.');
        }

        const compressionRatio = Math.round((1 - compressedSize / originalSize) * 100);
        log(`📊 Compressão: ${(originalSize / 1024 / 1024).toFixed(2)} MB → ${(compressedSize / 1024 / 1024).toFixed(2)} MB (${compressionRatio}% redução)`);

        // 6. Salvar MP3 no disco com key de comprimido
        const compressedKey = `${projectId}_compressed`;
        log('💾 Salvando MP3 no disco...');
        await saveAudio(compressedKey, compressedBytes);
        log('✅ MP3 salvo no disco!');

        return {
            compressedKey,
            originalSize,
            compressedSize,
            compressionRatio,
            format: 'mp3',
            bitrate,
        };
    } finally {
        // 7. Limpeza — SEMPRE limpa temp files, mesmo em caso de erro
        log('🧹 Limpando arquivos temporários...');
        try {
            await invoke('delete_file_cmd', { path: inputPath });
            await invoke('delete_file_cmd', { path: outputPath });
        } catch {
            // Silently ignore cleanup errors
        }
    }
}
