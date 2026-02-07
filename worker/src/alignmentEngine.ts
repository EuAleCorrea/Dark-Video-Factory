import { StoryboardSegment } from "./types";

/**
 * ALIGNMENT ENGINE
 * 
 * Re-distributes segment durations based on the EXACT total duration of the generated audio.
 * This compensates for the variable speaking rate of different TTS voices (e.g., "Charon" speaks slower than "Puck").
 */
export const alignStoryboardToAudio = (
  segments: StoryboardSegment[],
  totalAudioDuration: number
): StoryboardSegment[] => {

  // 1. Calculate total character weight (excluding whitespace for better accuracy)
  const totalChars = segments.reduce((acc, seg) => acc + seg.scriptText.replace(/\s/g, '').length, 0);

  // 2. Distribute time
  let currentTime = 0;

  return segments.map((seg, index) => {
    const segChars = seg.scriptText.replace(/\s/g, '').length;

    // Calculate precise duration based on character density
    let preciseDuration = (segChars / totalChars) * totalAudioDuration;

    // Correction: Ensure the last segment absorbs any floating point rounding errors to match exact total
    if (index === segments.length - 1) {
      preciseDuration = totalAudioDuration - currentTime;
    }

    // Format for display
    const start = currentTime;
    const end = currentTime + preciseDuration;

    currentTime = end;

    return {
      ...seg,
      duration: parseFloat(preciseDuration.toFixed(2)),
      timeRange: `${formatTime(start)} - ${formatTime(end)}`
    };
  });
};

const formatTime = (seconds: number): string => {
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  // Add tenths of a second for precision display
  const tenths = Math.floor((seconds % 1) * 10);
  return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}.${tenths}`;
};