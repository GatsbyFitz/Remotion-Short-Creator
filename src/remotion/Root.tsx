import { Composition } from "remotion";
import { RunningChannel } from "./RunningChannel/Main";
import { EndScene } from "./EndScene/Main";

export const RemotionRoot: React.FC = () => {
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
    </>
  );
};
