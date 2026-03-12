import React, { useState, useRef } from 'react';
import { Mic, FileAudio, Settings, Play, CheckCircle, Loader2, Save, X, AlertTriangle } from 'lucide-react';
import { EngineConfig } from '../types';
import { extractAudioFromVideo } from '../services/AudioExtractorService';
import { open, save } from '@tauri-apps/plugin-dialog';
import { convertFileSrc } from '@tauri-apps/api/core';

interface ExtractAudioPanelProps {
  config: EngineConfig;
}

export function ExtractAudioPanel({ config }: ExtractAudioPanelProps) {
  const [selectedVideoPath, setSelectedVideoPath] = useState<string | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [progressLog, setProgressLog] = useState<string[]>([]);
  const [outputFilePath, setOutputFilePath] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const logsEndRef = useRef<HTMLDivElement>(null);

  const addLog = (msg: string) => {
    setProgressLog(prev => [...prev, msg]);
    setTimeout(() => logsEndRef.current?.scrollIntoView({ behavior: 'smooth' }), 50);
  };

  const handleSelectVideo = async () => {
    try {
      setErrorMsg(null);
      setOutputFilePath(null);
      setProgressLog([]);

      const selected = await open({
        multiple: false,
        filters: [{
          name: 'Video Files',
          extensions: ['mp4', 'mkv', 'avi', 'mov', 'webm']
        }]
      });

      if (selected && typeof selected === 'string') {
        setSelectedVideoPath(selected);
        addLog(`📹 Vídeo selecionado: ${selected.split('\\').pop() || selected.split('/').pop()}`);
      }
    } catch (err: any) {
      console.error('Falha ao selecionar vídeo:', err);
      setErrorMsg(`Falha ao abrir diálogo de arquivo: ${err.message}`);
    }
  };

  const clearSelection = () => {
    setSelectedVideoPath(null);
    setOutputFilePath(null);
    setProgressLog([]);
    setErrorMsg(null);
  };

  const handleExtractAudio = async () => {
    if (!selectedVideoPath) return;

    try {
      setErrorMsg(null);
      
      // Perguntar onde salvar o arquivo MP3
      const defaultName = (selectedVideoPath.split('\\').pop() || selectedVideoPath.split('/').pop() || 'video').replace(/\.[^/.]+$/, "") + ".mp3";
      
      const savePath = await save({
        filters: [{ name: 'Arquivo MP3', extensions: ['mp3'] }],
        defaultPath: defaultName,
        title: 'Onde salvar o Áudio Extraído?'
      });

      if (!savePath) {
        addLog('❌ Operação cancelada pelo usuário.');
        return;
      }

      setIsProcessing(true);
      addLog('🚀Iniciando extração do áudio via FFmpeg...');

      await extractAudioFromVideo({
        inputPath: selectedVideoPath,
        outputPath: savePath,
        bitrate: 192 // Standard quality
      }, addLog);

      setOutputFilePath(savePath);
      addLog('✨ Extração finalizada com sucesso!');

    } catch (err: any) {
      console.error('Erro na extração:', err);
      setErrorMsg(`Erro durante a extração: ${err.message}`);
      addLog(`❌ Falha na extração final.`);
    } finally {
      setIsProcessing(false);
    }
  };


  return (
    <div className="flex-1 p-8 overflow-y-auto custom-scrollbar bg-[#F8FAFC]">
      <div className="max-w-4xl mx-auto space-y-6">
        
        {/* HEADER */}
        <div className="flex items-center gap-4 mb-8">
          <div className="w-12 h-12 bg-indigo-50 rounded-2xl flex items-center justify-center text-indigo-600">
            <Mic size={24} strokeWidth={2.5} />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-[#0F172A] tracking-tight">Extrair Áudio de Vídeo</h1>
            <p className="text-[#64748B]">Separe a faixa de áudio de arquivos de vídeo MP4 e salve como MP3.</p>
          </div>
        </div>

        {errorMsg && (
          <div className="bg-red-50 border border-red-200 p-4 rounded-xl flex items-start gap-3">
            <AlertTriangle className="text-red-500 shrink-0 mt-0.5" size={20} />
            <p className="text-red-700 text-sm">{errorMsg}</p>
          </div>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          
          {/* FILE SELECTION CARD */}
          <div className="bg-white rounded-2xl border border-[#E2E8F0] shadow-sm overflow-hidden flex flex-col">
            <div className="p-5 border-b border-[#E2E8F0] bg-slate-50 flex items-center justify-between">
              <h2 className="font-semibold text-[#0F172A] flex items-center gap-2">
                <FileAudio size={18} className="text-indigo-500" />
                Arquivo de Origem
              </h2>
            </div>
            <div className="p-6 flex-1 flex flex-col items-center justify-center">
              
              {!selectedVideoPath ? (
                <div 
                  onClick={handleSelectVideo}
                  className="w-full h-full min-h-[160px] border-2 border-dashed border-[#CBD5E1] hover:border-indigo-400 bg-[#F8FAFC] hover:bg-indigo-50/50 rounded-xl transition-colors cursor-pointer flex flex-col items-center justify-center gap-3 p-6 group"
                >
                  <div className="w-12 h-12 bg-white rounded-full shadow-sm flex items-center justify-center text-[#94A3B8] group-hover:text-indigo-500 transition-colors">
                    <Save size={24} />
                  </div>
                  <div className="text-center">
                    <p className="font-medium text-[#1E293B]">Clique para escolher um Vídeo</p>
                    <p className="text-sm text-[#64748B]">Suporta MP4, MKV, AVI, etc</p>
                  </div>
                </div>
              ) : (
                <div className="w-full space-y-4">
                  <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 relative pr-12">
                    <p className="font-medium text-[#1E293B] truncate" title={selectedVideoPath}>
                      {selectedVideoPath.split('\\').pop() || selectedVideoPath.split('/').pop()}
                    </p>
                    <p className="text-xs text-[#64748B] truncate mt-1">{selectedVideoPath}</p>
                    
                    <button 
                      onClick={clearSelection}
                      disabled={isProcessing}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-red-500 transition-colors disabled:opacity-50"
                      title="Remover vídeo"
                    >
                      <X size={20} />
                    </button>
                  </div>

                  {/* Video Player Preview */}
                  <div className="rounded-xl overflow-hidden bg-black border border-slate-200 shadow-sm">
                    <video 
                      src={convertFileSrc(selectedVideoPath)} 
                      controls 
                      className="w-full max-h-[200px] object-contain"
                    />
                  </div>
                  
                  <button
                    onClick={handleExtractAudio}
                    disabled={isProcessing}
                    className="w-full h-12 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl font-medium flex items-center justify-center gap-2 transition-colors disabled:opacity-50 disabled:cursor-not-allowed shadow-sm"
                  >
                    {isProcessing ? (
                      <>
                        <Loader2 size={18} className="animate-spin" />
                        Extraindo Áudio...
                      </>
                    ) : (
                      <>
                        <Play size={18} />
                        Iniciar Extração
                      </>
                    )}
                  </button>
                </div>
              )}

            </div>
          </div>

          {/* LOGS E RESULTADO CARD */}
          <div className="bg-white rounded-2xl border border-[#E2E8F0] shadow-sm overflow-hidden flex flex-col h-[400px]">
             <div className="p-5 border-b border-[#E2E8F0] bg-slate-50 flex items-center justify-between">
              <h2 className="font-semibold text-[#0F172A] flex items-center gap-2">
                <Settings size={18} className="text-slate-500" />
                Console de Extração
              </h2>
            </div>
            
            <div className="flex-1 overflow-y-auto p-4 bg-[#0F172A] font-mono text-sm">
              {progressLog.length === 0 ? (
                <div className="h-full flex items-center justify-center text-slate-600 italic">
                  Aguardando ação...
                </div>
              ) : (
                <div className="space-y-2">
                  {progressLog.map((log, i) => (
                    <div key={i} className="text-slate-300 break-words">
                      <span className="text-slate-500 mr-2">[{new Date().toLocaleTimeString()}]</span>
                      {log}
                    </div>
                  ))}
                  <div ref={logsEndRef} />
                </div>
              )}
            </div>

            {outputFilePath && !isProcessing && (
              <div className="p-4 border-t border-[#E2E8F0] bg-emerald-50 text-emerald-700 flex flex-col gap-2">
                 <div className="flex items-center gap-2 font-medium">
                  <CheckCircle size={18} />
                  <span>Extração concluída com sucesso!</span>
                 </div>
                 <p className="text-xs break-all opacity-80" title={outputFilePath}>
                   {outputFilePath}
                 </p>
                 <audio 
                    src={convertFileSrc(outputFilePath)} 
                    controls 
                    className="w-full mt-2 h-10"
                  />
              </div>
            )}
          </div>
          
        </div>

      </div>
    </div>
  );
}
