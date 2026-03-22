import React, { useState, useRef, useEffect } from 'react';
import {
  Film,
  ImagePlus,
  Music2,
  Loader2,
  CheckCircle2,
  AlertCircle,
  FolderOpen,
  Smartphone,
  Monitor,
  FileText,
  Sparkles,
  X,
} from 'lucide-react';
import { invoke } from '@tauri-apps/api/core';
import { open } from '@tauri-apps/plugin-dialog';

interface RemotionTestPanelProps {
  config?: any;
}

interface SelectedFile {
  name: string;
  path: string;
}

type VideoFormat = 'vertical' | 'horizontal';
type RenderStatus = 'idle' | 'preparing' | 'rendering' | 'done' | 'error';

export const RemotionTestPanel: React.FC<RemotionTestPanelProps> = () => {
  // State
  const [images, setImages] = useState<SelectedFile[]>([]);
  const [audio, setAudio] = useState<SelectedFile | null>(null);
  const [captionText, setCaptionText] = useState('');
  const [format, setFormat] = useState<VideoFormat>('vertical');
  const [kenBurns, setKenBurns] = useState(true);

  // Render state
  const [renderStatus, setRenderStatus] = useState<RenderStatus>('idle');
  const [renderLog, setRenderLog] = useState<string[]>([]);
  const [outputPath, setOutputPath] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Auto-scroll log
  const logRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (logRef.current) {
      logRef.current.scrollTop = logRef.current.scrollHeight;
    }
  }, [renderLog]);

  // ─── File Selection ───────────────────────────────────────

  const handleSelectImages = async () => {
    try {
      const result = await open({
        multiple: true,
        title: 'Selecionar Imagens',
        filters: [{ name: 'Imagens', extensions: ['jpg', 'jpeg', 'png', 'webp'] }],
      });

      if (result) {
        const paths = Array.isArray(result) ? result : [result];
        const newImages: SelectedFile[] = paths.map((filePath: string) => {
          const parts = filePath.replace(/\\/g, '/').split('/');
          return { name: parts[parts.length - 1], path: filePath };
        });
        setImages(prev => [...prev, ...newImages]);
      }
    } catch (err) {
      console.error('Erro ao selecionar imagens:', err);
    }
  };

  const handleSelectAudio = async () => {
    try {
      const result = await open({
        multiple: false,
        title: 'Selecionar Áudio',
        filters: [{ name: 'Áudio', extensions: ['mp3', 'wav', 'ogg', 'm4a'] }],
      });

      if (result) {
        const filePath = typeof result === 'string' ? result : result;
        const parts = String(filePath).replace(/\\/g, '/').split('/');
        setAudio({ name: parts[parts.length - 1], path: String(filePath) });
      }
    } catch (err) {
      console.error('Erro ao selecionar áudio:', err);
    }
  };

  const removeImage = (index: number) => {
    setImages(prev => prev.filter((_, i) => i !== index));
  };

  const addLog = (msg: string) => {
    setRenderLog(prev => [...prev, `[${new Date().toLocaleTimeString()}] ${msg}`]);
  };

  // ─── Render Logic ─────────────────────────────────────────

  const handleRender = async () => {
    if (images.length === 0 || !audio) {
      setErrorMessage('Selecione pelo menos uma imagem e um áudio.');
      return;
    }

    setRenderStatus('preparing');
    setRenderLog([]);
    setErrorMessage(null);
    setOutputPath(null);

    try {
      addLog('📁 Preparando arquivos...');

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

      // 3. Copiar imagens
      addLog(`🖼️ Copiando ${images.length} imagens...`);
      const sceneNames: string[] = [];
      for (let i = 0; i < images.length; i++) {
        const ext = images[i].name.split('.').pop() || 'jpg';
        const destName = `scene_${String(i + 1).padStart(3, '0')}.${ext}`;
        const destPath = `${imagesDir}${sep}${destName}`;
        await invoke('copy_file', { source: images[i].path, destination: destPath });
        sceneNames.push(`images/${destName}`);
        addLog(`  ✅ ${images[i].name} → ${destName}`);
      }

      // 4. Copiar áudio
      addLog('🎵 Copiando áudio...');
      const audioExt = audio.name.split('.').pop() || 'mp3';
      const audioDestName = `narration.${audioExt}`;
      const audioDestPath = `${audioDir}${sep}${audioDestName}`;
      await invoke('copy_file', { source: audio.path, destination: audioDestPath });
      addLog(`  ✅ ${audio.name} → ${audioDestName}`);

      // 5. Obter duração do áudio via FFprobe
      addLog('⏱️ Calculando duração do áudio...');
      let audioDuration = 30; // fallback 30s
      try {
        const probeResult = await invoke<{ success: boolean; stdout: string; stderr: string }>('run_ffprobe', {
          args: ['-v', 'error', '-show_entries', 'format=duration', '-of', 'default=noprint_wrappers=1:nokey=1', audio.path]
        });
        if (probeResult.success && probeResult.stdout) {
          const parsed = parseFloat(probeResult.stdout.trim());
          if (!isNaN(parsed) && parsed > 0) {
            audioDuration = parsed;
          }
        }
        addLog(`  ✅ Duração: ${audioDuration.toFixed(1)}s`);
      } catch {
        addLog(`  ⚠️ FFprobe não disponível. Usando ${audioDuration}s de fallback.`);
      }

      // 6. Distribuir imagens ao longo do áudio
      const durationPerImage = audioDuration / images.length;
      const scenes = sceneNames.map(name => ({
        imagePath: name,
        duration: durationPerImage,
      }));

      // 7. Preparar legendas
      const captions = captionText
        .split('\n')
        .filter(line => line.trim())
        .map((line, i, arr) => {
          const segMs = (audioDuration * 1000) / arr.length;
          return {
            text: line.trim(),
            startMs: i * segMs,
            endMs: (i + 1) * segMs,
          };
        });

      // 8. Montar props
      const width = format === 'vertical' ? 1080 : 1920;
      const height = format === 'vertical' ? 1920 : 1080;
      const fps = 30;
      const transitionDuration = 15; // frames

      // Calcular duração total em frames
      const totalTransitionOverlapSec = Math.max(0, scenes.length - 1) * (transitionDuration / fps);
      const effectiveDuration = audioDuration - totalTransitionOverlapSec;
      const durationInFrames = Math.max(fps, Math.ceil(effectiveDuration * fps));

      const props = {
        scenes,
        audioSrc: `audio/${audioDestName}`,
        captions,
        format,
        transitionDuration,
        kenBurnsEnabled: kenBurns,
      };

      addLog(`🎬 Props: ${scenes.length} cenas × ${durationPerImage.toFixed(1)}s, ${captions.length} legendas`);

      // 9. Salvar props em arquivo JSON
      const propsPath = `${remotionDir}${sep}render-props.json`;
      const propsJson = JSON.stringify(props, null, 2);
      const propsBytes = new TextEncoder().encode(propsJson);
      await invoke('write_file', { path: propsPath, content: Array.from(propsBytes) });
      addLog('📋 Props salvas em render-props.json');

      // 10. Executar render via Tauri command
      setRenderStatus('rendering');
      addLog('🚀 Iniciando renderização Remotion...');
      addLog(`  📐 Resolução: ${width}×${height} | FPS: ${fps} | Frames: ${durationInFrames}`);

      const timestamp = new Date().toISOString().replace(/[:.]/g, '-').substring(0, 19);
      const outputFileName = `remotion_test_${timestamp}.mp4`;

      // Salvar na pasta Vídeos
      const downloadsDir = await invoke<string>('get_downloads_dir');
      const videosDir = downloadsDir.replace(/[/\\]Downloads$/, `${sep}Videos${sep}DarkVideoFactory`);
      await invoke('create_dir_recursive', { path: videosDir });
      const finalOutputPath = `${videosDir}${sep}${outputFileName}`;

      // Chamar run_remotion_render (executa npx remotion render via Rust)
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

      addLog(`  🔧 npx ${renderArgs.join(' ')}`);

      const renderResult = await invoke<{ success: boolean; stdout: string; stderr: string }>('run_remotion_render', {
        projectDir: projectDir,
        args: renderArgs,
      });

      // Log do output
      if (renderResult.stdout) {
        renderResult.stdout.split('\n').forEach(line => {
          if (line.trim()) addLog(`  ${line.trim()}`);
        });
      }
      if (renderResult.stderr) {
        renderResult.stderr.split('\n').forEach(line => {
          if (line.trim()) addLog(`  ⚠ ${line.trim()}`);
        });
      }

      if (renderResult.success) {
        setRenderStatus('done');
        setOutputPath(finalOutputPath);
        addLog(`🎉 Vídeo renderizado com sucesso!`);
        addLog(`📁 Salvo em: ${finalOutputPath}`);
      } else {
        throw new Error(
          renderResult.stderr?.substring(0, 500) ||
          renderResult.stdout?.substring(0, 500) ||
          'Remotion render falhou sem output'
        );
      }
    } catch (err: any) {
      setRenderStatus('error');
      const msg = err?.message || String(err);
      setErrorMessage(msg);
      addLog(`❌ ERRO: ${msg}`);
    }
  };

  const openFolder = async () => {
    if (outputPath) {
      try {
        const { revealItemInDir } = await import('@tauri-apps/plugin-opener');
        await revealItemInDir(outputPath);
      } catch (err) {
        console.error("Erro ao abrir pasta:", err);
      }
    }
  };

  const isRendering = renderStatus === 'preparing' || renderStatus === 'rendering';

  // ─── UI ───────────────────────────────────────────────────

  return (
    <div className="h-full flex flex-col overflow-hidden">
      {/* Header */}
      <div className="p-4 border-b border-theme">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-purple-500/20 flex items-center justify-center">
            <Sparkles size={18} className="text-purple-400" />
          </div>
          <div>
            <h3 className="text-sm font-black text-theme-primary uppercase tracking-tight">
              Remotion — Teste
            </h3>
            <p className="text-[10px] text-theme-muted uppercase tracking-wider">
              Composição de vídeo via React
            </p>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">

        {/* Imagens */}
        <div className="space-y-2">
          <label className="text-[10px] font-black text-theme-muted uppercase tracking-widest flex items-center gap-2">
            <ImagePlus size={14} />
            Imagens ({images.length})
          </label>
          <button
            onClick={handleSelectImages}
            disabled={isRendering}
            className="w-full flex items-center justify-center gap-2 py-3 bg-theme-secondary border border-dashed border-theme rounded-xl hover:bg-theme-hover transition-all text-xs font-semibold text-theme-primary disabled:opacity-40"
          >
            <ImagePlus size={16} className="text-primary" />
            Adicionar Imagens
          </button>

          {images.length > 0 && (
            <div className="space-y-1 max-h-[160px] overflow-y-auto">
              {images.map((img, i) => (
                <div
                  key={i}
                  className="flex items-center justify-between px-3 py-2 bg-theme-secondary/50 rounded-lg text-[11px] text-theme-primary group"
                >
                  <span className="truncate flex-1">{img.name}</span>
                  <button
                    onClick={() => removeImage(i)}
                    className="opacity-0 group-hover:opacity-100 transition-opacity text-red-400 hover:text-red-300 ml-2"
                  >
                    <X size={14} />
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Áudio */}
        <div className="space-y-2">
          <label className="text-[10px] font-black text-theme-muted uppercase tracking-widest flex items-center gap-2">
            <Music2 size={14} />
            Áudio
          </label>
          <button
            onClick={handleSelectAudio}
            disabled={isRendering}
            className="w-full flex items-center justify-center gap-2 py-3 bg-theme-secondary border border-dashed border-theme rounded-xl hover:bg-theme-hover transition-all text-xs font-semibold text-theme-primary disabled:opacity-40"
          >
            <Music2 size={16} className="text-primary" />
            {audio ? audio.name : 'Selecionar Áudio'}
          </button>
        </div>

        {/* Legendas (opcional) */}
        <div className="space-y-2">
          <label className="text-[10px] font-black text-theme-muted uppercase tracking-widest flex items-center gap-2">
            <FileText size={14} />
            Legendas (opcional — uma por linha)
          </label>
          <textarea
            value={captionText}
            onChange={(e) => setCaptionText(e.target.value)}
            disabled={isRendering}
            placeholder={"Primeira legenda aqui...\nSegunda legenda...\nTerceira legenda..."}
            className="w-full h-24 px-3 py-2 bg-theme-secondary border border-theme rounded-xl text-xs text-theme-primary placeholder:text-theme-muted/50 resize-none focus:outline-none focus:ring-1 focus:ring-primary disabled:opacity-40"
          />
        </div>

        {/* Opções */}
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-2">
            <label className="text-[10px] font-black text-theme-muted uppercase tracking-widest">
              Formato
            </label>
            <div className="flex gap-2">
              <button
                onClick={() => setFormat('vertical')}
                disabled={isRendering}
                className={`flex-1 flex flex-col items-center gap-1.5 p-2.5 rounded-xl border transition-all text-[9px] font-bold uppercase ${
                  format === 'vertical'
                    ? 'bg-primary/20 border-primary text-primary'
                    : 'bg-theme-secondary border-theme text-theme-muted hover:bg-theme-hover'
                }`}
              >
                <Smartphone size={16} />
                9:16
              </button>
              <button
                onClick={() => setFormat('horizontal')}
                disabled={isRendering}
                className={`flex-1 flex flex-col items-center gap-1.5 p-2.5 rounded-xl border transition-all text-[9px] font-bold uppercase ${
                  format === 'horizontal'
                    ? 'bg-primary/20 border-primary text-primary'
                    : 'bg-theme-secondary border-theme text-theme-muted hover:bg-theme-hover'
                }`}
              >
                <Monitor size={16} />
                16:9
              </button>
            </div>
          </div>

          <div className="space-y-2">
            <label className="text-[10px] font-black text-theme-muted uppercase tracking-widest">
              Efeito Ken Burns
            </label>
            <button
              onClick={() => setKenBurns(!kenBurns)}
              disabled={isRendering}
              className={`w-full p-2.5 rounded-xl border transition-all text-[10px] font-bold uppercase ${
                kenBurns
                  ? 'bg-primary/20 border-primary text-primary'
                  : 'bg-theme-secondary border-theme text-theme-muted hover:bg-theme-hover'
              }`}
            >
              {kenBurns ? '✅ Ativado' : '❌ Desativado'}
            </button>
          </div>
        </div>

        {/* Botão Render */}
        <button
          onClick={handleRender}
          disabled={isRendering || images.length === 0 || !audio}
          className="w-full flex items-center justify-center gap-3 py-3.5 bg-purple-600 text-white rounded-xl hover:bg-purple-500 transition-all disabled:opacity-40 shadow-xl shadow-purple-600/30 font-black text-xs uppercase tracking-widest"
        >
          {isRendering ? (
            <>
              <Loader2 size={16} className="animate-spin" />
              <span>{renderStatus === 'preparing' ? 'Preparando...' : 'Renderizando...'}</span>
            </>
          ) : (
            <>
              <Film size={16} />
              <span>Gerar Vídeo com Remotion</span>
            </>
          )}
        </button>

        {/* Error */}
        {errorMessage && (
          <div className="p-3 bg-red-500/10 border border-red-500/30 rounded-xl flex items-start gap-2 text-red-400 text-[11px]">
            <AlertCircle size={16} className="shrink-0 mt-0.5" />
            <div>
              <p className="font-bold uppercase tracking-wider mb-0.5">Erro</p>
              <p className="opacity-90 break-words">{errorMessage}</p>
            </div>
          </div>
        )}

        {/* Success */}
        {renderStatus === 'done' && outputPath && (
          <div className="p-4 bg-green-500/10 border border-green-500/30 rounded-xl space-y-3">
            <div className="flex items-center gap-3">
              <CheckCircle2 size={20} className="text-green-500" />
              <div>
                <p className="text-xs font-black text-green-500 uppercase tracking-tight">
                  Vídeo Renderizado!
                </p>
                <p className="text-[10px] text-theme-muted">
                  Composição Remotion concluída com sucesso
                </p>
              </div>
            </div>
            <button
              onClick={openFolder}
              className="w-full flex items-center justify-center gap-2 py-2.5 bg-theme-secondary text-theme-primary border border-theme rounded-xl hover:bg-theme-hover transition-all text-[11px] font-bold uppercase"
            >
              <FolderOpen size={14} />
              Abrir Pasta
            </button>
            <p className="text-[9px] text-theme-muted font-mono truncate px-1">
              {outputPath}
            </p>
          </div>
        )}

        {/* Render Log */}
        {renderLog.length > 0 && (
          <div className="space-y-1">
            <label className="text-[10px] font-black text-theme-muted uppercase tracking-widest">
              Log de Renderização
            </label>
            <div ref={logRef} className="max-h-[200px] overflow-y-auto bg-black/40 rounded-xl p-3 border border-theme">
              {renderLog.map((log, i) => (
                <p key={i} className="text-[10px] font-mono text-theme-muted leading-5">
                  {log}
                </p>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default RemotionTestPanel;
