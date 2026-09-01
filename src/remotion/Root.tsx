import { Composition, Folder } from "remotion";
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
import { PriorityList, calculateMetadata as calculatePriorityListMetadata } from "./PriorityList/Main";
import { BlisterFormation, calculateMetadata as calculateBlisterFormationMetadata } from "./BlisterFormation/Main";
import { TheoryToPractice, calculateMetadata as calculateTheoryToPracticeMetadata } from "./TheoryToPractice/Main";
import { TableOfContents, calculateMetadata as calculateTableOfContentsMetadata } from "./TableOfContents/Main";
import { ShearCyclesReduction, calculateMetadata as calculateShearCyclesReductionMetadata } from "./ShearCyclesReduction/Main";
import { ShearMagnitudeReduction, calculateMetadata as calculateShearMagnitudeReductionMetadata } from "./ShearMagnitudeReduction/Main";
import { ShearResilienceIncrease, calculateMetadata as calculateShearResilienceIncreaseMetadata } from "./ShearResilienceIncrease/Main";
import React, { useEffect, useState } from "react";
import { SHORT_CREATOR_COMP_ID } from "../../types/constants";


type Segment = { start: number; end: number };
type Short = {
  id: string;
  title: string;
  segments: Segment[];
};
type Project = {
  id: string;
  name: string;
  shorts: Short[];
  renderCount: number;
};

// The Studio runs on a different origin to the Next app, so this has to be an
// absolute URL. On a server it is not localhost, hence the env var. Remotion
// inlines REMOTION_-prefixed vars into the bundle.
const APP_URL = process.env.REMOTION_APP_URL ?? "http://localhost:3000";

async function fetchProjects(): Promise<Project[]> {
  try {
    const response = await fetch(`${APP_URL}/api/findProjects`);
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
    <Folder name="Visuals">
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
      <Composition
        id="PriorityList"
        component={PriorityList}
        width={1920}
        height={1080}
        fps={30}
        durationInFrames={150}
        calculateMetadata={calculatePriorityListMetadata}
      />
      <Composition
        id="BlisterFormation"
        component={BlisterFormation}
        width={1920}
        height={1080}
        fps={30}
        durationInFrames={180}
        calculateMetadata={calculateBlisterFormationMetadata}
      />
      <Composition
        id="TheoryToPractice"
        component={TheoryToPractice}
        width={1920}
        height={1080}
        fps={30}
        durationInFrames={150}
        calculateMetadata={calculateTheoryToPracticeMetadata}
      />
      <Composition
        id="TableOfContents"
        component={TableOfContents}
        width={1920}
        height={1080}
        fps={30}
        durationInFrames={490}
        calculateMetadata={calculateTableOfContentsMetadata}
      />
      <Composition
        id="ShearCyclesReduction"
        component={ShearCyclesReduction}
        width={1920}
        height={1080}
        fps={30}
        durationInFrames={180}
        calculateMetadata={calculateShearCyclesReductionMetadata}
      />
      <Composition
        id="ShearMagnitudeReduction"
        component={ShearMagnitudeReduction}
        width={1920}
        height={1080}
        fps={30}
        durationInFrames={180}
        calculateMetadata={calculateShearMagnitudeReductionMetadata}
      />
      <Composition
        id="ShearResilienceIncrease"
        component={ShearResilienceIncrease}
        width={1920}
        height={1080}
        fps={30}
        durationInFrames={180}
        calculateMetadata={calculateShearResilienceIncreaseMetadata}
      />
      </Folder>
      {/*
        Headless render target. The per-short compositions below only exist once
        the Studio has fetched the project list over HTTP, which makes them
        unreachable from a server-side render. This one has a stable id and
        takes its segments from inputProps, so /api/render can drive it without
        the Studio running and without a network round-trip.
      */}
      <Composition
        id={SHORT_CREATOR_COMP_ID}
        component={ShortCreator}
        width={1080}
        height={1920}
        fps={30}
        durationInFrames={150}
        calculateMetadata={calculateMetadata}
        defaultProps={{ segments: [], project: "" }}
      />
      <Folder name="Shorts">
      {projects.flatMap((project) =>
        project.shorts.map((short) => ({
          project,
          short,
        })),
      ).map(({ project, short }, index) => (
        <Composition
          key={`${short.id}-${index}`}
          id={`ShortCreator-${short.id}-${index}`}
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
      </Folder>
    </>
  );
};





