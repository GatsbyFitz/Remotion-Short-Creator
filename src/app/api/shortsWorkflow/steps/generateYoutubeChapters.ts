import { generateText, Output } from "ai";
import { z } from "zod";
import fs from "fs";

export async function generateYouTubeChapters(project: string) {
  "use step";

  const transcriptPath = `public/projects/${project}/transcript.json`;

  if (!fs.existsSync(transcriptPath)) {
    throw new Error(`Transcript file not found at path: ${transcriptPath}`);
  }

  const transcriptData = JSON.parse(fs.readFileSync(transcriptPath, "utf-8"));
  
  const segments = Array.isArray(transcriptData?.segments)
    ? transcriptData.segments
    : [];

  const cleanSegments = segments.map((segment: { start: number; end: number; text: string }) => ({
    start: Math.round(segment.start * 1000) / 1000,
    end: Math.round(segment.end * 1000) / 1000,
    text: segment.text.replace(/\./g, "").replace(/\s+/g, " ").trim(),
  }));

  // Schema for capturing sequential video chapters
  const ChaptersSchema = z.object({
    chapters: z.array(
      z.object({
        startTimeInSeconds: z.number().describe("The starting time of the chapter in seconds (integer). The first chapter must start at 0."),
        title: z.string().max(50).describe("A concise, engaging chapter title."),
        description: z.string().describe("A brief summary of what is covered in this section."),
      })
    ).min(3),
  });

  const prompt = `You are an expert video editor. Analyze the following video transcript and break it down into logical, sequential video chapters for a YouTube description.
  
  Requirements:
    - The first chapter MUST start at 0 seconds (00:00).
    - Each chapter should be at least 10 seconds long.
    - Provide a concise title and a short description for each section.
  
  Transcript: ${JSON.stringify(cleanSegments)}`;

  try {
    const result = await generateText({
      model: "google/gemini-3-flash",
      prompt,
      output: Output.object({ schema: ChaptersSchema }),
    });

    const { chapters } = result.output;

    // Helper to format seconds into HH:MM:SS or MM:SS
    const formatTimestamp = (totalSeconds: number): string => {
      const hours = Math.floor(totalSeconds / 3600);
      const minutes = Math.floor((totalSeconds % 3600) / 60);
      const seconds = Math.floor(totalSeconds % 60);

      const pad = (num: number) => String(num).padStart(2, "0");

      if (hours > 0) {
        return `${pad(hours)}:${pad(minutes)}:${pad(seconds)}`;
      }
      return `${pad(minutes)}:${pad(seconds)}`;
    };

    // Build the plain text file content for the YouTube description
    let fileContent = "TIMESTAMPS\n";
    chapters.forEach((chapter: { startTimeInSeconds: number; title: string; description: string }) => {
      const timestamp = formatTimestamp(chapter.startTimeInSeconds);
      fileContent += `${timestamp} - ${chapter.title}\n`;
    });

    fileContent += "\n\nCHAPTER DESCRIPTIONS\n";
    chapters.forEach((chapter: { startTimeInSeconds: number; title: string; description: string }) => {
      const timestamp = formatTimestamp(chapter.startTimeInSeconds);
      fileContent += `[${timestamp}] ${chapter.title}:\n${chapter.description}\n\n`;
    });

    // Save the output as a readable text file
    const outputPath = `public/projects/${project}/youtube_chapters.txt`;
    fs.writeFileSync(outputPath, fileContent, "utf-8");

    console.log(`YouTube chapters saved successfully to ${outputPath}`);

    return { outputPath, chapters };

  } catch (err) {
    console.error("generateYouTubeChapters error:", err);
    throw err;
  }
}