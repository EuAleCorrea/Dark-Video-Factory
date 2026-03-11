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

/** Converte base64 PCM para data URL WAV (para persistência em JSON/stageData) */
export const pcmToWavDataUrl = (base64PCM: string, sampleRate: number = 24000): string => {
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


  // Convert to base64 data URL
  let binary = '';
  for (let i = 0; i < wavBytes.length; i++) {
    binary += String.fromCharCode(wavBytes[i]);
  }
  return `data:audio/wav;base64,${btoa(binary)}`;
};

/**
 * Converte um AudioBuffer do navegador de volta para um array de bytes WAV
 */
export const audioBufferToWav = (buffer: AudioBuffer): Uint8Array => {
  const numChannels = buffer.numberOfChannels || 1;
  const sampleRate = buffer.sampleRate;
  const format = 1; // PCM
  const bitDepth = 16;

  const resultDataView = new DataView(new ArrayBuffer(44 + buffer.length * numChannels * 2));

  // Escreve Header WAV
  writeString(resultDataView, 0, 'RIFF');
  resultDataView.setUint32(4, 36 + buffer.length * numChannels * 2, true);
  writeString(resultDataView, 8, 'WAVE');
  writeString(resultDataView, 12, 'fmt ');
  resultDataView.setUint32(16, 16, true);
  resultDataView.setUint16(20, format, true);
  resultDataView.setUint16(22, numChannels, true);
  resultDataView.setUint32(24, sampleRate, true);
  resultDataView.setUint32(28, sampleRate * numChannels * 2, true);
  resultDataView.setUint16(32, numChannels * 2, true);
  resultDataView.setUint16(34, bitDepth, true);
  writeString(resultDataView, 36, 'data');
  resultDataView.setUint32(40, buffer.length * numChannels * 2, true);

  // Pega dados do canal (supondo mono/1 canal para simplificar, já que a API costuma usar mono)
  // Caso de fato possuirmos 2 canais, teríamos de intercalar L/R (interleaving).
  const channelData = buffer.getChannelData(0);
  let offset = 44;
  for (let i = 0; i < buffer.length; i++) {
    // Clamping limits
    let sample = Math.max(-1, Math.min(1, channelData[i]));
    // Scale para int16 (32767 = MAX_INT16)
    sample = sample < 0 ? sample * 32768 : sample * 32767;
    resultDataView.setInt16(offset, sample, true);
    offset += 2;
  }

  return new Uint8Array(resultDataView.buffer);
};

/**
 * Lê e concatena múltiplos arquivos de áudio em sequência (sem perdas significativas e com header WAV final).
 * Útil para somar N arquivos "pedaços" oriundos de APIs como TTS com limitação de tamanho.
 */
export const concatenateAudioFiles = async (files: File[]): Promise<{ uint8: Uint8Array, duration: number, format: string }> => {
  if (files.length === 0) throw new Error("Nenhum arquivo enviado para concatenação.");
  if (files.length === 1) {
    // Se for 1 não precisa concatenar.
    const arrayBuffer = await files[0].arrayBuffer();
    const audioCtx = new AudioContext();
    const audioBuffer = await audioCtx.decodeAudioData(arrayBuffer.slice(0));
    await audioCtx.close();
    return {
      uint8: new Uint8Array(arrayBuffer),
      duration: audioBuffer.duration,
      format: files[0].name.endsWith('.mp3') ? 'mp3' : files[0].name.endsWith('.ogg') ? 'ogg' : 'wav'
    };
  }

  const audioCtx = new AudioContext();
  const decodedBuffers: AudioBuffer[] = [];

  // 1. Decodificar todos
  for (const file of files) {
    const arrayBuffer = await file.arrayBuffer();
    // Passamos slice(0) para não consumir o buffer do File
    const decoded = await audioCtx.decodeAudioData(arrayBuffer.slice(0));
    decodedBuffers.push(decoded);
  }

  // 2. Calcular comprimento total nas frames (length)
  const totalLength = decodedBuffers.reduce((acc, b) => acc + b.length, 0);

  // Assume que será mono para o buffer resultante. Simplifica o processo de merge.
  const numChannels = 1;
  // Usa o sample rate do contexto ou o mais alto dos arquivos
  const finalBuffer = audioCtx.createBuffer(numChannels, totalLength, audioCtx.sampleRate);

  // 3. Mergear
  let currentOffset = 0;
  for (const b of decodedBuffers) {
    if (b.numberOfChannels > 0) {
      // Pega o canal 0. Se fosse multicanal precisaríamos mixar (downmix L/R) para um só canal.
      const channelData = b.getChannelData(0);
      finalBuffer.getChannelData(0).set(channelData, currentOffset);
    }
    currentOffset += b.length;
  }

  const finalDuration = finalBuffer.duration;

  // 4. Converter o buffer concatenado de forma raw (pcm f32) de novo para WAV
  const uint8Final = audioBufferToWav(finalBuffer);

  await audioCtx.close();

  return {
    uint8: uint8Final,
    duration: finalDuration,
    format: 'wav' // Como exportamos via audioBufferToWav, forçamos sempre pra wav no retorno final
  };
};