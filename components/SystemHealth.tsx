import React from 'react';
import { Cpu, Database, Activity, Thermometer, Box } from 'lucide-react';
import { SystemMetrics } from '../types';

interface SystemHealthProps {
  metrics: SystemMetrics;
}

const StatCard = ({ label, value, subValue, icon: Icon, color, percent }: any) => (
  <div className="glass-panel p-3 rounded-lg flex flex-col justify-between relative overflow-hidden">
      <div className="flex justify-between items-start mb-2 relative z-10">
          <div className="flex items-center gap-2 text-zinc-500 text-[10px] font-bold uppercase tracking-wider">
            <Icon size={12} /> {label}
          </div>
          <span className={`text-xs font-mono font-bold ${color}`}>{value}</span>
      </div>
      
      {percent !== undefined && (
          <div className="h-0.5 bg-zinc-800 w-full overflow-hidden relative z-10">
              <div 
                className={`h-full ${color.replace('text-', 'bg-')} shadow-[0_0_8px_currentColor] transition-all duration-500`} 
                style={{ width: `${percent}%` }}
              />
          </div>
      )}
      
      {/* Background Glow */}
      <div className={`absolute -right-4 -bottom-4 w-16 h-16 opacity-10 blur-xl rounded-full ${color.replace('text-', 'bg-')}`}></div>
  </div>
);

const SystemHealth: React.FC<SystemHealthProps> = ({ metrics }) => {
  return (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
      <StatCard 
        label="Núcleo CPU" 
        value={`${metrics.cpuUsage}%`} 
        percent={metrics.cpuUsage}
        icon={Cpu} 
        color={metrics.cpuUsage > 80 ? 'text-red-500' : 'text-cyan-400'} 
      />
      
      <StatCard 
        label="Cluster GPU" 
        value={`${metrics.gpuUsage}%`} 
        percent={metrics.gpuUsage}
        icon={Activity} 
        color="text-purple-400" 
      />

      <StatCard 
        label="Memória" 
        value={`${metrics.ramUsage}%`} 
        percent={metrics.ramUsage}
        icon={Database} 
        color="text-emerald-400" 
      />

      <div className="glass-panel p-3 rounded-lg flex flex-col justify-between">
         <div className="flex justify-between items-center">
            <div className="flex items-center gap-2 text-zinc-500 text-[10px] font-bold uppercase tracking-wider">
                <Box size={12} /> Nós
            </div>
            <span className="text-xs font-mono font-bold text-white">{metrics.activeContainers}</span>
         </div>
         <div className="h-[1px] bg-white/5 my-2"></div>
         <div className="flex justify-between items-center">
            <div className="flex items-center gap-2 text-zinc-500 text-[10px] font-bold uppercase tracking-wider">
                <Thermometer size={12} /> Térmico
            </div>
            <span className={`text-xs font-mono font-bold ${metrics.temperature > 80 ? 'text-orange-400' : 'text-zinc-300'}`}>{metrics.temperature}°C</span>
         </div>
      </div>
    </div>
  );
};

export default SystemHealth;