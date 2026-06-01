import { Composition } from "remotion";
import { ShortCreator, calculateMetadata } from "./shortCreator/Main";
import { GaugeSchema, Gauge, calculateGaugeMetadata  } from "./Gauge/Main";
import { TwoYearTimeline, calculateTwoYearTimelineMetadata } from "./TwoYearTimeline/Main";
import React, { useEffect, useState } from "react";


type Segment = { start: number; end: number };
type Short = {
  id: string;
  segments: Segment[];
};
type Project = {
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
  const [projects, setProjects] = useState<Project[] | null>(null);

  useEffect(() => {
    void fetchProjects().then(setProjects);
    console.log("Fetched projects:", projects);
  }, []);

  if (projects === null) {
    return null;
  }

  return (
    <>
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
      {projects.flatMap((project) =>
        project.shorts.map((short) => ({
          project,
          short,
        })),
      ).map(({ project, short }, index) => (
        <Composition
          key={`${project.name}-${short.id ?? index}`}
          id={`ShortCreator-${project.name}-${short.id ?? index}`}
          component={ShortCreator}
          width={1080}
          height={1920}
          calculateMetadata={calculateMetadata}
          defaultProps={{
            segments: short.segments,
            project: project.name,
          }}
        />
      ))}
    </>
  );
};





