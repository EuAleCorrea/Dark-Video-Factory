import React, { useState } from 'react';
import { ChevronDown, ChevronRight, Move, Maximize, Eye, Palette } from 'lucide-react';

interface PropertySectionProps {
  title: string;
  icon: React.ElementType;
  defaultOpen?: boolean;
  children: React.ReactNode;
}

function PropertySection({ title, icon: Icon, defaultOpen = false, children }: PropertySectionProps) {
  const [isOpen, setIsOpen] = useState(defaultOpen);

  return (
    <div className="border-b border-theme">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="w-full flex items-center gap-2 px-3 py-2.5 text-sm font-medium text-theme-primary hover:bg-[var(--df-bg-hover)] transition-colors"
      >
        {isOpen ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
        <Icon size={14} className="text-primary" />
        <span>{title}</span>
      </button>
      {isOpen && (
        <div className="px-3 pb-3 space-y-2.5">
          {children}
        </div>
      )}
    </div>
  );
}

interface PropertyRowProps {
  label: string;
  value: string;
  suffix?: string;
}

function PropertyRow({ label, value, suffix }: PropertyRowProps) {
  return (
    <div className="flex items-center gap-2">
      <label className="text-[11px] text-theme-muted w-8 shrink-0">{label}</label>
      <div className="flex items-center gap-1 flex-1">
        <input
          type="text"
          value={value}
          readOnly
          className="flex-1 px-2 py-1 text-xs rounded-md border-theme text-theme-primary"
          style={{ backgroundColor: 'var(--df-bg-input)', fontSize: '11px' }}
        />
        {suffix && (
          <span className="text-[10px] text-theme-muted shrink-0">{suffix}</span>
        )}
      </div>
    </div>
  );
}

export function PropertiesPanel() {
  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div
        className="flex items-center px-3 py-2.5 border-b border-theme shrink-0"
        style={{ backgroundColor: 'var(--df-bg-secondary)' }}
      >
        <span className="text-sm font-semibold text-theme-primary">Propriedades</span>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto custom-scrollbar">
        {/* Empty State */}
        <div className="flex flex-col items-center justify-center py-12 px-4">
          <div
            className="w-14 h-14 rounded-xl flex items-center justify-center mb-3"
            style={{ backgroundColor: 'var(--df-bg-hover)' }}
          >
            <Move size={24} className="text-theme-muted" />
          </div>
          <p className="text-xs text-theme-muted text-center leading-relaxed">
            Selecione um clipe na timeline para editar suas propriedades
          </p>
        </div>

        {/* Example Properties (disabled/readonly) */}
        <PropertySection title="Posição" icon={Move}>
          <div className="grid grid-cols-2 gap-2">
            <PropertyRow label="X" value="0" suffix="px" />
            <PropertyRow label="Y" value="0" suffix="px" />
          </div>
        </PropertySection>

        <PropertySection title="Escala" icon={Maximize}>
          <div className="grid grid-cols-2 gap-2">
            <PropertyRow label="W" value="1920" suffix="px" />
            <PropertyRow label="H" value="1080" suffix="px" />
          </div>
          <PropertyRow label="%" value="100" suffix="%" />
        </PropertySection>

        <PropertySection title="Opacidade" icon={Eye}>
          <div className="flex items-center gap-2">
            <div
              className="flex-1 h-1.5 rounded-full"
              style={{ backgroundColor: 'var(--df-border)' }}
            >
              <div className="h-full w-full rounded-full bg-primary" />
            </div>
            <span className="text-[11px] text-theme-muted w-8 text-right">100%</span>
          </div>
        </PropertySection>

        <PropertySection title="Cor" icon={Palette}>
          <div className="flex items-center gap-2">
            <div className="w-6 h-6 rounded-md border border-theme" style={{ backgroundColor: '#FFFFFF' }} />
            <span className="text-[11px] text-theme-muted">#FFFFFF</span>
          </div>
        </PropertySection>
      </div>
    </div>
  );
}
