import React from 'react';
import { VideoJob } from '../types';
import { Copy, Download, ExternalLink, Hash, Type, Image as ImageIcon, Youtube } from 'lucide-react';

interface DistributionPanelProps {
  job: VideoJob;
}

const DistributionPanel: React.FC<DistributionPanelProps> = ({ job }) => {
  if (!job.metadata) return null;

  const { titles, description, tags, thumbnailUrl } = job.metadata;

  return (
    <div className="bg-slate-900 border border-emerald-500/30 rounded-xl p-6 mb-6 shadow-2xl shadow-emerald-900/10">
      <div className="flex items-center gap-3 mb-6 border-b border-slate-800 pb-4">
        <div className="w-10 h-10 rounded-full bg-emerald-500/10 flex items-center justify-center text-emerald-400">
            <Youtube size={20} />
        </div>
        <div>
            <h3 className="text-lg font-bold text-white">Distribuição Pronta</h3>
            <p className="text-xs text-slate-400">Metadados gerados pelo Gemini 3 Flash com base na análise do roteiro final.</p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* Left Col: Thumbnail & Preview */}
        <div className="space-y-4">
            <div className="bg-black rounded-lg overflow-hidden border border-slate-700 aspect-video relative group">
                {thumbnailUrl ? (
                    <>
                        <img src={thumbnailUrl} alt="Generated Thumbnail" className="w-full h-full object-cover" />
                        <div className="absolute top-2 right-2 bg-black/80 text-white text-[10px] font-bold px-2 py-1 rounded">
                            PREVIEW THUMBNAIL
                        </div>
                    </>
                ) : (
                    <div className="flex items-center justify-center h-full text-slate-600">
                        <ImageIcon size={32} />
                    </div>
                )}
            </div>
            
            <button className="w-full py-3 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-lg font-bold text-xs flex items-center justify-center gap-2 border border-slate-700 transition">
                <Download size={14} /> Baixar MP4 Final (14.5 MB)
            </button>
            <button className="w-full py-3 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-lg font-bold text-xs flex items-center justify-center gap-2 border border-slate-700 transition">
                <Download size={14} /> Baixar Thumbnail (PNG)
            </button>
        </div>

        {/* Right Col: Metadata */}
        <div className="lg:col-span-2 space-y-5">
            
            {/* Titles */}
            <div>
                <label className="text-[10px] font-bold text-slate-500 uppercase flex items-center gap-1.5 mb-2">
                    <Type size={12} /> Opções de Títulos Virais
                </label>
                <div className="space-y-2">
                    {titles.map((title, idx) => (
                        <div key={idx} className="flex gap-2 group">
                            <input 
                                readOnly 
                                value={title}
                                className="flex-1 bg-slate-950 border border-slate-800 rounded px-3 py-2 text-sm text-slate-200 font-medium focus:border-emerald-500 outline-none"
                            />
                            <button className="p-2 bg-slate-800 rounded border border-slate-700 hover:bg-emerald-600 hover:border-emerald-500 hover:text-white text-slate-400 transition">
                                <Copy size={14} />
                            </button>
                        </div>
                    ))}
                </div>
            </div>

            {/* Description */}
            <div>
                <label className="text-[10px] font-bold text-slate-500 uppercase flex items-center gap-1.5 mb-2">
                    <Type size={12} /> Descrição (SEO)
                </label>
                <div className="relative">
                    <textarea 
                        readOnly 
                        value={description}
                        rows={6}
                        className="w-full bg-slate-950 border border-slate-800 rounded px-3 py-2 text-xs text-slate-300 font-mono focus:border-emerald-500 outline-none resize-none"
                    />
                    <button className="absolute top-2 right-2 p-1.5 bg-slate-800/80 rounded hover:bg-emerald-600 text-slate-400 hover:text-white transition">
                        <Copy size={12} />
                    </button>
                </div>
            </div>

            {/* Tags */}
            <div>
                <label className="text-[10px] font-bold text-slate-500 uppercase flex items-center gap-1.5 mb-2">
                    <Hash size={12} /> Tags Virais
                </label>
                <div className="flex flex-wrap gap-1.5 p-3 bg-slate-950 border border-slate-800 rounded min-h-[60px]">
                    {tags.map((tag, i) => (
                        <span key={i} className="text-[10px] bg-slate-900 text-emerald-400 px-2 py-0.5 rounded border border-slate-800">
                            #{tag}
                        </span>
                    ))}
                </div>
            </div>

        </div>

      </div>
    </div>
  );
};

export default DistributionPanel;