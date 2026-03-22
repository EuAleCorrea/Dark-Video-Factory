import { Composition, registerRoot } from "remotion";
import { DarkVideo, DarkVideoProps, darkVideoSchema } from "./DarkVideo";

/**
 * Root.tsx — Entry point do Remotion
 * Define a composição DarkVideo e registra como root.
 */

const RemotionRoot: React.FC = () => {
  return (
    <Composition<DarkVideoProps>
      id="DarkVideo"
      component={DarkVideo}
      durationInFrames={300}
      fps={30}
      width={1080}
      height={1920}
      schema={darkVideoSchema}
      defaultProps={{
        scenes: [
          { imagePath: "images/placeholder.jpg", duration: 5 },
        ],
        audioSrc: "audio/narration.mp3",
        captions: [],
        format: "vertical",
        transitionDuration: 15,
        kenBurnsEnabled: true,
      }}
    />
  );
};

registerRoot(RemotionRoot);
