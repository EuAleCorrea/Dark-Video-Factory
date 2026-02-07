/**
 * Audio Utilities for handling Raw PCM data from Gemini API.
 * 
 * Gemini TTS returns raw PCM (Linear 16-bit, 24kHz, Mono).
 * Browsers cannot play this directly via <audio>. We must add a WAV header.
 */

export const pcmToWav = (base64PCM: string, sampleRate: number = 24000): string => {
  const binaryString = atob(base64PCM);
  const len = binaryString.length;
  const bytes = new Uint8Array(len);
  for (let i = 0; i < len; i++) {
    bytes[i] = binaryString.charCodeAt(i);
  }

  const wavHeader = createWavHeader(len, sampleRate);
  const wavBytes = new Uint8Array(wavHeader.length + len);
  
  wavBytes.set(wavHeader, 0);
  wavBytes.set(bytes, wavHeader.length);

  const blob = new Blob([wavBytes], { type: 'audio/wav' });
  return URL.createObjectURL(blob);
};

/**
 * Gets the duration of an audio blob URL in seconds.
 * Critical for synchronizing video frames to audio length.
 */
export const getAudioDuration = (blobUrl: string): Promise<number> => {
    return new Promise((resolve, reject) => {
        const audio = new Audio(blobUrl);
        audio.onloadedmetadata = () => {
            if (audio.duration === Infinity) {
                // Fallback for some browser edge cases with blob streams
                audio.currentTime = 1e101;
                audio.ontimeupdate = () => {
                    audio.ontimeupdate = null;
                    resolve(audio.duration);
                }
            } else {
                resolve(audio.duration);
            }
        };
        audio.onerror = (e) => reject(e);
    });
};

const createWavHeader = (dataLength: number, sampleRate: number): Uint8Array => {
  const numChannels = 1;
  const bitsPerSample = 16;
  const byteRate = (sampleRate * numChannels * bitsPerSample) / 8;
  const blockAlign = (numChannels * bitsPerSample) / 8;
  const buffer = new ArrayBuffer(44);
  const view = new DataView(buffer);

  // RIFF chunk descriptor
  writeString(view, 0, 'RIFF');
  view.setUint32(4, 36 + dataLength, true);
  writeString(view, 8, 'WAVE');

  // fmt sub-chunk
  writeString(view, 12, 'fmt ');
  view.setUint32(16, 16, true); // Subchunk1Size (16 for PCM)
  view.setUint16(20, 1, true); // AudioFormat (1 for PCM)
  view.setUint16(22, numChannels, true); // NumChannels
  view.setUint32(24, sampleRate, true); // SampleRate
  view.setUint32(28, byteRate, true); // ByteRate
  view.setUint16(32, blockAlign, true); // BlockAlign
  view.setUint16(34, bitsPerSample, true); // BitsPerSample

  // data sub-chunk
  writeString(view, 36, 'data');
  view.setUint32(40, dataLength, true);

  return new Uint8Array(buffer);
};

const writeString = (view: DataView, offset: number, string: string) => {
  for (let i = 0; i < string.length; i++) {
    view.setUint8(offset + i, string.charCodeAt(i));
  }
};