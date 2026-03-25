import React from "react";
import {
  AbsoluteFill,
  useCurrentFrame,
  useVideoConfig,
  interpolate,
  spring,
} from "remotion";

export interface SubtitleSegment {
  id: number;
  scriptText: string;
  startTime: number; // em segundos
  endTime: number;   // em segundos
}

export interface SubtitleConfig {
  styleId?: string;
  fontName: string;
  fontSize: number;
  primaryColor: string;
  outlineColor: string;
  backgroundColor: string;
  alignment: 'BOTTOM' | 'CENTER' | 'TOP';
  animationType?: 'fade' | 'pop' | 'highlight' | 'bounce';
  activeColor?: string;
}

interface CaptionsRendererProps {
  segments: SubtitleSegment[];
  config: SubtitleConfig;
}

export const CaptionsRenderer: React.FC<CaptionsRendererProps> = ({
  segments,
  config,
}) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  // Encontra o segmento atual com base no frame
  const currentTime = frame / fps;
  const activeSegment = segments.find(
    (s) => currentTime >= s.startTime && currentTime <= s.endTime
  );

  if (!activeSegment) return null;

  // --- Animações ---
  const segmentFrame = frame - Math.round(activeSegment.startTime * fps);
  
  // 1. Pop (Escala)
  const popScale = spring({
    frame: segmentFrame,
    fps,
    config: { damping: 10, stiffness: 100 },
    durationInFrames: 10,
  });

  // 2. Fade (Opacidade)
  const opacity = interpolate(segmentFrame, [0, 5], [0, 1], {
    extrapolateRight: "clamp",
  });

  // 3. Bounce (Y Offset)
  const translateY = spring({
    frame: segmentFrame,
    fps,
    config: { damping: 12, stiffness: 200 },
  });
  const bounceY = interpolate(translateY, [0, 1], [20, 0]);

  // --- Estilos Base ---
  const containerStyle: React.CSSProperties = {
    justifyContent: config.alignment === 'BOTTOM' ? "flex-end" : config.alignment === 'TOP' ? "flex-start" : "center",
    alignItems: "center",
    paddingBottom: config.alignment === 'BOTTOM' ? "12%" : "5%",
    paddingTop: config.alignment === 'TOP' ? "12%" : "5%",
    paddingLeft: "10%",
    paddingRight: "10%",
  };

  const textStyle: React.CSSProperties = {
    fontFamily: config.fontName || "Montserrat ExtraBold",
    fontSize: config.fontSize || 80,
    color: config.primaryColor || "#FFFFFF",
    textAlign: "center",
    fontWeight: 900,
    textTransform: "uppercase",
    lineHeight: 1.1,
    // Outline robusto
    textShadow: `
      3px 3px 0 ${config.outlineColor},
      -3px -3px 0 ${config.outlineColor},
      3px -3px 0 ${config.outlineColor},
      -3px 3px 0 ${config.outlineColor},
      4px 4px 15px rgba(0,0,0,0.5)
    `,
    backgroundColor: config.backgroundColor !== 'transparent' ? config.backgroundColor : undefined,
    padding: config.backgroundColor !== 'transparent' ? "10px 20px" : undefined,
    borderRadius: config.backgroundColor !== 'transparent' ? "15px" : undefined,
    
    // Aplicar transformações de animação
    transform: config.animationType === 'pop' 
      ? `scale(${popScale})` 
      : config.animationType === 'bounce' 
        ? `translateY(${bounceY}px)` 
        : undefined,
    opacity: config.animationType === 'fade' ? opacity : 1,
  };

  // Estilo específico para presets conhecidos (ex: Neon)
  if (config.styleId === 'neon-blue') {
    textStyle.textShadow = `
      0 0 10px ${config.primaryColor},
      0 0 20px ${config.primaryColor},
      0 0 40px ${config.outlineColor}
    `;
  }

  return (
    <AbsoluteFill style={containerStyle}>
      <div style={textStyle}>
        {activeSegment.scriptText}
      </div>
    </AbsoluteFill>
  );
};
