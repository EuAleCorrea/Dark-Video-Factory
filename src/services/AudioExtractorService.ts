/**
 * AudioExtractorService — Extrai áudio de vídeo local via FFmpeg (Tauri)
 * 
 * Fluxo:
 * 1. Recebe um arquivo local (MP4) de input
 * 2. Recebe de onde salvar o arquivo MP3 final
 * 3. FFmpeg extrai áudio descartando vídeo (-vn, libmp3lame)
 * 4. Valida e avisa sobre o sucesso da extração
 */

import { invoke } from '@tauri-apps/api/core';

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

interface ExtractOptions {
    inputPath: string;
    outputPath: string;
    bitrate?: number; // default: 192 (melhor qualidade para standalone)
}

/** Verifica se FFmpeg está instalado e acessível */
export async function checkFfmpegAvailable(): Promise<FfmpegInfo> {
    return invoke<FfmpegInfo>('check_ffmpeg');
}

/** Monta argumentos FFmpeg para extração MP4 → MP3 */
function buildExtractArgs(options: ExtractOptions): string[] {
    const { inputPath, outputPath, bitrate = 192 } = options;
    
    return [
        '-y',                    // Overwrite output se existir
        '-i', inputPath,         // Input MP4 (ou qualquer outro video suportado pelo FFmpeg)
        '-vn',                   // Descartar o stream de vídeo
        '-codec:a', 'libmp3lame', // Usar encoder MP3
        '-b:a', `${bitrate}k`,   // Bitrate do áudio (default 192kbps)
        '-ar', '44100',          // Sample rate
        '-ac', '2',              // Stereo (melhor manter como a fonte original quando extraindo música/sons ambiente)
        outputPath               // Output file (.mp3)
    ];
}

/**
 * Invocaação Tauri pura para rodar extração do vídeo. 
 * Nenhuma manipulação em memória pesada, o FFmpeg lê do disco e salva no disco.
 */
export async function extractAudioFromVideo(
    options: ExtractOptions,
    onLog?: (msg: string) => void
): Promise<boolean> {
    const log = onLog || console.log;

    // 1. Verificações Prévias
    log('🔍 Verificando FFmpeg...');
    const ffmpegInfo = await checkFfmpegAvailable();
    if (!ffmpegInfo.installed) {
        throw new Error(
            'FFmpeg não encontrado! Instale o FFmpeg e adicione ao PATH.\n' +
            'Download: https://ffmpeg.org/download.html'
        );
    }
    log(`✅ FFmpeg encontrado: ${ffmpegInfo.version}`);

    try {
        // 2. Executar Extração com FFmpeg
        const args = buildExtractArgs(options);
        log(`🔧 Executando FFmpeg: ffmpeg ${args.join(' ')}`);

        const result = await invoke<FfmpegResult>('run_ffmpeg', { args });

        if (!result.success) {
            const errMsg = result.stderr || `FFmpeg falhou com exit code ${result.exit_code}`;
            throw new Error(`FFmpeg error: ${errMsg}`);
        }
        
        log(`✅ Extração concluída com sucesso! Salvo em: ${options.outputPath}`);
        return true;
        
    } catch (e: any) {
        log(`❌ Erro na extração: ${e.message}`);
        throw e;
    }
}
