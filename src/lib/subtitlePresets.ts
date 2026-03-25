import { SubtitleConfig } from '../types';

export interface SubtitlePreset extends SubtitleConfig {
  id: string;
  name: string;
  description: string;
}

export const SUBTITLE_PRESETS: SubtitlePreset[] = [
  {
    id: 'classic-dark',
    name: 'Classic Dark',
    description: 'Texto branco com contorno preto clássico.',
    fontName: 'Montserrat ExtraBold',
    fontSize: 100,
    primaryColor: '#FFFFFF',
    outlineColor: '#000000',
    backgroundColor: 'rgba(0,0,0,0.5)',
    alignment: 'BOTTOM',
    animationType: 'fade'
  },
  {
    id: 'neon-blue',
    name: 'Neon Blue',
    description: 'Brilho ciano intenso para vídeos modernos.',
    fontName: 'Inter',
    fontSize: 110,
    primaryColor: '#00FFFF',
    outlineColor: '#005555',
    backgroundColor: 'transparent',
    alignment: 'BOTTOM',
    animationType: 'pop',
    activeColor: '#FFFFFF'
  },
  {
    id: 'comic-pop',
    name: 'Comic Pop',
    description: 'Amarelo vibrante com bordas grossas estilo quadrinhos.',
    fontName: 'Bebas Neue',
    fontSize: 130,
    primaryColor: '#FFD700',
    outlineColor: '#000000',
    backgroundColor: 'transparent',
    alignment: 'CENTER',
    animationType: 'bounce',
    activeColor: '#FF4500'
  },
  {
    id: 'highlight-active',
    name: 'Highlight Active',
    description: 'Foco na palavra falada com mudança de cor.',
    fontName: 'Montserrat ExtraBold',
    fontSize: 100,
    primaryColor: '#FFFFFF',
    outlineColor: '#000000',
    backgroundColor: 'transparent',
    alignment: 'BOTTOM',
    animationType: 'highlight',
    activeColor: '#FFFF00'
  },
  {
    id: 'tiktok-viral',
    name: 'TikTok Viral',
    description: 'Texto grande amarelo com sombra, estilo vídeos curtos.',
    fontName: 'Inter Black',
    fontSize: 140,
    primaryColor: '#FFFF00',
    outlineColor: '#000000',
    backgroundColor: 'transparent',
    alignment: 'CENTER',
    animationType: 'pop',
    activeColor: '#FFFFFF'
  },
  {
    id: 'netflix-clean',
    name: 'Netflix Clean',
    description: 'Minimalista com fundo escuro, leitura clara.',
    fontName: 'Helvetica',
    fontSize: 80,
    primaryColor: '#FFFFFF',
    outlineColor: 'transparent',
    backgroundColor: 'rgba(0,0,0,0.7)',
    alignment: 'BOTTOM',
    animationType: 'fade'
  },
  {
    id: 'glow-pink',
    name: 'Neon Pink',
    description: 'Brilho rosa intenso para vlogs e moda.',
    fontName: 'Montserrat Bold',
    fontSize: 110,
    primaryColor: '#FF00FF',
    outlineColor: '#550055',
    backgroundColor: 'transparent',
    alignment: 'BOTTOM',
    animationType: 'pop',
    activeColor: '#FFFFFF'
  },
  {
    id: 'retro-game',
    name: 'Retro Game',
    description: 'Estilo 8-bit com cores vibrantes.',
    fontName: 'Bebas Neue',
    fontSize: 120,
    primaryColor: '#00FF00',
    outlineColor: '#003300',
    backgroundColor: 'rgba(0,0,0,0.8)',
    alignment: 'BOTTOM',
    animationType: 'bounce',
    activeColor: '#FFFF00'
  },
  {
    id: 'breaking-news',
    name: 'Breaking News',
    description: 'Fundo vermelho impacto, estilo jornalismo.',
    fontName: 'Roboto Black',
    fontSize: 90,
    primaryColor: '#FFFFFF',
    outlineColor: 'transparent',
    backgroundColor: '#FF0000',
    alignment: 'BOTTOM',
    animationType: 'pop'
  },
  {
    id: 'luxury-gold',
    name: 'Luxury Gold',
    description: 'Dourado elegante com animação suave.',
    fontName: 'Playfair Display',
    fontSize: 100,
    primaryColor: '#D4AF37',
    outlineColor: '#432d05',
    backgroundColor: 'transparent',
    alignment: 'BOTTOM',
    animationType: 'fade',
    activeColor: '#FFFFFF'
  },
  {
    id: 'minimal-pill',
    name: 'Minimal Pill',
    description: 'Texto dentro de um badge arredondado.',
    fontName: 'Inter Medium',
    fontSize: 75,
    primaryColor: '#333333',
    outlineColor: 'transparent',
    backgroundColor: '#F3F4F6',
    alignment: 'BOTTOM',
    animationType: 'pop'
  },
  {
    id: 'futuristic-cyber',
    name: 'Cyberpunk',
    description: 'Visual tecnológico com cores eletrizantes.',
    fontName: 'Orbitron',
    fontSize: 110,
    primaryColor: '#00FF00',
    outlineColor: '#005500',
    backgroundColor: 'transparent',
    alignment: 'BOTTOM',
    animationType: 'pop',
    activeColor: '#00FFFF'
  }
];
