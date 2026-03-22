import React from "react";
import {
  AbsoluteFill,
  Img,
  staticFile,
  useCurrentFrame,
  useVideoConfig,
  interpolate,
} from "remotion";
import { Audio } from "@remotion/media";
import { TransitionSeries, linearTiming } from "@remotion/transitions";
import { fade } from "@remotion/transitions/fade";
import { z } from "zod";

// ─── Schema (para validação via CLI e ExportStep) ────────────

export const darkVideoSchema = z.object({
  scenes: z.array(
    z.object({
      id: z.number().optional(),
      imagePath: z.string(),
      audioPath: z.string(),
      text: z.string(),
      duration: z.number(),
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

// ─── Setup Caption Component for Individual Scene ─────────────

const SceneCaption: React.FC<{ text: string }> = ({ text }) => {
  if (!text || text.trim() === "") return null;

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
          {text}
        </span>
      </div>
    </AbsoluteFill>
  );
};

// ─── Main Composition ───────────────────────────────────────

export const DarkVideo: React.FC<DarkVideoProps> = ({
  scenes,
  transitionDuration = 15,
  kenBurnsEnabled = true,
}) => {
  const { fps } = useVideoConfig();

  return (
    <AbsoluteFill style={{ backgroundColor: "#000" }}>
      <TransitionSeries>
        {scenes.map((scene, index) => {
          const durationInFrames = Math.max(
            Math.round(scene.duration * fps),
            1 // prevent 0 frames sequence
          );

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
              <SceneCaption text={scene.text} />
              <Audio src={staticFile(scene.audioPath)} />
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
    </AbsoluteFill>
  );
};
