import { SupabaseClient } from '@supabase/supabase-js';
import { spawn } from 'child_process';
import * as fs from 'fs';
import * as path from 'path';

const TEMP_DIR = process.env.TEMP_DIR || '/tmp/dark-factory';
const OUTPUT_DIR = process.env.OUTPUT_DIR || '/output';
const FFMPEG_PATH = process.env.FFMPEG_PATH || 'ffmpeg';

interface JobData {
    id: string;
    theme: string;
    result?: {
        storyboard: Array<{
            id: number;
            scriptText: string;
            visualPrompt: string;
            duration: number;
            assets?: {
                imageUrl?: string;
                audioUrl?: string;
            };
        }>;
        masterAudioUrl?: string;
    };
}

/**
 * Processa um job de renderização usando FFmpeg
 */
export async function processRenderJob(supabase: SupabaseClient, job: JobData): Promise<void> {
    console.log(`🎬 Iniciando renderização para: ${job.theme}`);

    const jobDir = path.join(TEMP_DIR, job.id);
    const outputPath = path.join(OUTPUT_DIR, `${job.id}_final.mp4`);

    // Criar diretório de trabalho
    if (!fs.existsSync(jobDir)) {
        fs.mkdirSync(jobDir, { recursive: true });
    }

    if (!fs.existsSync(OUTPUT_DIR)) {
        fs.mkdirSync(OUTPUT_DIR, { recursive: true });
    }

    // Atualizar progresso
    await updateProgress(supabase, job.id, 60, 'Baixando assets...');

    // 1. Baixar assets do Supabase Storage
    const assets = await downloadAssets(supabase, job, jobDir);

    await updateProgress(supabase, job.id, 70, 'Montando vídeo...');

    // 2. Gerar o vídeo com FFmpeg
    await runFFmpeg(assets, outputPath, job);

    await updateProgress(supabase, job.id, 75, 'Fazendo upload do resultado...');

    // 3. Upload do vídeo final para o Storage
    const finalVideoUrl = await uploadResult(supabase, job.id, outputPath);

    // 4. Atualizar o job com a URL do vídeo
    await supabase.from('jobs').update({
        result: {
            ...job.result,
            finalVideoUrl
        }
    }).eq('id', job.id);

    // Limpar arquivos temporários
    fs.rmSync(jobDir, { recursive: true, force: true });

    console.log(`✅ Vídeo renderizado: ${finalVideoUrl}`);
}

async function downloadAssets(
    supabase: SupabaseClient,
    job: JobData,
    jobDir: string
): Promise<{ images: string[]; audio: string }> {
    const images: string[] = [];
    let audioPath = '';

    // Baixar áudio master
    if (job.result?.masterAudioUrl) {
        const audioFileName = 'master_audio.mp3';
        audioPath = path.join(jobDir, audioFileName);

        const { data, error } = await supabase.storage
            .from('assets')
            .download(job.result.masterAudioUrl);

        if (data && !error) {
            const buffer = Buffer.from(await data.arrayBuffer());
            fs.writeFileSync(audioPath, buffer);
            console.log(`  📥 Áudio baixado: ${audioFileName}`);
        }
    }

    // Baixar imagens dos segmentos
    if (job.result?.storyboard) {
        for (const segment of job.result.storyboard) {
            if (segment.assets?.imageUrl) {
                const imageFileName = `segment_${segment.id}.png`;
                const imagePath = path.join(jobDir, imageFileName);

                const { data, error } = await supabase.storage
                    .from('assets')
                    .download(segment.assets.imageUrl);

                if (data && !error) {
                    const buffer = Buffer.from(await data.arrayBuffer());
                    fs.writeFileSync(imagePath, buffer);
                    images.push(imagePath);
                    console.log(`  📥 Imagem baixada: ${imageFileName}`);
                }
            }
        }
    }

    return { images, audio: audioPath };
}

async function runFFmpeg(
    assets: { images: string[]; audio: string },
    outputPath: string,
    job: JobData
): Promise<void> {
    return new Promise((resolve, reject) => {
        // Construir comando FFmpeg básico
        // Este é um exemplo simplificado - na prática, seria mais complexo
        const args: string[] = [];

        // Input de áudio
        if (assets.audio) {
            args.push('-i', assets.audio);
        }

        // Criar um slideshow das imagens (se houver)
        if (assets.images.length > 0) {
            // Criar arquivo de lista para concat
            const listPath = path.join(path.dirname(outputPath), 'images.txt');
            const duration = job.result?.storyboard?.[0]?.duration || 5;

            const listContent = assets.images
                .map(img => `file '${img}'\nduration ${duration}`)
                .join('\n');

            fs.writeFileSync(listPath, listContent);

            args.push('-f', 'concat', '-safe', '0', '-i', listPath);
        }

        // Configurações de saída
        args.push(
            '-c:v', 'libx264',
            '-preset', 'fast',
            '-crf', '23',
            '-c:a', 'aac',
            '-b:a', '192k',
            '-pix_fmt', 'yuv420p',
            '-y', // Sobrescrever
            outputPath
        );

        console.log(`  🔧 Executando: ${FFMPEG_PATH} ${args.join(' ')}`);

        const ffmpeg = spawn(FFMPEG_PATH, args);

        ffmpeg.stdout.on('data', (data) => {
            console.log(`  [FFmpeg] ${data}`);
        });

        ffmpeg.stderr.on('data', (data) => {
            // FFmpeg envia progresso para stderr
            const line = data.toString();
            if (line.includes('frame=') || line.includes('time=')) {
                process.stdout.write(`  ⏳ ${line.trim()}\r`);
            }
        });

        ffmpeg.on('close', (code) => {
            if (code === 0) {
                console.log(`\n  ✅ FFmpeg finalizado com sucesso!`);
                resolve();
            } else {
                reject(new Error(`FFmpeg exited with code ${code}`));
            }
        });

        ffmpeg.on('error', (err) => {
            reject(err);
        });
    });
}

async function uploadResult(
    supabase: SupabaseClient,
    jobId: string,
    filePath: string
): Promise<string> {
    const fileBuffer = fs.readFileSync(filePath);
    const fileName = `videos/${jobId}/final.mp4`;

    const { error } = await supabase.storage
        .from('assets')
        .upload(fileName, fileBuffer, {
            contentType: 'video/mp4',
            upsert: true
        });

    if (error) {
        throw new Error(`Falha no upload: ${error.message}`);
    }

    const { data } = supabase.storage.from('assets').getPublicUrl(fileName);
    return data.publicUrl;
}

async function updateProgress(
    supabase: SupabaseClient,
    jobId: string,
    progress: number,
    message: string
): Promise<void> {
    console.log(`  📊 [${progress}%] ${message}`);

    await supabase.from('jobs').update({
        progress,
        logs: supabase.rpc('array_append', {
            arr: 'logs',
            elem: {
                timestamp: new Date().toISOString(),
                level: 'INFO',
                message
            }
        })
    }).eq('id', jobId);
}
