import React from 'react';
import { Cpu, Database, Activity, Thermometer, Box } from 'lucide-react';
import { SystemMetrics } from '../types';

interface SystemHealthProps {
  metrics: SystemMetrics;
}

const StatCard = ({ label, value, icon: Icon, color, percent }: any) => (
  <div className="bg-white border border-[#E2E8F0] p-3 rounded-xl flex flex-col justify-between relative overflow-hidden shadow-sm">
    <div className="flex justify-between items-start mb-2 relative z-10">
      <div className="flex items-center gap-2 text-[#64748B] text-[11px] font-medium">
        <Icon size={12} /> {label}
      </div>
      <span className={`text-xs font-mono font-semibold ${color}`}>{value}</span>
    </div>

    {percent !== undefined && (
      <div className="h-1 bg-[#E2E8F0] w-full rounded-full overflow-hidden relative z-10">
        <div
          className={`h-full rounded-full ${color.replace('text-', 'bg-')} transition-all duration-500`}
          style={{ width: `${percent}%` }}
        />
      </div>
    )}
  </div>
);

const SystemHealth: React.FC<SystemHealthProps> = ({ metrics }) => {
  return (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
      <StatCard
        label="CPU"
        value={`${metrics.cpuUsage}%`}
        percent={metrics.cpuUsage}
        icon={Cpu}
        color={metrics.cpuUsage > 80 ? 'text-red-400' : 'text-cyan-400'}
      />

      <StatCard
        label="GPU"
        value={`${metrics.gpuUsage}%`}
        percent={metrics.gpuUsage}
        icon={Activity}
        color="text-blue-400"
      />

      <StatCard
        label="Memória"
        value={`${metrics.ramUsage}%`}
        percent={metrics.ramUsage}
        icon={Database}
        color="text-emerald-400"
      />

      <div className="bg-white border border-[#E2E8F0] p-3 rounded-xl flex flex-col justify-between shadow-sm">
        <div className="flex justify-between items-center">
          <div className="flex items-center gap-2 text-[#64748B] text-[11px] font-medium">
            <Box size={12} /> Nós
          </div>
          <span className="text-xs font-mono font-semibold text-[#0F172A]">{metrics.activeContainers}</span>
        </div>
        <div className="h-[1px] bg-[#E2E8F0] my-2"></div>
        <div className="flex justify-between items-center">
          <div className="flex items-center gap-2 text-[#64748B] text-[11px] font-medium">
            <Thermometer size={12} /> Térmico
          </div>
          <span className={`text-xs font-mono font-semibold ${metrics.temperature > 80 ? 'text-orange-400' : 'text-[#94A3B8]'}`}>{metrics.temperature}°C</span>
        </div>
      </div>
    </div>
  );
};

export default SystemHealth;