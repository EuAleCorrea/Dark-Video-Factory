import React, { useState } from 'react';
import { 
  Film, 
  Settings, 
  Play, 
  Loader2, 
  CheckCircle2, 
  AlertCircle, 
  FolderOpen, 
  Monitor, 
  Smartphone,
  ChevronRight,
  Settings2
} from 'lucide-react';
import { 
  VideoProject, 
  ChannelProfile, 
  VideoFormat, 
  SceneData, 
  PipelineStage, 
  ProjectStatus 
} from '../../../types';
import { invoke } from '@tauri-apps/api/core';

interface ExportStepProps {
  projectId: string;
  scenes: SceneData[];
  activeProfile?: ChannelProfile;
  onExportComplete: (videoUrl: string) => void;
  status: 'pending' | 'processing' | 'completed' | 'error';
}

export const ExportStep: React.FC<ExportStepProps> = ({ 
  projectId, 
  scenes, 
  activeProfile, 
  onExportComplete,
  status: parentStatus 
}) => {
  const [isExporting, setIsExporting] = useState(false);
  const [progressMessage, setProgressMessage] = useState<string | null>(null);
  const [logs, setLogs] = useState<string[]>([]);
  const [resultPath, setResultPath] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  
  // Opções locais de render
  const [format, setFormat] = useState<VideoFormat>(activeProfile?.format || VideoFormat.SHORTS);
  const [quality, setQuality] = useState<'high' | 'standard'>('high');

  const addLog = (msg: string) => {
    setLogs(prev => [...prev, `[${new Date().toLocaleTimeString()}] ${msg}`]);
    setProgressMessage(msg);
  };

  const downloadImageAsBytes = async (url: string): Promise<Uint8Array> => {
      const response = await fetch(url);
      const blob = await response.blob();
      const buffer = await blob.arrayBuffer();
      return new Uint8Array(buffer);
  };

  const handleExport = async () => {
    // Validação
    const isReady = scenes.length > 0 && scenes.every(s => s.audioBytes && s.imageUrl && s.status === 'done');
    if (!isReady) {
      setError("Existem cenas incompletas. Certifique-se de gerar áudio e imagem para todas as cenas antes de exportar.");
      return;
    }

    setIsExporting(true);
    setError(null);
    setResultPath(null);
    setLogs([]);

    try {
      addLog('📁 Preparando estrutura do Remotion...');

      // 1. Obter o diretório do projeto
      const projectDir = await invoke<string>('get_project_dir');
      const sep = projectDir.includes('\\') ? '\\' : '/';
      const remotionDir = `${projectDir}${sep}remotion`;
      const publicDir = `${remotionDir}${sep}public`;
      const imagesDir = `${publicDir}${sep}images`;
      const audioDir = `${publicDir}${sep}audio`;

      // 2. Limpar e recriar diretórios
      addLog('🧹 Limpando assets anteriores...');
      try { await invoke('delete_dir_cmd', { path: imagesDir }); } catch { /* ok */ }
      try { await invoke('delete_dir_cmd', { path: audioDir }); } catch { /* ok */ }

      await invoke('create_dir_recursive', { path: imagesDir });
      await invoke('create_dir_recursive', { path: audioDir });

      // 3. Preparar array de Props para o Remotion
      const remotionScenes: any[] = [];
      let totalDurationSec = 0;

      for (let i = 0; i < scenes.length; i++) {
        const scene = scenes[i];
        const sceneNum = String(i + 1).padStart(3, '0');
        
        // Escrever Audio no disco
        addLog(`🎵 Salvando áudio da cena ${i+1}...`);
        const audioName = `scene_${sceneNum}.wav`;
        const audioPath = `${audioDir}${sep}${audioName}`;
        if (scene.audioBytes) {
           await invoke('write_file', { path: audioPath, content: Array.from(scene.audioBytes) });
        }
        
        // Escrever Imagem no disco
        addLog(`🖼️ Baixando/salvando imagem da cena ${i+1}...`);
        let imageExt = 'jpg';
        if (scene.imageUrl?.includes('png')) imageExt = 'png';
        if (scene.imageUrl?.includes('webp')) imageExt = 'webp';
        
        const imageName = `scene_${sceneNum}.${imageExt}`;
        const imagePath = `${imagesDir}${sep}${imageName}`;
        
        let imgBytes: Uint8Array;
        if (scene.imageUrl?.startsWith('blob:')) {
           imgBytes = await downloadImageAsBytes(scene.imageUrl);
        } else if (scene.imageUrl?.startsWith('http')) {
           imgBytes = await downloadImageAsBytes(scene.imageUrl);
        } else {
           // fallback / base64? (Idealmente já teríamos byte arrays, baixar como blob url)
           imgBytes = await downloadImageAsBytes(scene.imageUrl!);
        }
        await invoke('write_file', { path: imagePath, content: Array.from(imgBytes) });

        const duration = scene.audioDuration || 5; // fallback 5s
        totalDurationSec += duration;
        
        remotionScenes.push({
           id: scene.id,
           audioPath: `audio/${audioName}`,
           imagePath: `images/${imageName}`,
           text: scene.scriptText, // Usado para legendas
           duration: duration
        });
      }

      // 4. Montar Props JSON
      const isVertical = format === VideoFormat.SHORTS;
      const width = isVertical ? 1080 : 1920;
      const height = isVertical ? 1920 : 1080;
      const fps = 30;
      const transitionDuration = 15; // 0.5 sec approx
      
      const totalTransitionOverlapSec = Math.max(0, scenes.length - 1) * (transitionDuration / fps);
      const effectiveDuration = totalDurationSec - totalTransitionOverlapSec;
      const durationInFrames = Math.max(fps, Math.ceil(effectiveDuration * fps));

      const props = {
        scenes: remotionScenes,
        format: isVertical ? 'vertical' : 'horizontal',
        transitionDuration,
        kenBurnsEnabled: true,
      };

      addLog(`🎬 Props: ${scenes.length} cenas configuradas. Duração total: ${effectiveDuration.toFixed(1)}s`);

      // 5. Salvar props em render-props.json
      const propsPath = `${remotionDir}${sep}render-props.json`;
      const propsJson = JSON.stringify(props, null, 2);
      const propsBytes = new TextEncoder().encode(propsJson);
      await invoke('write_file', { path: propsPath, content: Array.from(propsBytes) });

      // 6. Preparar output e chamar CLI via Rust
      addLog('🚀 Iniciando renderização Remotion CLI...');
      
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-').substring(0, 19);
      const outputFileName = `darkvideo_${projectId}_${timestamp}.mp4`;
      
      const downloadsDir = await invoke<string>('get_downloads_dir');
      const videosDir = downloadsDir.replace(/[/\\]Downloads$/, `${sep}Videos${sep}DarkVideoFactory`);
      await invoke('create_dir_recursive', { path: videosDir });
      const finalOutputPath = `${videosDir}${sep}${outputFileName}`;

      const renderArgs = [
        'remotion', 'render',
        'src/Root.tsx',
        'DarkVideo',
        '--output', finalOutputPath,
        '--props', propsPath,
        '--width', String(width),
        '--height', String(height),
        '--fps', String(fps),
        '--duration', String(durationInFrames),
        '--log', 'info',
      ];
      
      try {
        const renderResult = await invoke<{ success: boolean; stdout: string; stderr: string }>('run_remotion_render', {
          args: renderArgs,
          cwd: remotionDir,
        });

        if (renderResult.success) {
           addLog(`✅ Vídeo renderizado com sucesso: ${finalOutputPath}`);
           setResultPath(finalOutputPath);
           onExportComplete(finalOutputPath);
        } else {
           throw new Error(renderResult.stderr || "Erro desconhecido ao rodar CLI");
        }
      } catch (e: any) {
        throw new Error(e.message || "Falha na chamada ao comando de render.");
      }
      
    } catch (err: any) {
      console.error("Erro na exportação:", err);
      setError(err.message || "Ocorreu um erro durante a renderização.");
    } finally {
      setIsExporting(false);
    }
  };

  const openFolder = async () => {
    if (resultPath) {
      try {
        const { revealItemInDir } = await import('@tauri-apps/plugin-opener');
        await revealItemInDir(resultPath);
      } catch (err) {
        console.error("Erro ao abrir pasta:", err);
      }
    }
  };

  return (
    <div className="space-y-4">
      {/* Settings & Export Action */}
      <div className="flex flex-col gap-4 p-5 bg-theme-secondary/30 rounded-2xl border border-theme">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Settings className="text-primary animate-spin-slow" size={24} />
            <div>
              <h5 className="text-sm font-black text-theme-primary uppercase tracking-tight">Finalização & Render</h5>
              <p className="text-[10px] text-theme-muted uppercase tracking-wider">Exportando via Remotion Motor</p>
            </div>
          </div>
          
          <button
            onClick={handleExport}
            disabled={isExporting}
            className="flex items-center gap-3 px-6 py-2.5 bg-primary text-white rounded-xl hover:opacity-90 transition-all disabled:opacity-40 shadow-xl shadow-primary/30 font-black text-xs uppercase tracking-widest group"
          >
            {isExporting ? (
              <>
                <Loader2 size={16} className="animate-spin" />
                <span>Renderizando...</span>
              </>
            ) : (
              <>
                <Play size={16} className="group-hover:translate-x-0.5 transition-transform" />
                <span>Exportar Vídeo</span>
              </>
            )}
          </button>
        </div>

        {/* Options Row */}
        {!isExporting && !resultPath && (
          <div className="grid grid-cols-2 gap-4 pt-2">
            <div>
              <label className="text-[10px] font-black text-theme-muted uppercase tracking-widest mb-2 block">Formato de Saída</label>
              <div className="flex gap-2">
                <button 
                  onClick={() => setFormat(VideoFormat.SHORTS)}
                  className={`flex-1 flex flex-col items-center gap-2 p-3 rounded-xl border transition-all ${format === VideoFormat.SHORTS ? 'bg-primary/20 border-primary text-primary shadow-lg shadow-primary/10' : 'bg-theme-secondary border-theme text-theme-muted hover:bg-theme-hover'}`}
                >
                  <Smartphone size={18} />
                  <span className="text-[9px] font-bold uppercase">Shorts (9:16)</span>
                </button>
                <button 
                  onClick={() => setFormat(VideoFormat.LONG_FORM)}
                  className={`flex-1 flex flex-col items-center gap-2 p-3 rounded-xl border transition-all ${format === VideoFormat.LONG_FORM ? 'bg-primary/20 border-primary text-primary shadow-lg shadow-primary/10' : 'bg-theme-secondary border-theme text-theme-muted hover:bg-theme-hover'}`}
                >
                  <Monitor size={18} />
                  <span className="text-[9px] font-bold uppercase">Long (16:9)</span>
                </button>
              </div>
            </div>
            <div>
              <label className="text-[10px] font-black text-theme-muted uppercase tracking-widest mb-2 block">Qualidade do Render</label>
              <div className="flex gap-2">
                <button 
                  onClick={() => setQuality('high')}
                  className={`flex-1 flex flex-col items-center gap-2 p-3 rounded-xl border transition-all ${quality === 'high' ? 'bg-primary/10 border-primary/50 text-primary shadow-md shadow-primary/5' : 'bg-theme-secondary border-theme text-theme-muted hover:bg-theme-hover'}`}
                >
                  <Settings2 size={18} />
                  <span className="text-[9px] font-bold uppercase text-center">Alta Resolução<br/>(Visual PRO)</span>
                </button>
                <button 
                  onClick={() => setQuality('standard')}
                  className={`flex-1 flex flex-col items-center gap-2 p-3 rounded-xl border transition-all ${quality === 'standard' ? 'bg-primary/10 border-primary/50 text-primary shadow-md shadow-primary/5' : 'bg-theme-secondary border-theme text-theme-muted hover:bg-theme-hover'}`}
                >
                  <Loader2 size={18} />
                  <span className="text-[9px] font-bold uppercase text-center">Rápida<br/>(Para Testes)</span>
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Export Progress */}
        {isExporting && (
          <div className="space-y-3 pt-4 border-t border-theme animate-in fade-in slide-in-from-top-2 duration-300">
            <div className="flex justify-center items-end">
              <div>
                <span className="text-[10px] font-black text-primary uppercase tracking-widest block text-center mb-1">
                  Status: Exportando
                </span>
                <p className="text-[11px] text-theme-primary font-medium text-center">{progressMessage}</p>
              </div>
            </div>
            
            <div className="w-full h-3 bg-theme-hover rounded-full overflow-hidden border border-theme p-0.5">
               {/* Indeterminate progress bar since we don't have accurate CLI parsing yet */}
              <div className="h-full bg-gradient-to-r from-primary/80 to-primary rounded-full shadow-[0_0_12px_rgba(var(--df-primary-rgb),0.5)] w-full animate-pulse" />
            </div>
          </div>
        )}

        {/* Success State */}
        {resultPath && !isExporting && (
          <div className="pt-4 border-t border-theme animate-in slide-in-from-bottom-2 duration-500">
            <div className="p-4 bg-green-500/10 border border-green-500/20 rounded-xl flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-green-500 rounded-lg flex items-center justify-center text-white shadow-lg shadow-green-500/30">
                  <CheckCircle2 size={24} />
                </div>
                <div>
                  <h4 className="text-sm font-bold text-green-500 uppercase tracking-widest">Vídeo Finalizado!</h4>
                  <p className="text-[10px] text-theme-muted mt-0.5 truncate max-w-[200px] md:max-w-xs">{resultPath}</p>
                </div>
              </div>
              <button 
                onClick={openFolder}
                className="flex items-center gap-2 px-4 py-2 bg-theme-primary hover:bg-theme-hover border border-theme rounded-lg text-theme-primary font-bold text-xs uppercase tracking-widest transition-colors shadow-sm"
              >
                <FolderOpen size={16} />
                Abrir Pasta
              </button>
            </div>
          </div>
        )}

        {/* Error State */}
        {error && (
          <div className="mt-4 p-4 bg-red-500/10 border border-red-500/20 rounded-xl flex items-start gap-3">
            <AlertCircle size={20} className="text-red-500 shrink-0 mt-0.5" />
            <div>
              <h4 className="text-xs font-bold text-red-500 uppercase tracking-widest">Falha na Exportação</h4>
              <p className="text-[11px] text-red-500/80 mt-1 whitespace-pre-wrap">{error}</p>
              {logs.length > 0 && (
                <div className="mt-2 p-2 bg-black/40 rounded border border-red-500/20 text-[9px] font-mono text-red-400/80 max-h-24 overflow-y-auto">
                    {logs.map((L, i) => <div key={i}>{L}</div>)}
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
