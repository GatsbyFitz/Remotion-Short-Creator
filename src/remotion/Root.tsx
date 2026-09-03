import { Composition, Folder, continueRender, delayRender } from "remotion";
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

// Overridable so renders that don't run alongside the Next dev server (CLI, CI,
// Vercel sandbox) can point at a reachable host. Remotion only exposes env vars
// prefixed with `REMOTION_` to the bundle.
const FIND_PROJECTS_URL =
  process.env.REMOTION_FIND_PROJECTS_URL ?? "http://localhost:3000/api/findProjects";

async function fetchProjects(): Promise<Project[]> {
  const response = await fetch(FIND_PROJECTS_URL);
  if (!response.ok) {
    throw new Error(
      `Failed to fetch projects from ${FIND_PROJECTS_URL}: ${response.status} ${response.statusText}`,
    );
  }
  return (await response.json()) as Project[];
}

export const RemotionRoot: React.FC = () => {
  const [projects, setProjects] = useState<Project[]>([]);
  // Block composition enumeration until the project list has loaded. Without this,
  // `remotion render` / Studio's render entry read the composition list before the
  // fetch resolves and the `ShortCreator-*` entries simply don't exist yet, failing
  // with "Could not find composition with ID ShortCreator-...".
  const [handle] = useState(() =>
    delayRender("Fetching projects for <ShortCreator> compositions"),
  );

  useEffect(() => {
    fetchProjects()
      .then((data) => {
        setProjects(data);
        continueRender(handle);
      })
      .catch((error: unknown) => {
        // Don't hang the render; proceed with no Shorts compositions and surface why.
        console.error("Error fetching projects for Remotion Root:", error);
        continueRender(handle);
      });
  }, [handle]);

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
            title: short.title,
          }}
        />
      ))}
      </Folder>
    </>
  );
};





