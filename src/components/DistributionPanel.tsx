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
        <div className="bg-white border border-teal-200 rounded-xl p-6 mb-6 shadow-sm">
            <div className="flex items-center gap-3 mb-6 border-b border-[#E2E8F0] pb-4">
                <div className="w-10 h-10 rounded-full bg-teal-50 flex items-center justify-center text-primary">
                    <Youtube size={20} />
                </div>
                <div>
                    <h3 className="text-lg font-bold text-[#0F172A]">Distribuição Pronta</h3>
                    <p className="text-xs text-[#64748B]">Metadados gerados pelo Gemini 3 Flash com base na análise do roteiro final.</p>
                </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">

                {/* Left Col: Thumbnail & Preview */}
                <div className="space-y-4">
                    <div className="bg-[#F1F5F9] rounded-lg overflow-hidden border border-[#E2E8F0] aspect-video relative group">
                        {thumbnailUrl ? (
                            <>
                                <img src={thumbnailUrl} alt="Generated Thumbnail" className="w-full h-full object-cover" />
                                <div className="absolute top-2 right-2 bg-black/80 text-white text-[10px] font-bold px-2 py-1 rounded">
                                    PREVIEW THUMBNAIL
                                </div>
                            </>
                        ) : (
                            <div className="flex items-center justify-center h-full text-[#CBD5E1]">
                                <ImageIcon size={32} />
                            </div>
                        )}
                    </div>

                    <button className="w-full py-3 bg-[#F1F5F9] hover:bg-[#E2E8F0] text-[#0F172A] rounded-lg font-bold text-xs flex items-center justify-center gap-2 border border-[#E2E8F0] transition">
                        <Download size={14} /> Baixar MP4 Final (14.5 MB)
                    </button>
                    <button className="w-full py-3 bg-[#F1F5F9] hover:bg-[#E2E8F0] text-[#0F172A] rounded-lg font-bold text-xs flex items-center justify-center gap-2 border border-[#E2E8F0] transition">
                        <Download size={14} /> Baixar Thumbnail (PNG)
                    </button>
                </div>

                {/* Right Col: Metadata */}
                <div className="lg:col-span-2 space-y-5">

                    {/* Titles */}
                    <div>
                        <label className="text-[10px] font-bold text-[#64748B] uppercase flex items-center gap-1.5 mb-2">
                            <Type size={12} /> Opções de Títulos Virais
                        </label>
                        <div className="space-y-2">
                            {titles.map((title, idx) => (
                                <div key={idx} className="flex gap-2 group">
                                    <input
                                        readOnly
                                        value={title}
                                        className="flex-1 bg-[#F8FAFC] border border-[#E2E8F0] rounded px-3 py-2 text-sm text-[#0F172A] font-medium focus:border-primary outline-none"
                                    />
                                    <button className="p-2 bg-[#F1F5F9] rounded border border-[#E2E8F0] hover:bg-primary hover:border-primary hover:text-white text-[#64748B] transition">
                                        <Copy size={14} />
                                    </button>
                                </div>
                            ))}
                        </div>
                    </div>

                    {/* Description */}
                    <div>
                        <label className="text-[10px] font-bold text-[#64748B] uppercase flex items-center gap-1.5 mb-2">
                            <Type size={12} /> Descrição (SEO)
                        </label>
                        <div className="relative">
                            <textarea
                                readOnly
                                value={description}
                                rows={6}
                                className="w-full bg-[#F8FAFC] border border-[#E2E8F0] rounded px-3 py-2 text-xs text-[#0F172A] font-mono focus:border-primary outline-none resize-none"
                            />
                            <button className="absolute top-2 right-2 p-1.5 bg-white/80 rounded hover:bg-primary text-[#64748B] hover:text-white transition">
                                <Copy size={12} />
                            </button>
                        </div>
                    </div>

                    {/* Tags */}
                    <div>
                        <label className="text-[10px] font-bold text-[#64748B] uppercase flex items-center gap-1.5 mb-2">
                            <Hash size={12} /> Tags Virais
                        </label>
                        <div className="flex flex-wrap gap-1.5 p-3 bg-[#F8FAFC] border border-[#E2E8F0] rounded min-h-[60px]">
                            {tags.map((tag, i) => (
                                <span key={i} className="text-[10px] bg-teal-50 text-primary px-2 py-0.5 rounded border border-teal-200">
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