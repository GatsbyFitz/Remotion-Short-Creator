import { Composition } from "remotion";
import { ShortCreator, calculateMetadata } from "./shortCreator/Main";
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
    const response = await fetch("http://localhost:3001/api/findProjects");
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
  }, []);

  if (!projects) {
    return null;
  }


  console.log("Found projects:", projects);

  return (
    <>
      {projects
      .flatMap((project) =>
        project.shorts.flatMap((short) =>
          short.segments.map((segment) => ({
            project,
            segment,
          })),
        ),
      )
      .map(({ project, segment }, index) => (
        <Composition
          key={`${project.name}-${index}`}
          id={`ShortCreator-${project.name}-${index}`}
          component={ShortCreator}
          width={1080}
          height={1920}
          calculateMetadata={calculateMetadata}
          defaultProps={{
            segments: [segment],
            project,
          }}
        />
      ))}
    </>
  );
};





