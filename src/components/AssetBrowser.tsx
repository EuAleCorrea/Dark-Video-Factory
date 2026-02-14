import React from 'react';
import { File, Folder, HardDrive, Film, Image as ImageIcon, FileAudio, FileText } from 'lucide-react';
import { MockFile } from '../types';

interface AssetBrowserProps {
  jobId: string;
  files: MockFile[];
  className?: string;
}

const AssetBrowser: React.FC<AssetBrowserProps> = ({ jobId, files, className = '' }) => {

  const getIcon = (fileName: string, type: 'FILE' | 'DIR') => {
    if (type === 'DIR') return <Folder size={14} className="text-blue-400" />;
    if (fileName.endsWith('.mp4')) return <Film size={14} className="text-purple-400" />;
    if (fileName.endsWith('.png')) return <ImageIcon size={14} className="text-pink-400" />;
    if (fileName.endsWith('.wav') || fileName.endsWith('.mp3')) return <FileAudio size={14} className="text-yellow-400" />;
    if (fileName.endsWith('.json') || fileName.endsWith('.ass')) return <FileText size={14} className="text-slate-400" />;
    return <File size={14} className="text-slate-500" />;
  };

  return (
    <div className={`p-4 flex flex-col font-mono ${className}`}>
      {/* Header acting as "Mount Point" indicator */}
      <div className="flex items-center gap-2 text-xs text-[#64748B] mb-4 pb-2 border-b border-[#E2E8F0]">
        <HardDrive size={14} className="text-primary" />
        <span>/opt/dark-factory/jobs/{jobId}</span>
      </div>

      {/* File List */}
      <div className="flex-1 overflow-y-auto space-y-1 custom-scrollbar">
        {files.length === 0 && (
          <div className="flex flex-col items-center justify-center h-full text-slate-700 text-[10px] gap-2">
            <span>[DIR_EMPTY]</span>
          </div>
        )}

        {files.map((file, idx) => (
          <div
            key={idx}
            className="group flex items-center justify-between px-2 py-1.5 hover:bg-[#F8FAFC] rounded transition cursor-default"
          >
            <div className="flex items-center gap-3">
              {getIcon(file.name, file.type)}
              <span className="text-xs text-[#334155] group-hover:text-[#0F172A] transition-colors">{file.name}</span>
            </div>
            <div className="flex gap-4 text-[10px] text-[#94A3B8] font-mono">
              <span>{file.size}</span>
              <span>{file.createdAt}</span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

export default AssetBrowser;