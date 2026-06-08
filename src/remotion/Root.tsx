import { Composition } from "remotion";
import { ShortCreator, calculateMetadata } from "./shortCreator/Main";
import { PushUpTypes, calculateMetadata as calculatePushUpTypesMetadata } from "./PushUpTypes/Main";
import { ThreeBlocksReveal, calculateMetadata as calculateThreeBlocksRevealMetadata } from "./ThreeBlocksReveal/Main";
import { PushUpBlocksReveal, calculateMetadata as calculatePushUpBlocksRevealMetadata } from "./PushUpBlocksReveal/Main";
import { BlocksTimesThree, calculateMetadata as calculateBlocksTimesThreeMetadata } from "./BlocksTimesThree/Main";
import { GaugeSchema, Gauge, calculateGaugeMetadata  } from "./Gauge/Main";
import { TwoYearTimeline, calculateTwoYearTimelineMetadata } from "./TwoYearTimeline/Main";
import { FallingQuestionMarks, calculateMetadata as calculateFallingQuestionMarksMetadata } from "./FallingQuestionMarks/Main";
import { MaxThreshold80, calculateMetadata as calculateMaxThreshold80Metadata } from "./MaxThreshold80/Main";
import { PushUp100BlocksBuild, calculateMetadata as calculatePushUp100BlocksBuildMetadata } from "./PushUp100BlocksBuild/Main";
import React, { useEffect, useState } from "react";


type Segment = { start: number; end: number };
type Short = {
  id: string;
  segments: Segment[];
};
type Project = {
  id: string;
  name: string;
  shorts: Short[];
  renderCount: number;
};

async function fetchProjects(): Promise<Project[]> {
  try {
    const response = await fetch("http://localhost:3000/api/findProjects");
    if (!response.ok) {
      throw new Error(`Failed to fetch projects: ${response.statusText}`);
    }
    const data = await response.json();
    return data as Project[];
  } catch (error) {
    console.error("Error fetching projects:", error);
    return [];
}
}

export const RemotionRoot: React.FC = () => {
  const [projects, setProjects] = useState<Project[]>([]);

  useEffect(() => {
    void fetchProjects().then(setProjects);
    console.log("Fetched projects:", projects);
  }, []);

  return (
    <>
      <Composition
        id="BlocksTimesThree"
        component={BlocksTimesThree}
        width={1920}
        height={1080}
        fps={30}
        durationInFrames={150}
        calculateMetadata={calculateBlocksTimesThreeMetadata}
      />
      <Composition
        id="PushUpBlocksReveal"
        component={PushUpBlocksReveal}
        width={1920}
        height={1080}
        fps={30}
        durationInFrames={150}
        calculateMetadata={calculatePushUpBlocksRevealMetadata}
      />
      <Composition
        id="ThreeBlocksReveal"
        component={ThreeBlocksReveal}
        width={1920}
        height={1080}
        fps={30}
        durationInFrames={150}
        calculateMetadata={calculateThreeBlocksRevealMetadata}
      />
      <Composition
        id="PushUpTypes"
        component={PushUpTypes}
        width={1920}
        height={1080}
        fps={30}
        durationInFrames={150}
        calculateMetadata={calculatePushUpTypesMetadata}
      />
      <Composition
        id="TwoYearTimeline"
        component={TwoYearTimeline}
        width={1920}
        height={1080}
        fps={30}
        durationInFrames={150}
        calculateMetadata={calculateTwoYearTimelineMetadata}
      />
      <Composition
        id="Gauge"
        component={Gauge}
        width={1080}
        height={1080}
        fps={30}
        durationInFrames={150}
        schema={GaugeSchema}
        calculateMetadata={calculateGaugeMetadata}
        defaultProps={{
          count: 500,
          topLabel: "PUSH UPS",
          bottomLabel: "IN A SESSION",
        }}
      />
      <Composition
        id="FallingQuestionMarks"
        component={FallingQuestionMarks}
        width={1920}
        height={1080}
        fps={30}
        durationInFrames={150}
        calculateMetadata={calculateFallingQuestionMarksMetadata}
      />
      <Composition
        id="MaxThreshold"
        component={MaxThreshold80}
        width={1920}
        height={1080}
        fps={30}
        durationInFrames={150}
        calculateMetadata={calculateMaxThreshold80Metadata}
      />
      <Composition
        id="PushUp100BlocksBuild"
        component={PushUp100BlocksBuild}
        width={1920}
        height={1080}
        fps={30}
        durationInFrames={300}
        calculateMetadata={calculatePushUp100BlocksBuildMetadata}
      />
      {projects.flatMap((project) =>
        project.shorts.map((short) => ({
          project,
          short,
        })),
      ).map(({ project, short }, index) => (
        <Composition
          key={`${project.id}-${short.id ?? index}`}
          id={`ShortCreator-${project.id}-${short.id ?? index}`}
          component={ShortCreator}
          width={1080}
          height={1920}
          calculateMetadata={calculateMetadata}
          defaultProps={{
            segments: short.segments,
            project: project.id,
          }}
        />
      ))}
    </>
  );
};





