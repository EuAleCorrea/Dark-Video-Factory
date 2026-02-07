
import fs from 'fs';
import ffmpeg from 'fluent-ffmpeg';

/**
 * Converte PCM Base64 para buffer WAV com header.
 * Gemini retorna Linear 16-bit, 24kHz, Mono.
 */
export const pcmToWavBuffer = (base64PCM: string, sampleRate: number = 24000): Buffer => {
    const pcmBuffer = Buffer.from(base64PCM, 'base64');
    const wavHeader = createWavHeader(pcmBuffer.length, sampleRate);
    return Buffer.concat([wavHeader, pcmBuffer]);
};

export const saveBase64ToFile = async (base64Data: string, filePath: string): Promise<void> => {
    // Remove header data URI se existir
    const data = base64Data.replace(/^data:image\/\w+;base64,/, "");
    await fs.promises.writeFile(filePath, Buffer.from(data, 'base64'));
}

export const getAudioDuration = (filePath: string): Promise<number> => {
    return new Promise((resolve, reject) => {
        ffmpeg.ffprobe(filePath, (err: Error | null, metadata: { format: { duration?: number } }) => {
            if (err) return reject(err);
            resolve(metadata.format.duration || 0);
        });
    });
};

function createWavHeader(dataLength: number, sampleRate: number): Buffer {
    const numChannels = 1;
    const bitsPerSample = 16;
    const byteRate = (sampleRate * numChannels * bitsPerSample) / 8;
    const blockAlign = (numChannels * bitsPerSample) / 8;

    const buffer = Buffer.alloc(44);

    buffer.write('RIFF', 0);
    buffer.writeUInt32LE(36 + dataLength, 4);
    buffer.write('WAVE', 8);
    buffer.write('fmt ', 12);
    buffer.writeUInt32LE(16, 16); // PCM Chunk Size
    buffer.writeUInt16LE(1, 20); // Audio Format (1 = PCM)
    buffer.writeUInt16LE(numChannels, 22);
    buffer.writeUInt32LE(sampleRate, 24);
    buffer.writeUInt32LE(byteRate, 28);
    buffer.writeUInt16LE(blockAlign, 32);
    buffer.writeUInt16LE(bitsPerSample, 34);
    buffer.write('data', 36);
    buffer.writeUInt32LE(dataLength, 40);

    return buffer;
}
