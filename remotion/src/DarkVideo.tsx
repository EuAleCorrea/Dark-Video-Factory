import React from "react";
import {
  AbsoluteFill,
  Img,
  Sequence,
  staticFile,
  useCurrentFrame,
  useVideoConfig,
  interpolate,
} from "remotion";
import { Audio } from "@remotion/media";
import { TransitionSeries, linearTiming } from "@remotion/transitions";
import { fade } from "@remotion/transitions/fade";
import { z } from "zod";

// ─── Schema (para validação via CLI) ────────────────────────

export const darkVideoSchema = z.object({
  scenes: z.array(
    z.object({
      imagePath: z.string(),
      duration: z.number(),
    })
  ),
  audioSrc: z.string(),
  captions: z.array(
    z.object({
      text: z.string(),
      startMs: z.number(),
      endMs: z.number(),
    })
  ),
  format: z.enum(["vertical", "horizontal"]),
  transitionDuration: z.number().default(15),
  kenBurnsEnabled: z.boolean().default(true),
});

export type DarkVideoProps = z.infer<typeof darkVideoSchema>;

// ─── Ken Burns Image Component ──────────────────────────────

const KenBurnsImage: React.FC<{
  src: string;
  durationInFrames: number;
  enabled: boolean;
}> = ({ src, durationInFrames, enabled }) => {
  const frame = useCurrentFrame();

  const scale = enabled
    ? interpolate(frame, [0, durationInFrames], [1.0, 1.15], {
        extrapolateRight: "clamp",
      })
    : 1;

  return (
    <AbsoluteFill
      style={{
        justifyContent: "center",
        alignItems: "center",
        overflow: "hidden",
        backgroundColor: "#000",
      }}
    >
      <Img
        src={staticFile(src)}
        style={{
          width: "100%",
          height: "100%",
          objectFit: "cover",
          transform: `scale(${scale})`,
        }}
      />
    </AbsoluteFill>
  );
};

// ─── Caption Overlay Component ──────────────────────────────

const CaptionOverlay: React.FC<{
  captions: DarkVideoProps["captions"];
}> = ({ captions }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const currentMs = (frame / fps) * 1000;

  const activeCaption = captions.find(
    (c) => currentMs >= c.startMs && currentMs <= c.endMs
  );

  if (!activeCaption) return null;

  // Fade in/out
  const fadeInEnd = activeCaption.startMs + 200;
  const fadeOutStart = activeCaption.endMs - 200;

  const opacity = interpolate(
    currentMs,
    [activeCaption.startMs, fadeInEnd, fadeOutStart, activeCaption.endMs],
    [0, 1, 1, 0],
    { extrapolateLeft: "clamp", extrapolateRight: "clamp" }
  );

  return (
    <AbsoluteFill
      style={{
        justifyContent: "flex-end",
        alignItems: "center",
        paddingBottom: "12%",
      }}
    >
      <div
        style={{
          backgroundColor: "rgba(0, 0, 0, 0.7)",
          borderRadius: 12,
          padding: "12px 24px",
          maxWidth: "85%",
          opacity,
        }}
      >
        <span
          style={{
            color: "#FFFFFF",
            fontSize: 32,
            fontWeight: 700,
            textAlign: "center",
            lineHeight: 1.4,
            display: "block",
            textShadow: "0 2px 8px rgba(0,0,0,0.5)",
          }}
        >
          {activeCaption.text}
        </span>
      </div>
    </AbsoluteFill>
  );
};

// ─── Main Composition ───────────────────────────────────────

export const DarkVideo: React.FC<DarkVideoProps> = ({
  scenes,
  audioSrc,
  captions,
  transitionDuration = 15,
  kenBurnsEnabled = true,
}) => {
  const { fps } = useVideoConfig();

  return (
    <AbsoluteFill style={{ backgroundColor: "#000" }}>
      {/* Imagens com transições */}
      <TransitionSeries>
        {scenes.map((scene, index) => {
          const durationInFrames = Math.round(scene.duration * fps);
          const elements: React.ReactNode[] = [];

          elements.push(
            <TransitionSeries.Sequence
              key={`scene-${index}`}
              durationInFrames={durationInFrames}
            >
              <KenBurnsImage
                src={scene.imagePath}
                durationInFrames={durationInFrames}
                enabled={kenBurnsEnabled}
              />
            </TransitionSeries.Sequence>
          );

          // Adiciona transição entre cenas (exceto após a última)
          if (index < scenes.length - 1) {
            elements.push(
              <TransitionSeries.Transition
                key={`transition-${index}`}
                presentation={fade()}
                timing={linearTiming({ durationInFrames: transitionDuration })}
              />
            );
          }

          return elements;
        })}
      </TransitionSeries>

      {/* Áudio narração */}
      <Audio src={staticFile(audioSrc)} />

      {/* Legendas sobrepostas */}
      {captions.length > 0 && <CaptionOverlay captions={captions} />}
    </AbsoluteFill>
  );
};
