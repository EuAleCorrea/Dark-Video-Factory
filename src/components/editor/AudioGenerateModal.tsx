import React, { useState, useCallback } from 'react';
import { X, Loader2, Zap, Download, Music, AlertTriangle, FileAudio } from 'lucide-react';
import { generateSpeech } from '../../services/geminiService';
import { ElevenLabsService } from '../../services/ElevenLabsService';
import { EngineConfig, ElevenLabsSettings } from '../../types';
import { invoke } from '@tauri-apps/api/core';
import { writeFile, mkdir, exists, BaseDirectory } from '@tauri-apps/plugin-fs';
import { join, pictureDir } from '@tauri-apps/api/path';

/** Encapsula PCM raw em WAV válido */
function createWavFromPcm(pcmData: Uint8Array, sampleRate: number, numChannels: number, bitsPerSample: number): ArrayBuffer {
  const byteRate = sampleRate * numChannels * (bitsPerSample / 8);
  const blockAlign = numChannels * (bitsPerSample / 8);
  const headerSize = 44;
  const buffer = new ArrayBuffer(headerSize + pcmData.length);
  const view = new DataView(buffer);
  const writeStr = (offset: number, str: string) => {
    for (let i = 0; i < str.length; i++) view.setUint8(offset + i, str.charCodeAt(i));
  };
  writeStr(0, 'RIFF');
  view.setUint32(4, 36 + pcmData.length, true);
  writeStr(8, 'WAVE');
  writeStr(12, 'fmt ');
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true);
  view.setUint16(22, numChannels, true);
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, byteRate, true);
  view.setUint16(32, blockAlign, true);
  view.setUint16(34, bitsPerSample, true);
  writeStr(36, 'data');
  view.setUint32(40, pcmData.length, true);
  const output = new Uint8Array(buffer);
  output.set(pcmData, headerSize);
  return buffer;
}

const AUDIO_DOWNLOAD_DIR = 'DarkVideoFactory/Audio';

interface AudioGenerateModalProps {
  provider: 'google' | 'eleven';
  config: EngineConfig;
  voiceId: string;
  voiceName: string;
  modelId?: string;
  elevenLabsSettings?: ElevenLabsSettings;
  onClose: () => void;
  onImport: (filePath: string, name: string, duration: number) => void;
}

export function AudioGenerateModal({
  provider,
  config,
  voiceId,
  voiceName,
  modelId,
  elevenLabsSettings,
  onClose,
  onImport,
}: AudioGenerateModalProps) {
  const [text, setText] = useState('');
  const [styleInstructions, setStyleInstructions] = useState('');
  const [isGenerating, setIsGenerating] = useState(false);
  const [audioUrl, setAudioUrl] = useState<string | null>(null);
  const [audioBytes, setAudioBytes] = useState<Uint8Array | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [importing, setImporting] = useState(false);

  const handleGenerate = useCallback(async () => {
    if (!text.trim()) return;
    setIsGenerating(true);
    setError(null);
    setAudioUrl(null);
    setAudioBytes(null);

    try {
      if (provider === 'google') {
        const fullText = styleInstructions ? `${styleInstructions}\n\n${text}` : text;
        const base64Audio = await generateSpeech(fullText, voiceId, config);

        if (base64Audio) {
          const pcmBytes = Uint8Array.from(atob(base64Audio), c => c.charCodeAt(0));
          const wavBuffer = createWavFromPcm(pcmBytes, 24000, 1, 16);
          const wavBytes = new Uint8Array(wavBuffer);

          // Try FFmpeg WAV→MP3 conversion
          try {
            const tempBase = await invoke<string>('get_temp_dir');
            const sep = tempBase.includes('\\') ? '\\' : '/';
            const ts = Date.now();
            const inputPath = `${tempBase}${sep}tts_${ts}.wav`;
            const outputPath = `${tempBase}${sep}tts_${ts}.mp3`;

            await invoke('write_file', { path: inputPath, content: Array.from(wavBytes) });
            const result = await invoke<{ success: boolean; stderr: string }>('run_ffmpeg', {
              args: ['-y', '-i', inputPath, '-codec:a', 'libmp3lame', '-b:a', '192k', '-ar', '44100', '-ac', '1', outputPath]
            });

            if (result.success) {
              const mp3Data = await invoke<number[]>('read_file', { path: outputPath });
              const mp3Bytes = new Uint8Array(mp3Data);
              setAudioBytes(mp3Bytes);
              const blob = new Blob([mp3Bytes], { type: 'audio/mpeg' });
              setAudioUrl(URL.createObjectURL(blob));
            } else {
              const blob = new Blob([wavBuffer], { type: 'audio/wav' });
              setAudioUrl(URL.createObjectURL(blob));
              setAudioBytes(wavBytes);
            }

            invoke('delete_file_cmd', { path: inputPath }).catch(() => {});
            invoke('delete_file_cmd', { path: outputPath }).catch(() => {});
          } catch {
            const blob = new Blob([wavBuffer], { type: 'audio/wav' });
            setAudioUrl(URL.createObjectURL(blob));
            setAudioBytes(wavBytes);
          }
        }
      } else {
        // ElevenLabs
        const apiKey = config.apiKeys.elevenLabs || '';
        const service = new ElevenLabsService(apiKey);
        const blob = await service.generateAudio(
          voiceId,
          text,
          modelId || 'eleven_multilingual_v2',
          elevenLabsSettings
        );
        const bytes = new Uint8Array(await blob.arrayBuffer());
        setAudioBytes(bytes);
        setAudioUrl(URL.createObjectURL(blob));
      }
    } catch (err: any) {
      console.error(`[${provider}] Erro ao gerar:`, err);
      setError(err.message || 'Erro ao gerar áudio');
    } finally {
      setIsGenerating(false);
    }
  }, [text, styleInstructions, provider, voiceId, modelId, config, elevenLabsSettings]);

  const handleImport = useCallback(async () => {
    if (!audioBytes) return;
    setImporting(true);
    try {
      const dirExists = await exists(AUDIO_DOWNLOAD_DIR, { baseDir: BaseDirectory.Picture });
      if (!dirExists) {
        await mkdir(AUDIO_DOWNLOAD_DIR, { baseDir: BaseDirectory.Picture, recursive: true });
      }

      const ext = audioBytes[0] === 0x49 && audioBytes[1] === 0x44 ? 'mp3' : // ID3
                  audioBytes[0] === 0xFF && (audioBytes[1] & 0xE0) === 0xE0 ? 'mp3' : // MPEG sync
                  'mp3'; // default
      const filename = `${provider}_${voiceName.replace(/\s+/g, '_')}_${Date.now()}.${ext}`;
      const filePath = `${AUDIO_DOWNLOAD_DIR}/${filename}`;

      await writeFile(filePath, audioBytes, { baseDir: BaseDirectory.Picture });

      const picDir = await pictureDir();
      const absolutePath = await join(picDir, AUDIO_DOWNLOAD_DIR, filename);

      // Get audio duration
      const duration = await new Promise<number>((resolve) => {
        const audio = new Audio();
        audio.onloadedmetadata = () => resolve(audio.duration || 0);
        audio.onerror = () => resolve(0);
        if (audioUrl) audio.src = audioUrl;
        else resolve(0);
      });

      onImport(absolutePath, filename, duration);
    } catch (err: any) {
      console.error('Erro ao importar áudio:', err);
      setError('Erro ao importar: ' + (err.message || 'desconhecido'));
    } finally {
      setImporting(false);
    }
  }, [audioBytes, audioUrl, provider, voiceName, onImport]);

  return (
    <div
      className="fixed inset-0 z-[200] flex items-center justify-center bg-black/70 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className="w-full max-w-2xl flex flex-col rounded-2xl overflow-hidden border border-theme shadow-2xl"
        style={{ backgroundColor: 'var(--df-bg-primary)', maxHeight: '85vh' }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div
          className="flex items-center justify-between px-5 py-3 border-b border-theme shrink-0"
          style={{ backgroundColor: 'var(--df-bg-secondary)' }}
        >
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg flex items-center justify-center bg-primary/10">
              <Music size={16} className="text-primary" />
            </div>
            <div>
              <h3 className="text-sm font-semibold text-theme-primary">
                Gerar Áudio — {provider === 'google' ? 'Google TTS' : 'ElevenLabs'}
              </h3>
              <span className="text-[11px] text-theme-muted">
                Voz: {voiceName}
              </span>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-theme-muted hover:text-theme-primary transition-colors"
            style={{ cursor: 'pointer' }}
            onMouseEnter={(e) => e.currentTarget.style.backgroundColor = 'var(--df-bg-hover)'}
            onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'transparent'}
          >
            <X size={18} />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-5 flex flex-col gap-4 custom-scrollbar">
          {/* Style Instructions (Google TTS only) */}
          {provider === 'google' && (
            <div className="flex flex-col gap-1.5">
              <label className="text-[10px] font-bold text-theme-muted uppercase tracking-wider">
                Instruções de Estilo (opcional)
              </label>
              <input
                type="text"
                value={styleInstructions}
                onChange={(e) => setStyleInstructions(e.target.value)}
                placeholder="Ex: Leia em um tom caloroso e amigável..."
                className="w-full px-3 py-2 text-xs rounded-lg border border-theme text-theme-primary placeholder:text-theme-placeholder"
                style={{ backgroundColor: 'var(--df-bg-input)' }}
              />
            </div>
          )}

          {/* Main Text Area */}
          <div className="flex flex-col gap-1.5 flex-1">
            <label className="text-[10px] font-bold text-theme-muted uppercase tracking-wider">
              Texto para Gerar
            </label>
            <textarea
              value={text}
              onChange={(e) => setText(e.target.value)}
              placeholder="Cole ou digite o texto que deseja transformar em fala..."
              className="w-full min-h-[180px] px-4 py-3 text-sm rounded-lg border border-theme text-theme-primary placeholder:text-theme-placeholder resize-none custom-scrollbar leading-relaxed"
              style={{ backgroundColor: 'var(--df-bg-input)' }}
              spellCheck={false}
            />
          </div>

          {/* Error */}
          {error && (
            <div className="flex items-center gap-2.5 p-3 rounded-lg bg-red-500/10 border border-red-500/20 text-red-400 text-xs">
              <AlertTriangle size={14} />
              <span className="flex-1">{error}</span>
              <button onClick={() => setError(null)} className="p-0.5 hover:text-red-300">
                <X size={12} />
              </button>
            </div>
          )}

          {/* Audio Player */}
          {audioUrl && (
            <div className="flex items-center gap-3 p-3 rounded-lg border border-theme" style={{ backgroundColor: 'var(--df-bg-secondary)' }}>
              <FileAudio size={16} className="text-primary shrink-0" />
              <audio
                key={audioUrl}
                src={audioUrl}
                controls
                className="flex-1 h-8"
                style={{ filter: 'invert(1) hue-rotate(180deg)', opacity: 0.8 }}
              />
            </div>
          )}
        </div>

        {/* Footer Actions */}
        <div className="flex items-center justify-between px-5 py-3 border-t border-theme shrink-0" style={{ backgroundColor: 'var(--df-bg-secondary)' }}>
          <button
            onClick={() => setText('')}
            className={`text-xs text-theme-muted hover:text-theme-primary transition-colors ${!text && 'opacity-0 pointer-events-none'}`}
          >
            Limpar
          </button>

          <div className="flex items-center gap-2">
            {/* Import Button (shown only if audio exists) */}
            {audioUrl && (
              <button
                onClick={handleImport}
                disabled={importing}
                className="flex items-center gap-2 px-4 py-2 text-xs font-semibold rounded-lg bg-emerald-600 text-white hover:bg-emerald-500 transition-all disabled:opacity-50"
              >
                {importing ? (
                  <Loader2 size={14} className="animate-spin" />
                ) : (
                  <Download size={14} />
                )}
                Importar para Projeto
              </button>
            )}

            {/* Generate Button */}
            <button
              onClick={handleGenerate}
              disabled={!text.trim() || isGenerating}
              className="flex items-center gap-2 px-5 py-2 text-xs font-semibold rounded-lg bg-primary text-white hover:opacity-90 transition-all disabled:opacity-40"
            >
              {isGenerating ? (
                <>
                  <Loader2 size={14} className="animate-spin" />
                  Gerando...
                </>
              ) : (
                <>
                  <Zap size={14} className="fill-white" />
                  Gerar Áudio
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
