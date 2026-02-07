import React, { useEffect, useRef } from 'react';
import { LogEntry } from '../types';

interface TerminalProps {
  logs: LogEntry[];
  className?: string;
}

const Terminal: React.FC<TerminalProps> = ({ logs, className = '' }) => {
  const endRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [logs]);

  const getColor = (level: string) => {
    switch (level) {
      case 'INFO': return 'text-slate-400';
      case 'WARN': return 'text-yellow-500';
      case 'ERROR': return 'text-red-500';
      case 'SUCCESS': return 'text-emerald-500';
      default: return 'text-slate-500';
    }
  };

  return (
    <div className={`font-mono text-[11px] p-4 overflow-y-auto custom-scrollbar flex flex-col leading-relaxed ${className}`}>
        {logs.length === 0 && (
            <div className="text-slate-700 italic flex items-center gap-2">
                <span className="text-slate-600">[SYSTEM]</span>
                Aguardando entrada do kernel...
            </div>
        )}
        {logs.map((log, idx) => (
          <div key={idx} className="flex gap-4 hover:bg-white/5 rounded px-1 -mx-1 transition-colors">
            <span className="text-slate-600 shrink-0 select-none">[{log.timestamp}]</span>
            <div className="flex-1 break-words">
                <span className={`font-bold mr-2 uppercase tracking-wide ${getColor(log.level)}`}>{log.level}:</span>
                <span className="text-slate-400">{log.message}</span>
            </div>
          </div>
        ))}
        <div ref={endRef} />
        {logs.length > 0 && (
             <div className="mt-2 text-slate-600 animate-pulse">_</div>
        )}
    </div>
  );
};

export default Terminal;