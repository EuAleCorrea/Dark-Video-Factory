import React, { useState } from 'react';
import { 
  Video, 
  FileText, 
  Music, 
  Type, 
  ImageIcon, 
  Share2, 
  ChevronDown, 
  CheckCircle2, 
  Clock, 
  AlertCircle, 
  GitBranch 
} from 'lucide-react';
import { PipelineStage, EngineConfig, ChannelProfile } from '../../types';
import { ReferenceStep } from './steps/ReferenceStep';
import { ScriptStep } from './steps/ScriptStep';
import { AudioStep } from './steps/AudioStep';
import { SubtitleStep } from './steps/SubtitleStep';
import { ImagesStep } from './steps/ImagesStep';
import { ExportStep } from './steps/ExportStep';
import { getAudioDuration } from '../../lib/audioUtils';
import { EditorProject, createClip } from '../../types/editor';
import { StoryboardSegment } from '../../types';




interface WorkflowStepProps {
  title: string;
  icon: React.ElementType;
  status: 'pending' | 'processing' | 'completed' | 'error';
  isExpanded: boolean;
  onToggle: () => void;
  children: React.ReactNode;
}

const WorkflowStep: React.FC<WorkflowStepProps> = ({ title, icon: Icon, status, isExpanded, onToggle, children }) => {
  const getStatusIcon = () => {
    switch (status) {
      case 'completed': return <CheckCircle2 size={16} className="text-green-500" />;
      case 'processing': return <Clock size={16} className="text-primary animate-pulse" />;
      case 'error': return <AlertCircle size={16} className="text-red-500" />;
      default: return <div className="w-4 h-4 rounded-full border-2 border-theme-muted/50" />;
    }
  };

  return (
    <div className={`workflow-step border border-theme rounded-2xl overflow-hidden transition-all duration-300 mb-3 bg-theme-primary/10 hover:bg-theme-secondary/80 ${isExpanded ? 'shadow-xl translate-y-[-2px]' : ''}`}>
      {/* Step Header */}
      <button
        onClick={onToggle}
        className="w-full flex items-center justify-between p-4 bg-theme-secondary/20 hover:bg-theme-hover group"
      >
        <div className="flex items-center gap-4">
          <div className={`p-2.5 rounded-xl transition-all ${isExpanded ? 'bg-primary/20 text-primary scale-110 shadow-lg' : 'bg-theme-hover text-theme-muted group-hover:text-theme-primary'}`}>
            <Icon size={20} />
          </div>
          <div className="text-left">
            <h4 className={`text-sm font-bold uppercase tracking-wider ${isExpanded ? 'text-primary' : 'text-theme-primary'}`}>
              {title}
            </h4>
            <div className="flex items-center gap-1.5 mt-0.5">
              {getStatusIcon()}
              <span className="text-[10px] font-bold text-theme-muted uppercase tracking-widest">{status}</span>
            </div>
          </div>
        </div>
        <ChevronDown 
          size={18} 
          className={`text-theme-muted transition-transform duration-300 ${isExpanded ? 'rotate-180' : ''}`} 
        />
      </button>

      {/* Step Content */}
      <div className={`transition-all duration-300 overflow-hidden ${isExpanded ? 'max-h-[600px] opacity-100' : 'max-h-0 opacity-0'}`}>
        <div className="p-5 border-t border-theme-hover bg-theme-primary/5 min-h-[100px]">
          {children}
        </div>
      </div>
    </div>
  );
};

interface WorkflowPanelProps {
  config: EngineConfig;
  project?: EditorProject;
  onProjectUpdate?: (updated: Partial<EditorProject>) => void;
  profiles: ChannelProfile[];
  activeProfileId?: string;
}


interface Step {
  title: string;
  id: PipelineStage;
  icon: React.ElementType;
  status: 'pending' | 'processing' | 'completed' | 'error';
  label: string;
}

export const WorkflowPanel: React.FC<WorkflowPanelProps> = ({ config, project, onProjectUpdate, profiles, activeProfileId }) => {

  const [expandedStep, setExpandedStep] = useState<number | null>(0);
  const [steps, setSteps] = useState<Step[]>([
    { title: '1. Referência', id: PipelineStage.REFERENCE, icon: Video, status: 'pending', label: 'Encontre o vídeo âncora' },
    { title: '2. Roteiro', id: PipelineStage.SCRIPT, icon: FileText, status: 'pending', label: 'Reescreva a narrativa' },
    { title: '3. Áudio', id: PipelineStage.AUDIO, icon: Music, status: 'pending', label: 'Gere narração de alta qualidade' },
    { title: '4. Legendas', id: PipelineStage.SUBTITLES, icon: Type, status: 'pending', label: 'Sincronize textos no tempo' },
    { title: '5. Imagens', id: PipelineStage.IMAGES, icon: ImageIcon, status: 'pending', label: 'Crie visuais magníficos' },
    { title: '6. Exportar', id: PipelineStage.VIDEO, icon: Share2, status: 'pending', label: 'Renderize via FFmpeg' }
  ]);

  const [transcript, setTranscript] = useState('');
  const [rewrittenScript, setRewrittenScript] = useState('');
  const [metadata, setMetadata] = useState<any>(null);
  const [audioUrl, setAudioUrl] = useState<string | null>(null);
  const [audioBytes, setAudioBytes] = useState<Uint8Array | null>(null);
  const [srtContent, setSrtContent] = useState('');
  const [assContent, setAssContent] = useState('');
  const [segments, setSegments] = useState<StoryboardSegment[]>([]);


  const handleToggle = (idx: number) => {
    setExpandedStep(expandedStep === idx ? null : idx);
  };


  const updateStepStatus = (id: PipelineStage, status: Step['status']) => {
    setSteps(prev => prev.map(s => s.id === id ? { ...s, status } : s));
  };


  const completedCount = steps.filter(s => s.status === 'completed').length;
  const progressPercent = Math.round((completedCount / steps.length) * 100);

  return (
    <div className="flex flex-col h-full bg-theme-secondary animate-in fade-in slide-in-from-left-2 duration-300">
      {/* Workflow Header */}
      <div className="p-5 border-b border-theme bg-theme-primary/40 backdrop-blur-md sticky top-0 z-10">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-primary/10 rounded-2xl flex items-center justify-center text-primary border border-primary/20 shadow-inner">
            <GitBranch size={20} strokeWidth={2.5} />
          </div>
          <div>
            <h3 className="text-base font-black text-theme-primary uppercase tracking-tight">Workflow</h3>
            <p className="text-[11px] font-bold text-theme-muted uppercase tracking-[0.2em] mt-0.5">Pipeline Kanban Pro</p>
          </div>
        </div>
        
        {/* Global Progress Bar */}
        <div className="mt-5 h-2 bg-theme-hover rounded-full overflow-hidden flex border border-theme">
          <div 
            className="h-full bg-primary shadow-[0_0_12px_rgba(var(--df-primary-rgb),0.5)] transition-all duration-500" 
            style={{ width: `${progressPercent}%` }}
          />
        </div>
        <div className="flex justify-between items-center mt-2.5">
          <span className="text-[10px] font-bold text-theme-muted uppercase">Progresso: {progressPercent}%</span>
          <span className="text-[10px] font-bold text-theme-muted uppercase">{completedCount}/{steps.length} concluídos</span>
        </div>
      </div>


      <div className="flex-1 p-4 overflow-y-auto no-scrollbar custom-scrollbar pb-20">
        {steps.map((step, idx) => (
          <WorkflowStep 
            key={step.id}
            title={step.title}
            icon={step.icon}
            status={step.status}
            isExpanded={expandedStep === idx}
            onToggle={() => handleToggle(idx)}
          >
            <div className="flex flex-col gap-3">
              <p className="text-xs text-theme-muted italic">
                {step.label}
              </p>
              
              {step.id === PipelineStage.REFERENCE ? (
                <ReferenceStep 
                  config={config} 
                  onReferenceSelected={(video, text) => {
                    console.log('Reference selected:', video.title);
                    setTranscript(text);
                    updateStepStatus(PipelineStage.REFERENCE, 'completed');
                    setExpandedStep(1); // Auto-expand Step 2 (Roteiro)
                  }}
                  initialTranscript={transcript}
                />
              ) : step.id === PipelineStage.SCRIPT ? (
                <ScriptStep 
                  config={config} 
                  transcript={transcript}
                  onScriptGenerated={(script, data) => {
                    setRewrittenScript(script);
                    setMetadata(data);
                    updateStepStatus(PipelineStage.SCRIPT, 'completed');
                    setExpandedStep(2); // Auto-expand Step 3 (Áudio)
                  }}
                  initialScript={rewrittenScript}
                  initialMetadata={metadata}
                />
              ) : step.id === PipelineStage.AUDIO ? (
                <AudioStep 
                  config={config} 
                  script={rewrittenScript}
                  onAudioGenerated={async (url, bytes) => {
                    setAudioUrl(url);
                    setAudioBytes(bytes);
                    updateStepStatus(PipelineStage.AUDIO, 'completed');
                    
                    // Auto-Place Timeline Logic
                    if (project && onProjectUpdate) {
                      try {
                        const duration = await getAudioDuration(url);
                        const audioTrack = project.tracks.find(t => t.type === 'audio');
                        if (audioTrack) {
                          const newClip = createClip(
                            audioTrack.id,
                            { type: 'audio', url, waveform: [] },
                            0, // Start at absolute zero
                            duration
                          );
                          
                          const newTracks = project.tracks.map(t => 
                            t.id === audioTrack.id 
                              ? { ...t, clips: [newClip] } // Replace old audio for now
                              : t
                          );
                          
                          onProjectUpdate({ tracks: newTracks, duration: Math.max(project.duration, duration) });
                        }
                      } catch (err) {
                        console.error('Falha ao auto-alocar áudio na timeline:', err);
                      }
                    }

                    setExpandedStep(3); // Auto-expand Step 4 (Legendas)
                  }}
                  initialAudio={audioUrl || undefined}
                />
              ) : step.id === PipelineStage.SUBTITLES ? (
                <SubtitleStep 
                  config={config} 
                  script={rewrittenScript}
                  audioUrl={audioUrl || undefined}
                  audioBytes={audioBytes || undefined}
                  activeProfile={profiles.find(p => p.id === activeProfileId)}
                  onSubtitlesGenerated={(srt, ass, segs) => {
                    setSrtContent(srt);
                    setAssContent(ass);
                    setSegments(segs);
                    updateStepStatus(PipelineStage.SUBTITLES, 'completed');
                    
                    // Auto-Place Timeline Logic for Subtitles
                    if (project && onProjectUpdate) {
                      const subTrack = project.tracks.find(t => t.type === 'subtitle');
                      if (subTrack) {
                        const activeProfile = profiles.find(p => p.id === activeProfileId);
                        const subStyle = activeProfile ? {
                          fontName: activeProfile.subtitleStyle.fontName,
                          fontSize: activeProfile.subtitleStyle.fontSize,
                          primaryColor: activeProfile.subtitleStyle.primaryColor,
                          outlineColor: activeProfile.subtitleStyle.outlineColor,
                          backgroundColor: activeProfile.subtitleStyle.backgroundColor,
                          alignment: activeProfile.subtitleStyle.alignment,
                        } : undefined;

                        let currentStart = 0;
                        const clips = segs.map((seg) => {
                          const clip = createClip(
                            subTrack.id,
                            { type: 'subtitle', text: seg.scriptText, style: subStyle },
                            currentStart,
                            seg.duration
                          );
                          currentStart += seg.duration;
                          return clip;
                        });
                        
                        const newTracks = project.tracks.map(t => 
                          t.id === subTrack.id 
                            ? { ...t, clips } 
                            : t
                        );
                        onProjectUpdate({ tracks: newTracks });
                      }
                    }

                    setExpandedStep(4); // Auto-expand Step 5 (Imagens)
                  }}
                  status={step.status}
                />
              ) : step.id === PipelineStage.IMAGES ? (
                <ImagesStep 
                  config={config} 
                  segments={segments}
                  activeProfile={profiles.find(p => p.id === activeProfileId)}
                  width={project?.resolution?.width}
                  height={project?.resolution?.height}
                  onImagesGenerated={(updatedSegs) => {
                    setSegments(updatedSegs);
                    updateStepStatus(PipelineStage.IMAGES, 'completed');

                    // Auto-Place Timeline Logic for Images
                    if (project && onProjectUpdate) {
                      const videoTrack = project.tracks.find(t => t.type === 'video');
                      if (videoTrack) {
                        let currentStart = 0;
                        const clips = updatedSegs.map((seg) => {
                          const clip = createClip(
                            videoTrack.id,
                            { type: 'image', url: seg.assets?.imageUrl || '' },
                            currentStart,
                            seg.duration
                          );
                          currentStart += seg.duration;
                          return clip;
                        });

                        const newTracks = project.tracks.map(t => 
                          t.id === videoTrack.id 
                            ? { ...t, clips } 
                            : t
                        );
                        onProjectUpdate({ tracks: newTracks });
                      }
                    }

                    setExpandedStep(5); // Auto-expand Step 6 (Exportar)
                  }}
                  status={step.status}
                />
              ) : step.id === PipelineStage.VIDEO ? (
                <ExportStep 
                  projectId={project?.id || 'manual-editor'}
                  segments={segments}
                  audioBytes={audioBytes}
                  assContent={assContent}
                  activeProfile={profiles.find(p => p.id === activeProfileId)}
                  onExportComplete={(url) => {
                    updateStepStatus(PipelineStage.VIDEO, 'completed');
                    // Aqui poderia abrir o modal de sucesso ou player
                  }}
                  status={step.status}
                />
              ) : (
                <>
                  <div className="p-4 bg-theme-hover/40 border border-dashed border-theme-muted/30 rounded-xl flex items-center justify-center min-h-[80px]">
                    <p className="text-[10px] font-medium text-theme-muted uppercase tracking-widest bg-theme-primary/50 px-3 py-1.5 rounded-lg border border-theme">
                      Conteúdo para {step.id} em breve
                    </p>
                  </div>

                  <div className="flex justify-end pt-2">
                    <button className="flex items-center gap-2 px-4 py-2 bg-primary text-white text-[11px] font-black uppercase tracking-wider rounded-xl hover:opacity-90 shadow-lg shadow-primary/20 transition-all border-b-4 border-black/20">
                       Configurar e Gerar
                    </button>
                  </div>
                </>
              )}
            </div>

          </WorkflowStep>
        ))}
      </div>
    </div>
  );
};
