import { VideoFormat } from "../types";

/**
 * FFmpeg Command Builder — Native (no Docker)
 * 
 * Builds FFmpeg argument arrays for native execution via Tauri `run_ffmpeg`.
 */

export interface RenderScene {
  imagePath: string;
  duration: number; // in seconds
}

export interface RenderOptions {
  concatFilePath: string;
  audioPath: string;
  subtitlesPath: string;
  outputPath: string;
  format: VideoFormat;
  crf?: number;       // default 20
  preset?: string;    // default 'medium'
  audioBitrate?: string; // default '192k'
}

/**
 * Builds the content for the FFmpeg concat demuxer file.
 * Each scene gets a `file` + `duration` entry.
 * The last image is repeated to prevent cut-off.
 */
export function buildConcatFileContent(scenes: RenderScene[]): string {
  if (scenes.length === 0) throw new Error("No scenes to render");

  const lines: string[] = [];

  for (const scene of scenes) {
    // FFmpeg concat requires forward slashes and escaped single quotes
    const escapedPath = scene.imagePath.replace(/\\/g, '/');
    lines.push(`file '${escapedPath}'`);
    lines.push(`duration ${scene.duration.toFixed(3)}`);
  }

  // Repeat last image to prevent black frame at end
  const lastScene = scenes[scenes.length - 1];
  const lastEscaped = lastScene.imagePath.replace(/\\/g, '/');
  lines.push(`file '${lastEscaped}'`);

  return lines.join('\n');
}

/**
 * Builds the FFmpeg argument array for rendering the final video.
 * 
 * Pipeline:
 * 1. Concat demuxer reads images with their durations
 * 2. Video is scaled to target resolution with correct SAR
 * 3. ASS subtitles are burned in
 * 4. Audio is copied from the compressed MP3
 * 5. Output is H.264 + AAC in MP4 container
 */
export function buildRenderArgs(options: RenderOptions): string[] {
  const {
    concatFilePath,
    audioPath,
    subtitlesPath,
    outputPath,
    format,
    crf = 20,
    preset = 'medium',
    audioBitrate = '192k',
  } = options;

  const resolution = format === VideoFormat.SHORTS ? '1080:1920' : '1920:1080';

  // Escape the subtitles path for the ASS filter
  // FFmpeg filter needs colons escaped and backslashes as forward slashes
  const assPathEscaped = subtitlesPath
    .replace(/\\/g, '/')
    .replace(/:/g, '\\:');

  // Video filter chain:
  // 1. Scale to target resolution (with padding to fill)
  // 2. Set pixel aspect ratio to square
  // 3. Burn ASS subtitles
  const videoFilter = [
    `scale=${resolution}:force_original_aspect_ratio=decrease`,
    `pad=${resolution}:-1:-1:color=black`,
    `setsar=1`,
    `ass='${assPathEscaped}'`,
  ].join(',');

  const args: string[] = [
    '-y',                             // Overwrite output
    '-f', 'concat',                   // Concat demuxer
    '-safe', '0',                     // Allow absolute paths
    '-i', concatFilePath,             // Input: images concat file
    '-i', audioPath,                  // Input: audio MP3
    '-vf', videoFilter,               // Video filters
    '-c:v', 'libx264',               // Video codec
    '-preset', preset,                // Encoding speed/quality tradeoff
    '-crf', String(crf),              // Quality factor (lower = better)
    '-pix_fmt', 'yuv420p',           // Pixel format for compatibility
    '-c:a', 'aac',                    // Audio codec
    '-b:a', audioBitrate,             // Audio bitrate
    '-shortest',                      // Stop at shortest stream
    '-movflags', '+faststart',        // Optimize for web playback
    outputPath,                       // Output file
  ];

  return args;
}

// --- LEGACY: Docker command (kept for reference) ---

/**
 * @deprecated Use buildRenderArgs() for native FFmpeg rendering
 */
export const generateDockerCommand = (
  jobId: string,
  format: VideoFormat,
  audioPath: string,
  bgmPath: string,
  assPath: string,
  imagesCount: number
): string => {
  const containerName = "dark-factory-renderer";
  const resolution = format === VideoFormat.SHORTS ? "1080:1920" : "1920:1080";

  const videoFilter = `
    [0:v]zoompan=z='min(zoom+0.0015,1.5)':d=700:x='iw/2-(iw/zoom/2)':y='ih/2-(ih/zoom/2)':s=${resolution},setsar=1[v_zoomed];
    [v_zoomed]ass=${assPath}[v_subbed];
    [v_subbed]fade=t=in:st=0:d=0.5[v_final]
  `.replace(/\s+/g, '');

  const audioFilter = `
    [2:a]volume=0.12,aloop=loop=-1:size=2e+09[bgm_low];
    [1:a][bgm_low]amix=inputs=2:duration=first:dropout_transition=2[a_final]
  `.replace(/\s+/g, '');

  return `
docker run --rm -v $(pwd)/jobs/${jobId}:/data ${containerName} \\
  ffmpeg -y \\
  -loop 1 -t ${imagesCount * 15} -i /data/images/%03d.png \\
  -i ${audioPath} \\
  -i ${bgmPath} \\
  -filter_complex "${videoFilter};${audioFilter}" \\
  -map "[v_final]" -map "[a_final]" \\
  -c:v libx264 -preset slow -crf 18 -pix_fmt yuv420p \\
  -c:a aac -b:a 192k \\
  -shortest \\
  /data/output_${format}.mp4
  `.trim();
};