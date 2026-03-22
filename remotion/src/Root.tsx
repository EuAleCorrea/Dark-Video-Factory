import { Composition, registerRoot } from "remotion";
import { DarkVideo, DarkVideoProps, darkVideoSchema } from "./DarkVideo";

/**
 * Root.tsx — Entry point do Remotion
 * Define a composição DarkVideo e registra como root.
 */

const RemotionRoot: React.FC = () => {
  return (
    <Composition
      id="DarkVideo"
      component={DarkVideo}
      durationInFrames={300}
      fps={30}
      width={1080}
      height={1920}
      schema={darkVideoSchema}
      defaultProps={{
        scenes: [
          { 
            imagePath: "images/placeholder.jpg",
            audioPath: "audio/placeholder.wav",
            text: "Exemplo de Legenda",
            duration: 5 
          },
        ],
        format: "vertical",
        transitionDuration: 15,
        kenBurnsEnabled: true,
      }}
    />
  );
};

registerRoot(RemotionRoot);
