import React, { useMemo } from 'react';
import { VideoProject, ChannelProfile, PipelineStage } from '../types';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, CartesianGrid } from 'recharts';
import { Activity, FileText, Cpu, CheckCircle, TrendingUp, Users, AlertCircle } from 'lucide-react';

interface DashboardProps {
    projects: VideoProject[];
    profiles: ChannelProfile[];
}

const COLORS = ['#10B981', '#3B82F6', '#6366F1', '#8B5CF6', '#EC4899', '#F59E0B', '#EF4444', '#14B8A6'];

export const Dashboard: React.FC<DashboardProps> = ({ projects, profiles }) => {

    // --- 1. KPIs ---
    const kpis = useMemo(() => {
        const total = projects.length;
        const scripting = projects.filter(p => [PipelineStage.REFERENCE, PipelineStage.SCRIPT].includes(p.currentStage)).length;
        const inProduction = projects.filter(p =>
            [
                PipelineStage.AUDIO,
                PipelineStage.AUDIO_COMPRESS,
                PipelineStage.SUBTITLES,
                PipelineStage.IMAGES,
                PipelineStage.VIDEO,
                PipelineStage.THUMBNAIL
            ].includes(p.currentStage)
        ).length;
        const completed = projects.filter(p => [PipelineStage.PUBLISH_YT, PipelineStage.PUBLISH_THUMB].includes(p.currentStage)).length;

        return { total, scripting, inProduction, completed };
    }, [projects]);

    // --- 2. Funnel Data ---
    const funnelData = useMemo(() => {
        const counts: Record<string, number> = {};
        projects.forEach(p => {
            counts[p.currentStage] = (counts[p.currentStage] || 0) + 1;
        });

        // Order mapping based on logical flow
        const stages = [
            { key: PipelineStage.REFERENCE, label: 'Ref' },
            { key: PipelineStage.SCRIPT, label: 'Text' },
            { key: PipelineStage.AUDIO, label: 'Audio' },
            { key: PipelineStage.IMAGES, label: 'Img' },
            { key: PipelineStage.VIDEO, label: 'Video' },
            { key: PipelineStage.PUBLISH_YT, label: 'Pub' },
        ];

        return stages.map(s => ({
            name: s.label,
            count: counts[s.key] || 0
        }));
    }, [projects]);

    // --- 3. Channel Distribution ---
    const channelData = useMemo(() => {
        const counts: Record<string, number> = {};
        projects.forEach(p => {
            const channelName = profiles.find(prof => prof.id === p.channelId)?.name || 'Desconhecido';
            counts[channelName] = (counts[channelName] || 0) + 1;
        });

        return Object.entries(counts).map(([name, value]) => ({ name, value }));
    }, [projects, profiles]);


    return (
        <div className="flex-1 overflow-y-auto bg-[#F8FAFC] p-8 custom-scrollbar">

            <div className="max-w-7xl mx-auto space-y-8">

                {/* HEADER */}
                <div>
                    <h2 className="text-2xl font-bold text-[#0F172A] flex items-center gap-3">
                        <Activity className="text-primary" />
                        Dashboard de Produção
                    </h2>
                    <p className="text-[#64748B] mt-1">Visão geral da sua fábrica de conteúdo em tempo real.</p>
                </div>

                {/* KPI CARDS */}
                <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
                    {/* TOTAL */}
                    <div className="bg-white p-6 rounded-2xl border border-[#E2E8F0] shadow-sm flex items-center gap-4 hover:border-[#CBD5E1] transition">
                        <div className="p-3 bg-blue-50 text-blue-600 rounded-xl">
                            <TrendingUp size={24} />
                        </div>
                        <div>
                            <p className="text-sm font-medium text-[#64748B]">Total Projetos</p>
                            <p className="text-2xl font-bold text-[#0F172A]">{kpis.total}</p>
                        </div>
                    </div>

                    {/* SCRIPTING */}
                    <div className="bg-white p-6 rounded-2xl border border-[#E2E8F0] shadow-sm flex items-center gap-4 hover:border-[#CBD5E1] transition">
                        <div className="p-3 bg-purple-50 text-purple-600 rounded-xl">
                            <FileText size={24} />
                        </div>
                        <div>
                            <p className="text-sm font-medium text-[#64748B]">Em Roteiro</p>
                            <p className="text-2xl font-bold text-[#0F172A]">{kpis.scripting}</p>
                        </div>
                    </div>

                    {/* PRODUCTION */}
                    <div className="bg-white p-6 rounded-2xl border border-[#E2E8F0] shadow-sm flex items-center gap-4 hover:border-[#CBD5E1] transition">
                        <div className="p-3 bg-orange-50 text-orange-600 rounded-xl">
                            <Cpu size={24} />
                        </div>
                        <div>
                            <p className="text-sm font-medium text-[#64748B]">Em Produção</p>
                            <p className="text-2xl font-bold text-[#0F172A]">{kpis.inProduction}</p>
                        </div>
                    </div>

                    {/* COMPLETED */}
                    <div className="bg-white p-6 rounded-2xl border border-[#E2E8F0] shadow-sm flex items-center gap-4 hover:border-[#CBD5E1] transition">
                        <div className="p-3 bg-emerald-50 text-emerald-600 rounded-xl">
                            <CheckCircle size={24} />
                        </div>
                        <div>
                            <p className="text-sm font-medium text-[#64748B]">Concluídos</p>
                            <p className="text-2xl font-bold text-[#0F172A]">{kpis.completed}</p>
                        </div>
                    </div>
                </div>

                {/* CHARTS ROW */}
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">

                    {/* FUNNEL CHART */}
                    <div className="bg-white p-6 rounded-2xl border border-[#E2E8F0] shadow-sm h-[400px] flex flex-col">
                        <h3 className="text-lg font-bold text-[#0F172A] mb-6 flex items-center gap-2">
                            <Activity size={18} className="text-[#64748B]" />
                            Funil de Produção
                        </h3>
                        <div className="flex-1 min-h-0">
                            <ResponsiveContainer width="100%" height="100%">
                                <BarChart data={funnelData} barSize={40}>
                                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E2E8F0" />
                                    <XAxis
                                        dataKey="name"
                                        axisLine={false}
                                        tickLine={false}
                                        tick={{ fill: '#64748B', fontSize: 12 }}
                                        dy={10}
                                    />
                                    <YAxis
                                        axisLine={false}
                                        tickLine={false}
                                        tick={{ fill: '#64748B', fontSize: 12 }}
                                    />
                                    <Tooltip
                                        cursor={{ fill: '#F1F5F9' }}
                                        contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}
                                    />
                                    <Bar dataKey="count" fill="#3B82F6" radius={[6, 6, 0, 0]} />
                                </BarChart>
                            </ResponsiveContainer>
                        </div>
                    </div>

                    {/* CHANNEL DISTRIBUTION */}
                    <div className="bg-white p-6 rounded-2xl border border-[#E2E8F0] shadow-sm h-[400px] flex flex-col">
                        <h3 className="text-lg font-bold text-[#0F172A] mb-6 flex items-center gap-2">
                            <Users size={18} className="text-[#64748B]" />
                            Distribuição por Canal
                        </h3>
                        <div className="flex-1 min-h-0 flex items-center justify-center">
                            {channelData.length > 0 ? (
                                <ResponsiveContainer width="100%" height="100%">
                                    <PieChart>
                                        <Pie
                                            data={channelData}
                                            innerRadius={80}
                                            outerRadius={110}
                                            paddingAngle={5}
                                            dataKey="value"
                                        >
                                            {channelData.map((entry, index) => (
                                                <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} strokeWidth={0} />
                                            ))}
                                        </Pie>
                                        <Tooltip
                                            contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}
                                        />
                                    </PieChart>
                                </ResponsiveContainer>
                            ) : (
                                <div className="text-center text-[#94A3B8]">
                                    <AlertCircle size={40} className="mx-auto mb-2 opacity-50" />
                                    <p>Nenhum dado disponível</p>
                                </div>
                            )}
                        </div>

                        {/* LEGEND */}
                        <div className="mt-4 flex flex-wrap gap-3 justify-center">
                            {channelData.map((entry, index) => (
                                <div key={index} className="flex items-center gap-2 text-xs text-[#64748B]">
                                    <span className="w-3 h-3 rounded-full" style={{ backgroundColor: COLORS[index % COLORS.length] }} />
                                    {entry.name} ({entry.value})
                                </div>
                            ))}
                        </div>
                    </div>

                </div>

            </div>
        </div>
    );
};
