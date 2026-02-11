
import React from 'react';
import { VideoJob, JobStatus, PipelineStep } from '@/types';
import { Clock, CheckCircle, AlertCircle, Loader2, PlayCircle, FileText, Image as ImageIcon, Music, Video as VideoIcon } from 'lucide-react';

interface JobQueueProps {
  jobs: VideoJob[];
}

export const JobQueue: React.FC<JobQueueProps> = ({ jobs }) => {
  if (jobs.length === 0) {
    return (
      <div className="text-center py-12 text-zinc-500">
        <Clock className="w-12 h-12 mx-auto mb-3 opacity-20" />
        <p>Nenhum job na fila</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {jobs.map((job) => (
        <div key={job.id} className="bg-zinc-900/50 border border-zinc-800 rounded-xl p-4 hover:border-zinc-700 transition-colors">
          <div className="flex justify-between items-start mb-3">
            <div>
              <h3 className="font-medium text-zinc-200">{job.theme}</h3>
              <p className="text-xs text-zinc-500 mt-1">ID: {job.id.slice(0, 8)}...</p>
            </div>
            <StatusBadge status={job.status} />
          </div>

          {/* Progress Bar */}
          <div className="w-full bg-zinc-800 h-2 rounded-full overflow-hidden mb-3">
            <div
              className="h-full bg-gradient-to-r from-violet-600 to-indigo-600 transition-all duration-500"
              style={{ width: `${job.progress}%` }}
            />
          </div>

          <div className="flex justify-between items-center text-xs text-zinc-400">
            <span className="flex items-center gap-1.5">
              {getStepIcon(job.currentStep)}
              {getStepLabel(job.currentStep)}
            </span>
            <span>{job.progress}%</span>
          </div>

          {/* Logs Preview (Last log) */}
          {job.logs && job.logs.length > 0 && (
            <div className="mt-3 p-2 bg-black/40 rounded text-[10px] font-mono text-zinc-500 truncate">
              &gt; {job.logs[job.logs.length - 1].message}
            </div>
          )}
        </div>
      ))}
    </div>
  );
};

const StatusBadge = ({ status }: { status: JobStatus }) => {
  const styles: Record<string, string> = {
    [JobStatus.QUEUED]: "bg-zinc-800 text-zinc-400",
    [JobStatus.PROCESSING]: "bg-indigo-500/10 text-indigo-400 border-indigo-500/20",
    [JobStatus.COMPLETED]: "bg-emerald-500/10 text-emerald-400 border-emerald-500/20",
    [JobStatus.FAILED]: "bg-red-500/10 text-red-400 border-red-500/20",
  };

  return (
    <span className={`px-2 py-0.5 rounded text-[10px] font-medium border ${styles[status] || styles[JobStatus.QUEUED]}`}>
      {status}
    </span>
  );
};

const getStepIcon = (step: PipelineStep) => {
  switch (step) {
    case PipelineStep.SCRIPTING: return <FileText className="w-3 h-3" />;
    case PipelineStep.VOICE_GEN: return <Music className="w-3 h-3" />;
    case PipelineStep.IMAGE_PROMPTING: return <ImageIcon className="w-3 h-3" />;
    case PipelineStep.RENDERING: return <VideoIcon className="w-3 h-3" />;
    case PipelineStep.DONE: return <CheckCircle className="w-3 h-3" />;
    default: return <Loader2 className="w-3 h-3 animate-spin" />;
  }
};

const getStepLabel = (step: PipelineStep) => {
  switch (step) {
    case PipelineStep.SCRIPTING: return "Gerando Roteiro";
    case PipelineStep.VOICE_GEN: return "Sintetizando Voz";
    case PipelineStep.IMAGE_PROMPTING: return "Criando Imagens";
    case PipelineStep.RENDERING: return "Renderizando Vídeo";
    case PipelineStep.DONE: return "Concluído";
    default: return "Processando";
  }
};