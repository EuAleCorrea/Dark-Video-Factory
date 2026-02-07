import { ChannelProfile, StoryboardSegment, VideoFormat } from "./types";

/**
 * Generates Advanced Substation Alpha (.ass) subtitle content.
 * Now respects the styling defined in the ChannelProfile.
 */
export const generateAssContent = (segments: StoryboardSegment[], profile: ChannelProfile): string => {
  const isShorts = profile.format === VideoFormat.SHORTS;
  const style = profile.subtitleStyle;

  // Default values if style is missing (backwards compatibility)
  const fontName = style?.fontName || "Montserrat ExtraBold";
  // ASS font size isn't pixels, but relative height. We scale based on format.
  const baseFontSize = isShorts ? 80 : 48;
  const userFontSizeScale = (style?.fontSize || 100) / 100; // e.g. 1.2 for 120%
  const finalFontSize = Math.floor(baseFontSize * userFontSizeScale);

  const primaryColor = convertHexToAss(style?.primaryColor || "#FFFFFF");
  const outlineColor = convertHexToAss(style?.outlineColor || "#000000");

  // Alignment: 1=Left, 2=Center, 3=Right, 5=Top, 6=TopCenter...
  // Simple mapping: Bottom=2, Center=5, Top=8
  let alignment = 2; // Default Bottom
  if (style?.alignment === 'CENTER') alignment = 5;
  if (style?.alignment === 'TOP') alignment = 8;

  const marginV = isShorts ? 500 : 80;

  const header = `[Script Info]
ScriptType: v4.00+
PlayResX: ${isShorts ? 1080 : 1920}
PlayResY: ${isShorts ? 1920 : 1080}
WrapStyle: 0
ScaledBorderAndShadow: yes

[V4+ Styles]
Format: Name, Fontname, Fontsize, PrimaryColour, SecondaryColour, OutlineColour, BackColour, Bold, Italic, Underline, StrikeOut, ScaleX, ScaleY, Spacing, Angle, BorderStyle, Outline, Shadow, Alignment, MarginL, MarginR, MarginV, Encoding
Style: Default,${fontName},${finalFontSize},${primaryColor},&H000000FF,${outlineColor},&H80000000,-1,0,0,0,100,100,0,0,1,4,0,${alignment},20,20,${marginV},1

[Events]
Format: Layer, Start, End, Style, Name, MarginL, MarginR, MarginV, Effect, Text
`;

  let currentTime = 0;

  const events = segments.map(seg => {
    const start = formatTimestamp(currentTime);
    const end = formatTimestamp(currentTime + seg.duration);
    currentTime += seg.duration;

    // Sanitize text for .ass
    const text = seg.scriptText.replace(/\n/g, ' ').replace(/{/g, '(').replace(/}/g, ')');

    // We add a simple karaoke-like fade or pop if desired in future, for now just static text
    return `Dialogue: 0,${start},${end},Default,,0,0,0,,${text}`;
  }).join('\n');

  return header + events;
};

/**
 * Converts Hex (#RRGGBB) to ASS color format (&HBBGGRR)
 * ASS uses BGR order.
 */
const convertHexToAss = (hex: string): string => {
  if (!hex || !hex.startsWith('#')) return '&H00FFFFFF';
  const r = hex.substring(1, 3);
  const g = hex.substring(3, 5);
  const b = hex.substring(5, 7);
  return `&H00${b}${g}${r}`;
};

const formatTimestamp = (seconds: number): string => {
  const hrs = Math.floor(seconds / 3600);
  const mins = Math.floor((seconds % 3600) / 60);
  const secs = Math.floor(seconds % 60);
  const centis = Math.floor((seconds % 1) * 100);

  return `${hrs}:${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}.${centis.toString().padStart(2, '0')}`;
};