
import React from 'react';
import { VideoJob, JobStatus, PipelineStep } from '@/types';
import { Clock, CheckCircle, AlertCircle, Loader2, PlayCircle, FileText, Image as ImageIcon, Music, Video as VideoIcon } from 'lucide-react';

interface JobQueueProps {
  jobs: VideoJob[];
}

export const JobQueue: React.FC<JobQueueProps> = ({ jobs }) => {
  if (jobs.length === 0) {
    return (
      <div className="text-center py-12 text-[#64748B]">
        <Clock className="w-12 h-12 mx-auto mb-3 opacity-20" />
        <p>Nenhum job na fila</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {jobs.map((job) => (
        <div key={job.id} className="bg-white border border-[#E2E8F0] rounded-xl p-4 hover:border-[#CBD5E1] transition-colors shadow-sm">
          <div className="flex justify-between items-start mb-3">
            <div>
              <h3 className="font-medium text-[#0F172A]">{job.theme}</h3>
              <p className="text-xs text-[#64748B] mt-1">ID: {job.id.slice(0, 8)}...</p>
            </div>
            <StatusBadge status={job.status} />
          </div>

          {/* Progress Bar */}
          <div className="w-full bg-[#E2E8F0] h-2 rounded-full overflow-hidden mb-3">
            <div
              className="h-full bg-primary rounded-full transition-all duration-500"
              style={{ width: `${job.progress}%` }}
            />
          </div>

          <div className="flex justify-between items-center text-xs text-[#94A3B8]">
            <span className="flex items-center gap-1.5">
              {getStepIcon(job.currentStep)}
              {getStepLabel(job.currentStep)}
            </span>
            <span>{job.progress}%</span>
          </div>

          {/* Logs Preview (Last log) */}
          {job.logs && job.logs.length > 0 && (
            <div className="mt-3 p-2 bg-[#F8FAFC] rounded-lg text-[10px] font-mono text-[#64748B] truncate border border-[#E2E8F0]">
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
    [JobStatus.QUEUED]: "bg-[#F1F5F9] text-[#64748B] border-[#E2E8F0]",
    [JobStatus.PROCESSING]: "bg-amber-50 text-amber-600 border-amber-200",
    [JobStatus.COMPLETED]: "bg-emerald-50 text-emerald-600 border-emerald-200",
    [JobStatus.FAILED]: "bg-red-50 text-red-600 border-red-200",
  };

  return (
    <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-medium border ${styles[status] || styles[JobStatus.QUEUED]}`}>
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