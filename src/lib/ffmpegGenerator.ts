import { VideoFormat } from "../types";

/**
 * Generates the raw shell command for the Docker container.
 * This demonstrates the complexity of the rendering pipeline requirements.
 * 
 * UPGRADE: Now supports complex audio mixing (Input 1 + Input 2).
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
  // const aspectRatio = format === VideoFormat.SHORTS ? "9/16" : "16/9";
  
  // VIDEO FILTER CHAIN:
  // 1. Zoompan (Ken Burns effect) for dynamic movement
  // 2. Setsar to ensure pixel aspect ratio is square
  // 3. Burn subtitles (.ass)
  // 4. Fade in/out video
  const videoFilter = `
    [0:v]zoompan=z='min(zoom+0.0015,1.5)':d=700:x='iw/2-(iw/zoom/2)':y='ih/2-(ih/zoom/2)':s=${resolution},setsar=1[v_zoomed];
    [v_zoomed]ass=${assPath}[v_subbed];
    [v_subbed]fade=t=in:st=0:d=0.5[v_final]
  `.replace(/\s+/g, '');

  // AUDIO FILTER CHAIN:
  // 1. Take BGM (Input 2), lower volume to 12% (0.12)
  // 2. Loop BGM infinitely just in case video is long
  // 3. Mix Voice (Input 1) with BGM
  // 4. 'duration=first' ensures the output audio stops when the VOICE stops (plus dropout transition)
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