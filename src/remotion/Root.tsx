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
import { PrisonBars, calculateMetadata as calculatePrisonBarsMetadata } from "./PrisonBars/Main";
import { CrumblingWall, calculateMetadata as calculateCrumblingWallMetadata } from "./CrumblingWall/Main";
import { PassionIdentityCage, calculateMetadata as calculatePassionIdentityCageMetadata } from "./PassionIdentityCage/Main";
import { RacingInjuryCycle, calculateMetadata as calculateRacingInjuryCycleMetadata } from "./RacingInjuryCycle/Main";
import { MomentumMeaning, calculateMetadata as calculateMomentumMeaningMetadata } from "./MomentumMeaning/Main";
import { LoadBearingBody, calculateMetadata as calculateLoadBearingBodyMetadata } from "./LoadBearingBody/Main";
import { HolisticWheel, calculateMetadata as calculateHolisticWheelMetadata } from "./HolisticWheel/Main";
import { ListenToYourBody, calculateMetadata as calculateListenToYourBodyMetadata } from "./ListenToYourBody/Main";
import { UnravellingBody, calculateMetadata as calculateUnravellingBodyMetadata } from "./UnravellingBody/Main";
import { IdentitySilo, calculateMetadata as calculateIdentitySiloMetadata } from "./IdentitySilo/Main";
import { UnattachedGate, calculateMetadata as calculateUnattachedGateMetadata } from "./UnattachedGate/Main";
import { CrossBracedBody, calculateMetadata as calculateCrossBracedBodyMetadata } from "./CrossBracedBody/Main";
import { ListenAndVary, calculateMetadata as calculateListenAndVaryMetadata } from "./ListenAndVary/Main";
import { FinishLine, calculateMetadata as calculateFinishLineMetadata } from "./FinishLine/Main";
import { InvitationToSlow, calculateMetadata as calculateInvitationToSlowMetadata } from "./InvitationToSlow/Main";
import { RoomToHeal, calculateMetadata as calculateRoomToHealMetadata } from "./RoomToHeal/Main";
import { RootsInWinter, calculateMetadata as calculateRootsInWinterMetadata } from "./RootsInWinter/Main";
import { IdentityShell, calculateMetadata as calculateIdentityShellMetadata } from "./IdentityShell/Main";
import { GraduationLesson, calculateMetadata as calculateGraduationLessonMetadata } from "./GraduationLesson/Main";
import { ExpectedVsReality, calculateMetadata as calculateExpectedVsRealityMetadata } from "./ExpectedVsReality/Main";
import { ThroughTheTrees, calculateMetadata as calculateThroughTheTreesMetadata } from "./ThroughTheTrees/Main";
import { TheoryToPractice, calculateMetadata as calculateTheoryToPracticeMetadata } from "./TheoryToPractice/Main";
import { TableOfContents, calculateMetadata as calculateTableOfContentsMetadata } from "./TableOfContents/Main";
import { ShearCyclesReduction, calculateMetadata as calculateShearCyclesReductionMetadata } from "./ShearCyclesReduction/Main";
import { ShearMagnitudeReduction, calculateMetadata as calculateShearMagnitudeReductionMetadata } from "./ShearMagnitudeReduction/Main";
import { ShearResilienceIncrease, calculateMetadata as calculateShearResilienceIncreaseMetadata } from "./ShearResilienceIncrease/Main";
import { SocialClip, calculateMetadata as calculateSocialClipMetadata } from "./SocialClip/Main";
import { Reel, calculateMetadata as calculateReelMetadata } from "./Reel/Main";
import type { ReelShot } from "./Reel/Shot";
import React, { useEffect, useState } from "react";


type Segment = { start: number; end: number; focusX?: number; scale?: number };
type Short = {
  id: string;
  title: string;
  segments: Segment[];
};
type Clip = { id: string; start: number; end: number };
type Project = {
  id: string;
  name: string;
  shorts: Short[];
  clips?: Clip[];
  renderCount: number;
  sourceAspectRatio?: number | null;
};
type ReelProject = {
  id: string;
  reels: Array<{ id: string; bpm: number; shots: ReelShot[] }>;
};

// Overridable so renders that don't run alongside the Next dev server (CLI, CI,
// Vercel sandbox) can point at a reachable host. Remotion only exposes env vars
// prefixed with `REMOTION_` to the bundle.
const FIND_PROJECTS_URL =
  process.env.REMOTION_FIND_PROJECTS_URL ?? "http://localhost:3000/api/findProjects";
const FIND_REELS_URL = process.env.REMOTION_FIND_REELS_URL ?? "http://localhost:3000/api/findReels";

// If the Next server is down or still compiling, this fetch hangs rather than
// failing — neither .then nor .catch runs, the delayRender below is never
// cleared, and every render dies at Remotion's 28s timeout. So it gets a hard
// deadline of its own.
const FIND_PROJECTS_TIMEOUT_MS = 8000;

async function fetchJson<T>(url: string, signal: AbortSignal): Promise<T> {
  const response = await fetch(url, { signal });
  if (!response.ok) {
    throw new Error(`Failed to fetch ${url}: ${response.status} ${response.statusText}`);
  }
  return (await response.json()) as T;
}

export const RemotionRoot: React.FC = () => {
  const [projects, setProjects] = useState<Project[]>([]);
  const [reelProjects, setReelProjects] = useState<ReelProject[]>([]);
  // Block composition enumeration until the project list has loaded. Without this,
  // `remotion render` / Studio's render entry read the composition list before the
  // fetch resolves and the `ShortCreator-*` entries simply don't exist yet, failing
  // with "Could not find composition with ID ShortCreator-...".
  const [handle] = useState(() =>
    delayRender("Fetching projects for <ShortCreator> compositions"),
  );

  useEffect(() => {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), FIND_PROJECTS_TIMEOUT_MS);

    // Settled independently, so one endpoint failing still registers the
    // other's compositions.
    Promise.allSettled([
      fetchJson<Project[]>(FIND_PROJECTS_URL, controller.signal),
      fetchJson<ReelProject[]>(FIND_REELS_URL, controller.signal),
    ])
      .then(([projectsResult, reelsResult]) => {
        // Proceed without whichever compositions failed rather than blocking, and say why.
        if (projectsResult.status === "fulfilled") {
          setProjects(projectsResult.value);
        } else {
          console.error("Error fetching projects for Remotion Root:", projectsResult.reason);
        }
        if (reelsResult.status === "fulfilled") {
          setReelProjects(reelsResult.value);
        } else {
          console.error("Error fetching reels for Remotion Root:", reelsResult.reason);
        }
      })
      .finally(() => {
        // Resolved, rejected or aborted — the render always continues.
        clearTimeout(timeout);
        continueRender(handle);
      });

    return () => {
      clearTimeout(timeout);
      controller.abort();
    };
  }, [handle]);

  return (
    <>
    <Folder name="TYUniverse">
      <Composition
        id="ThroughTheTrees"
        component={ThroughTheTrees}
        width={1920}
        height={1080}
        fps={30}
        durationInFrames={300}
        defaultProps={{ growIn: true }}
        calculateMetadata={calculateThroughTheTreesMetadata}
      />
      {/* Already grown. Place after ThroughTheTrees, and repeat, for longer shots. */}
      <Composition
        id="ThroughTheTreesLoop"
        component={ThroughTheTrees}
        width={1920}
        height={1080}
        fps={30}
        durationInFrames={300}
        defaultProps={{ growIn: false }}
        calculateMetadata={calculateThroughTheTreesMetadata}
      />
      <Composition
        id="ExpectedVsReality"
        component={ExpectedVsReality}
        width={1920}
        height={1080}
        fps={30}
        durationInFrames={230}
        calculateMetadata={calculateExpectedVsRealityMetadata}
      />
      <Composition
        id="GraduationLesson"
        component={GraduationLesson}
        width={1920}
        height={1080}
        fps={30}
        durationInFrames={180}
        calculateMetadata={calculateGraduationLessonMetadata}
      />
      <Composition
        id="IdentityShell"
        component={IdentityShell}
        width={1920}
        height={1080}
        fps={30}
        durationInFrames={182}
        calculateMetadata={calculateIdentityShellMetadata}
      />
      <Composition
        id="RootsInWinter"
        component={RootsInWinter}
        width={1920}
        height={1080}
        fps={30}
        durationInFrames={240}
        calculateMetadata={calculateRootsInWinterMetadata}
      />
      <Composition
        id="RoomToHeal"
        component={RoomToHeal}
        width={1920}
        height={1080}
        fps={30}
        durationInFrames={226}
        calculateMetadata={calculateRoomToHealMetadata}
      />
      <Composition
        id="InvitationToSlow"
        component={InvitationToSlow}
        width={1920}
        height={1080}
        fps={30}
        durationInFrames={232}
        calculateMetadata={calculateInvitationToSlowMetadata}
      />
      <Composition
        id="ListenAndVary"
        component={ListenAndVary}
        width={1920}
        height={1080}
        fps={30}
        durationInFrames={230}
        calculateMetadata={calculateListenAndVaryMetadata}
      />
      <Composition
        id="CrossBracedBody"
        component={CrossBracedBody}
        width={1920}
        height={1080}
        fps={30}
        durationInFrames={248}
        calculateMetadata={calculateCrossBracedBodyMetadata}
      />
      <Composition
        id="UnattachedGate"
        component={UnattachedGate}
        width={1920}
        height={1080}
        fps={30}
        durationInFrames={228}
        calculateMetadata={calculateUnattachedGateMetadata}
      />
      <Composition
        id="IdentitySilo"
        component={IdentitySilo}
        width={1920}
        height={1080}
        fps={30}
        durationInFrames={260}
        calculateMetadata={calculateIdentitySiloMetadata}
      />
      <Composition
        id="CrumblingWall"
        component={CrumblingWall}
        width={1920}
        height={1080}
        fps={30}
        durationInFrames={120}
        calculateMetadata={calculateCrumblingWallMetadata}
      />
      <Composition
        id="LoadBearingBody"
        component={LoadBearingBody}
        width={1920}
        height={1080}
        fps={30}
        durationInFrames={205}
        calculateMetadata={calculateLoadBearingBodyMetadata}
      />
      <Composition
        id="MomentumMeaning"
        component={MomentumMeaning}
        width={1920}
        height={1080}
        fps={30}
        durationInFrames={150}
        calculateMetadata={calculateMomentumMeaningMetadata}
      />
      <Composition
        id="PassionIdentityCage"
        component={PassionIdentityCage}
        width={1920}
        height={1080}
        fps={30}
        durationInFrames={150}
        calculateMetadata={calculatePassionIdentityCageMetadata}
      />
      <Composition
        id="PrisonBars"
        component={PrisonBars}
        width={1920}
        height={1080}
        fps={30}
        durationInFrames={150}
        calculateMetadata={calculatePrisonBarsMetadata}
      />
      <Composition
        id="RacingInjuryCycle"
        component={RacingInjuryCycle}
        width={1920}
        height={1080}
        fps={30}
        durationInFrames={170}
        calculateMetadata={calculateRacingInjuryCycleMetadata}
      />
      <Composition
        id="ListenToYourBody"
        component={ListenToYourBody}
        width={1920}
        height={1080}
        fps={30}
        durationInFrames={235}
        calculateMetadata={calculateListenToYourBodyMetadata}
      />
      <Composition
        id="HolisticWheel"
        component={HolisticWheel}
        width={1920}
        height={1080}
        fps={30}
        durationInFrames={178}
        calculateMetadata={calculateHolisticWheelMetadata}
      />
      <Composition
        id="UnravellingBody"
        component={UnravellingBody}
        width={1920}
        height={1080}
        fps={30}
        durationInFrames={215}
        calculateMetadata={calculateUnravellingBodyMetadata}
      />
    </Folder>
    <Folder name="Visuals">
      <Composition
        id="FinishLine"
        component={FinishLine}
        width={1920}
        height={1080}
        fps={30}
        durationInFrames={150}
        calculateMetadata={calculateFinishLineMetadata}
      />
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
            // The on-screen header shows the video's overall title, not each
            // short's own title (that's still used for the YouTube upload).
            videoTitle: project.name,
            sourceAspectRatio: project.sourceAspectRatio ?? undefined,
          }}
        />
      ))}
      </Folder>
      <Folder name="Reels">
      {reelProjects.flatMap((reelProject) =>
        reelProject.reels.map((reel, reelIndex) => ({ reelProject, reel, reelIndex })),
      ).map(({ reelProject, reel, reelIndex }, index) => (
        <Composition
          key={`${reel.id}-${index}`}
          id={`Reel-${reel.id}-${index}`}
          component={Reel}
          width={1080}
          height={1920}
          calculateMetadata={calculateReelMetadata}
          defaultProps={{
            project: reelProject.id,
            bpm: reel.bpm,
            shots: reel.shots,
            outName: `${reelProject.id}-reel-${String(reelIndex + 1).padStart(2, "0")}-${reel.id}`,
          }}
        />
      ))}
      </Folder>
      <Folder name="Clips">
      {projects.flatMap((project) =>
        (project.clips ?? []).map((clip, clipIndex) => ({
          project,
          clip,
          clipIndex,
        })),
      ).map(({ project, clip, clipIndex }, index) => (
        <Composition
          key={`${clip.id}-${index}`}
          id={`SocialClip-${clip.id}-${index}`}
          component={SocialClip}
          width={1920}
          height={1080}
          calculateMetadata={calculateSocialClipMetadata}
          defaultProps={{
            project: project.id,
            start: clip.start,
            end: clip.end,
            sourceAspectRatio: project.sourceAspectRatio ?? undefined,
            // clips.json is ordered best first, so the number is the clip's rank.
            outName: `${project.id}-clip-${String(clipIndex + 1).padStart(2, "0")}-${clip.id}`,
          }}
        />
      ))}
      </Folder>
    </>
  );
};





