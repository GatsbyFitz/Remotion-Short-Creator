import { RunningChannel } from "./RunningChannel/Main";
import { EndScene } from "./EndScene/Main";
import { CutHalf } from "./testing/Main";
import { Composition, staticFile } from "remotion";
import { ShortCreator, calculateMetadata } from "./shortCreator/Main";

export const RemotionRoot: React.FC = () => {

  const segments = [{ start: 0, end: 5 }, { start: 6, end: 8 }]; // example

  return (
    <>
      <Composition
        id="RunningChannel"
        component={RunningChannel}
        durationInFrames={150}
        fps={30}
        width={1920}
        height={1080}
        defaultProps={{
          channelName: "Gatsby Fitzgerald",
          subtitle: "Running Motivation",
        }}
      />
      <Composition
        id="EndScene"
        component={EndScene}
        durationInFrames={150}
        fps={30}
        width={1920}
        height={1080}
      />
      <Composition
        id="CutVideoHalf"
        component={CutHalf}
        width={1920}
        height={1080}
        fps={30}
        durationInFrames={Math.round((10 / 2) * 30)}
        defaultProps={{
          src: staticFile("/video.mp4"),
          half: "first",
          durationInSeconds: 10,
        }}
      />
      <Composition
        id="ShortCreator"
        component={ShortCreator}
        width={1920}
        height={1080}
        defaultProps={{ segments }}
        calculateMetadata={calculateMetadata}
      />
      </>
  );
};
