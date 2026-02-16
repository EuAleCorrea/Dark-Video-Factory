import React, { useMemo } from 'react';
import { VideoProject, ChannelProfile, PipelineStage, STAGE_META, PIPELINE_STAGES_ORDER, StageDataMap } from '../types';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, CartesianGrid } from 'recharts';
import {
    Activity, FileText, Cpu, CheckCircle, TrendingUp, Users,
    AlertTriangle, Search, Clock, Zap, BarChart3, Type,
    Timer, Eye, Radio
} from 'lucide-react';

interface DashboardProps {
    projects: VideoProject[];
    profiles: ChannelProfile[];
}

const CHANNEL_COLORS = ['#10B981', '#3B82F6', '#6366F1', '#8B5CF6', '#EC4899', '#F59E0B', '#EF4444', '#14B8A6'];

const STATUS_CONFIG: Record<string, { label: string; color: string; bg: string }> = {
    waiting: { label: 'Aguardando', color: '#94A3B8', bg: '#F1F5F9' },
    processing: { label: 'Processando', color: '#8B5CF6', bg: '#F5F3FF' },
    ready: { label: 'Pronto', color: '#10B981', bg: '#ECFDF5' },
    review: { label: 'Revisão', color: '#F59E0B', bg: '#FFFBEB' },
    error: { label: 'Erro', color: '#EF4444', bg: '#FEF2F2' },
    pending: { label: 'Pendente', color: '#F97316', bg: '#FFF7ED' },
};

function timeAgo(dateStr: string): string {
    const now = new Date();
    const date = new Date(dateStr);
    const diffMs = now.getTime() - date.getTime();
    const diffMin = Math.floor(diffMs / 60000);
    if (diffMin < 1) return 'agora';
    if (diffMin < 60) return `${diffMin}min atrás`;
    const diffH = Math.floor(diffMin / 60);
    if (diffH < 24) return `${diffH}h atrás`;
    const diffD = Math.floor(diffH / 24);
    if (diffD < 7) return `${diffD}d atrás`;
    return date.toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' });
}

function formatDuration(seconds: number): string {
    if (seconds < 60) return `${Math.round(seconds)}s`;
    const min = Math.floor(seconds / 60);
    const sec = Math.round(seconds % 60);
    if (min < 60) return `${min}m ${sec}s`;
    const h = Math.floor(min / 60);
    return `${h}h ${min % 60}m`;
}

/** Matches ProjectCard logic: if status is 'ready' but stage has no data, show as 'pending' */
function getEffectiveStatus(project: VideoProject): string {
    if (project.status === 'processing' || project.status === 'error' || project.status === 'review') {
        return project.status;
    }
    const key = project.currentStage as keyof StageDataMap;
    const data = project.stageData[key];
    if (!data) return 'pending';
    if (key === 'reference') {
        const ref = data as StageDataMap['reference'] | undefined;
        return (ref?.transcript && ref.transcript.trim().length > 0) ? 'ready' : 'pending';
    }
    return 'ready';
}

export const Dashboard: React.FC<DashboardProps> = ({ projects, profiles }) => {

    // ═══ 1. KPIs ═══
    const kpis = useMemo(() => {
        const total = projects.length;
        const inReference = projects.filter(p => p.currentStage === PipelineStage.REFERENCE).length;
        const inScript = projects.filter(p => p.currentStage === PipelineStage.SCRIPT).length;
        const inProduction = projects.filter(p =>
            [PipelineStage.AUDIO, PipelineStage.AUDIO_COMPRESS, PipelineStage.SUBTITLES,
            PipelineStage.IMAGES, PipelineStage.VIDEO, PipelineStage.THUMBNAIL].includes(p.currentStage)
        ).length;
        const completed = projects.filter(p =>
            [PipelineStage.PUBLISH_YT, PipelineStage.PUBLISH_THUMB].includes(p.currentStage)
        ).length;
        const errors = projects.filter(p => p.status === 'error').length;
        return { total, inReference, inScript, inProduction, completed, errors };
    }, [projects]);

    // ═══ 2. Funnel — all 10 stages ═══
    const funnelData = useMemo(() => {
        const counts: Record<string, number> = {};
        projects.forEach(p => { counts[p.currentStage] = (counts[p.currentStage] || 0) + 1; });
        return PIPELINE_STAGES_ORDER.map(stage => ({
            name: STAGE_META[stage].label,
            count: counts[stage] || 0,
            fill: STAGE_META[stage].color,
        }));
    }, [projects]);

    // ═══ 3. Channel distribution ═══
    const channelData = useMemo(() => {
        const counts: Record<string, number> = {};
        projects.forEach(p => {
            const name = profiles.find(prof => prof.id === p.channelId)?.name || 'Desconhecido';
            counts[name] = (counts[name] || 0) + 1;
        });
        return Object.entries(counts).map(([name, value]) => ({ name, value }));
    }, [projects, profiles]);

    // ═══ 4. Status breakdown ═══
    const statusData = useMemo(() => {
        const counts: Record<string, number> = {};
        projects.forEach(p => { counts[getEffectiveStatus(p)] = (counts[getEffectiveStatus(p)] || 0) + 1; });
        return Object.entries(STATUS_CONFIG)
            .map(([key, cfg]) => ({ key, label: cfg.label, count: counts[key] || 0, color: cfg.color, bg: cfg.bg }))
            .filter(s => s.count > 0);
    }, [projects]);

    const statusTotal = useMemo(() => statusData.reduce((a, s) => a + s.count, 0), [statusData]);

    // ═══ 5. Recent activity ═══
    const recentProjects = useMemo(() => {
        return [...projects]
            .sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime())
            .slice(0, 8);
    }, [projects]);

    // ═══ 6. Content stats ═══
    const contentStats = useMemo(() => {
        let totalWords = 0, totalDuration = 0, totalViews = 0, viewCount = 0;
        projects.forEach(p => {
            if (p.stageData.script?.wordCount) totalWords += p.stageData.script.wordCount;
            if (p.stageData.audio?.duration) totalDuration += p.stageData.audio.duration;
            if (p.stageData.reference?.viewCount) { totalViews += p.stageData.reference.viewCount; viewCount++; }
        });
        const activeChannels = new Set(projects.map(p => p.channelId)).size;
        const avgViews = viewCount > 0 ? Math.round(totalViews / viewCount) : 0;
        return { totalWords, totalDuration, avgViews, activeChannels };
    }, [projects]);

    // ═══ Custom bar shape ═══
    const CustomBar = (props: any) => {
        const { x, y, width, height, fill } = props;
        return <rect x={x} y={y} width={width} height={height} rx={6} ry={6} fill={fill} />;
    };

    return (
        <div className="flex-1 overflow-y-auto bg-[#F8FAFC] p-8 custom-scrollbar">
            <div className="max-w-7xl mx-auto space-y-8">

                {/* HEADER */}
                <div>
                    <h2 className="text-2xl font-bold text-[#0F172A] flex items-center gap-3">
                        <Activity className="text-emerald-500" />
                        Dashboard de Produção
                    </h2>
                    <p className="text-[#64748B] mt-1">Visão geral da sua fábrica de conteúdo em tempo real.</p>
                </div>

                {/* KPI CARDS (6) */}
                <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
                    {[
                        { label: 'Total Projetos', value: kpis.total, icon: TrendingUp, iconBg: 'bg-blue-50', iconColor: 'text-blue-600' },
                        { label: 'Em Referência', value: kpis.inReference, icon: Search, iconBg: 'bg-indigo-50', iconColor: 'text-indigo-600' },
                        { label: 'Em Roteiro', value: kpis.inScript, icon: FileText, iconBg: 'bg-purple-50', iconColor: 'text-purple-600' },
                        { label: 'Em Produção', value: kpis.inProduction, icon: Cpu, iconBg: 'bg-orange-50', iconColor: 'text-orange-600' },
                        { label: 'Concluídos', value: kpis.completed, icon: CheckCircle, iconBg: 'bg-emerald-50', iconColor: 'text-emerald-600' },
                        { label: 'Com Erro', value: kpis.errors, icon: AlertTriangle, iconBg: 'bg-red-50', iconColor: 'text-red-500' },
                    ].map((kpi, i) => (
                        <div key={i} className="bg-white p-5 rounded-2xl border border-[#E2E8F0] shadow-sm flex items-center gap-3 hover:border-[#CBD5E1] hover:shadow-md transition-all duration-200">
                            <div className={`p-2.5 rounded-xl ${kpi.iconBg} ${kpi.iconColor}`}>
                                <kpi.icon size={20} />
                            </div>
                            <div>
                                <p className="text-xs font-medium text-[#94A3B8] uppercase tracking-wide">{kpi.label}</p>
                                <p className="text-xl font-bold text-[#0F172A]">{kpi.value}</p>
                            </div>
                        </div>
                    ))}
                </div>

                {/* CHARTS ROW */}
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">

                    {/* FUNNEL — 10 stages */}
                    <div className="bg-white p-6 rounded-2xl border border-[#E2E8F0] shadow-sm flex flex-col">
                        <h3 className="text-base font-bold text-[#0F172A] mb-5 flex items-center gap-2">
                            <BarChart3 size={18} className="text-[#64748B]" />
                            Pipeline — Funil de Produção
                        </h3>
                        <div className="flex-1 min-h-[300px]">
                            <ResponsiveContainer width="100%" height="100%">
                                <BarChart data={funnelData} barSize={28}>
                                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E2E8F0" />
                                    <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fill: '#64748B', fontSize: 10 }} dy={10} angle={-35} textAnchor="end" height={60} />
                                    <YAxis axisLine={false} tickLine={false} tick={{ fill: '#94A3B8', fontSize: 11 }} allowDecimals={false} />
                                    <Tooltip
                                        cursor={{ fill: '#F1F5F9' }}
                                        contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 4px 12px rgb(0 0 0 / 0.1)', fontSize: '13px' }}
                                        formatter={(value: any) => [`${value} projetos`, 'Quantidade']}
                                    />
                                    <Bar dataKey="count" shape={<CustomBar />}>
                                        {funnelData.map((entry, index) => (
                                            <Cell key={`cell-${index}`} fill={entry.fill} />
                                        ))}
                                    </Bar>
                                </BarChart>
                            </ResponsiveContainer>
                        </div>
                    </div>

                    {/* CHANNEL DISTRIBUTION */}
                    <div className="bg-white p-6 rounded-2xl border border-[#E2E8F0] shadow-sm flex flex-col">
                        <h3 className="text-base font-bold text-[#0F172A] mb-5 flex items-center gap-2">
                            <Users size={18} className="text-[#64748B]" />
                            Distribuição por Canal
                        </h3>
                        <div className="flex-1 min-h-[250px] flex items-center justify-center">
                            {channelData.length > 0 ? (
                                <ResponsiveContainer width="100%" height="100%">
                                    <PieChart>
                                        <Pie data={channelData} innerRadius={70} outerRadius={100} paddingAngle={4} dataKey="value">
                                            {channelData.map((_entry, index) => (
                                                <Cell key={`cell-${index}`} fill={CHANNEL_COLORS[index % CHANNEL_COLORS.length]} strokeWidth={0} />
                                            ))}
                                        </Pie>
                                        <Tooltip
                                            contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 4px 12px rgb(0 0 0 / 0.1)', fontSize: '13px' }}
                                            formatter={(value: any) => [`${value} projetos`, 'Quantidade']}
                                        />
                                    </PieChart>
                                </ResponsiveContainer>
                            ) : (
                                <div className="text-center text-[#94A3B8]">
                                    <Users size={40} className="mx-auto mb-2 opacity-40" />
                                    <p className="text-sm">Nenhum projeto criado</p>
                                </div>
                            )}
                        </div>
                        <div className="mt-3 flex flex-wrap gap-3 justify-center">
                            {channelData.map((entry, index) => (
                                <div key={index} className="flex items-center gap-1.5 text-xs text-[#64748B]">
                                    <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: CHANNEL_COLORS[index % CHANNEL_COLORS.length] }} />
                                    {entry.name} ({entry.value})
                                </div>
                            ))}
                        </div>
                    </div>
                </div>

                {/* STATUS + RECENT */}
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">

                    {/* STATUS BREAKDOWN */}
                    <div className="bg-white p-6 rounded-2xl border border-[#E2E8F0] shadow-sm">
                        <h3 className="text-base font-bold text-[#0F172A] mb-5 flex items-center gap-2">
                            <Zap size={18} className="text-[#64748B]" />
                            Status dos Projetos
                        </h3>
                        {statusData.length > 0 ? (
                            <div className="space-y-4">
                                <div className="h-4 rounded-full overflow-hidden flex bg-[#F1F5F9]">
                                    {statusData.map((s) => (
                                        <div key={s.key} className="h-full transition-all duration-500" style={{ width: `${(s.count / statusTotal) * 100}%`, backgroundColor: s.color }} title={`${s.label}: ${s.count}`} />
                                    ))}
                                </div>
                                <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                                    {statusData.map((s) => (
                                        <div key={s.key} className="flex items-center gap-2.5 p-2.5 rounded-xl" style={{ backgroundColor: s.bg }}>
                                            <span className="w-3 h-3 rounded-full flex-shrink-0" style={{ backgroundColor: s.color }} />
                                            <div>
                                                <p className="text-xs font-medium" style={{ color: s.color }}>{s.label}</p>
                                                <p className="text-lg font-bold text-[#0F172A]">{s.count}</p>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        ) : (
                            <div className="text-center text-[#94A3B8] py-8">
                                <Zap size={36} className="mx-auto mb-2 opacity-40" />
                                <p className="text-sm">Nenhum projeto ainda</p>
                            </div>
                        )}
                    </div>

                    {/* RECENT ACTIVITY */}
                    <div className="bg-white p-6 rounded-2xl border border-[#E2E8F0] shadow-sm">
                        <h3 className="text-base font-bold text-[#0F172A] mb-5 flex items-center gap-2">
                            <Clock size={18} className="text-[#64748B]" />
                            Atividade Recente
                        </h3>
                        {recentProjects.length > 0 ? (
                            <div className="space-y-1">
                                {recentProjects.map((p, i) => {
                                    const stageMeta = STAGE_META[p.currentStage];
                                    const statusCfg = STATUS_CONFIG[p.status] || STATUS_CONFIG.waiting;
                                    return (
                                        <div key={p.id} className="flex items-center gap-3 p-2.5 rounded-xl hover:bg-[#F8FAFC] transition-colors group">
                                            <div className="flex flex-col items-center gap-1">
                                                <div className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ backgroundColor: stageMeta.color }} />
                                                {i < recentProjects.length - 1 && <div className="w-px h-6 bg-[#E2E8F0]" />}
                                            </div>
                                            <div className="flex-1 min-w-0">
                                                <p className="text-sm font-medium text-[#0F172A] truncate">{p.title}</p>
                                                <div className="flex items-center gap-2 mt-0.5">
                                                    <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded-md" style={{ backgroundColor: stageMeta.bgColor, color: stageMeta.color }}>
                                                        {stageMeta.label}
                                                    </span>
                                                    <span className="text-[10px] font-medium px-1.5 py-0.5 rounded-md" style={{ backgroundColor: statusCfg.bg, color: statusCfg.color }}>
                                                        {statusCfg.label}
                                                    </span>
                                                </div>
                                            </div>
                                            <span className="text-[11px] text-[#94A3B8] flex-shrink-0 opacity-0 group-hover:opacity-100 transition-opacity">
                                                {timeAgo(p.updatedAt)}
                                            </span>
                                        </div>
                                    );
                                })}
                            </div>
                        ) : (
                            <div className="text-center text-[#94A3B8] py-8">
                                <Clock size={36} className="mx-auto mb-2 opacity-40" />
                                <p className="text-sm">Sem atividade recente</p>
                            </div>
                        )}
                    </div>
                </div>

                {/* CONTENT STATS */}
                <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                    {[
                        { label: 'Palavras Geradas', value: contentStats.totalWords > 0 ? contentStats.totalWords.toLocaleString('pt-BR') : '—', icon: Type, color: 'text-violet-500', bg: 'bg-violet-50', sub: 'Total de roteiros' },
                        { label: 'Duração de Áudio', value: contentStats.totalDuration > 0 ? formatDuration(contentStats.totalDuration) : '—', icon: Timer, color: 'text-pink-500', bg: 'bg-pink-50', sub: 'Soma dos TTS gerados' },
                        { label: 'Views Média (Ref)', value: contentStats.avgViews > 0 ? contentStats.avgViews.toLocaleString('pt-BR') : '—', icon: Eye, color: 'text-sky-500', bg: 'bg-sky-50', sub: 'Vídeos de referência' },
                        { label: 'Canais Ativos', value: contentStats.activeChannels, icon: Radio, color: 'text-emerald-500', bg: 'bg-emerald-50', sub: `de ${profiles.length} perfis` },
                    ].map((stat, i) => (
                        <div key={i} className="bg-white p-5 rounded-2xl border border-[#E2E8F0] shadow-sm hover:shadow-md hover:border-[#CBD5E1] transition-all duration-200">
                            <div className="flex items-center gap-2 mb-3">
                                <div className={`p-2 rounded-lg ${stat.bg} ${stat.color}`}>
                                    <stat.icon size={16} />
                                </div>
                                <span className="text-xs font-medium text-[#94A3B8] uppercase tracking-wide">{stat.label}</span>
                            </div>
                            <p className="text-2xl font-bold text-[#0F172A]">{stat.value}</p>
                            <p className="text-[11px] text-[#94A3B8] mt-1">{stat.sub}</p>
                        </div>
                    ))}
                </div>

            </div>
        </div>
    );
};
