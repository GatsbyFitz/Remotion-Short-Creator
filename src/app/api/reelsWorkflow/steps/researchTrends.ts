import { generateText } from "ai";
import { openai } from "@ai-sdk/openai";
import { generateStructuredWithRepair } from "../../shortsWorkflow/steps/instructionsShared";
import {
  EVERGREEN_TRENDS,
  MediaAnalysis,
  MediaManifest,
  Trend,
  TrendResearch,
  TrendsSchema,
  readJson,
  reelPath,
  setStatus,
  structureTrendsPrompt,
  trendResearchPrompt,
  writeJson,
} from "./reelsShared";

// Finds the formats trending on Reels right now that suit this album, with live
// web search. The search model writes prose with citations; a second, cheaper
// pass turns that into structured trends.
//
// Re-run on every "replan", so regenerating a project's reels picks up whatever
// is trending that day without re-importing the album.
export async function researchTrends(project: string): Promise<TrendResearch> {
  "use step";

  setStatus(project, "researching");

  const analysis = readJson<MediaAnalysis>(reelPath(project, "media-analysis.json"));
  const manifest = readJson<MediaManifest>(reelPath(project, "media-manifest.json"));

  const videos = manifest.items.filter((i) => i.kind === "video").length;
  const mediaMix = `${manifest.items.length - videos} photos and ${videos} video clips`;
  const today = new Date().toISOString().slice(0, 10);

  let webTrends: Trend[] = [];

  try {
    const research = await generateText({
      model: openai("gpt-5.4-mini"),
      tools: { web_search: openai.tools.webSearch({ searchContextSize: "medium" }) },
      prompt: trendResearchPrompt(today, analysis, mediaMix),
    });

    if (!research.text.trim()) {
      throw new Error("the search returned no text");
    }

    const sources = research.sources.flatMap((s) =>
      s.sourceType === "url" ? [{ url: s.url, title: s.title }] : [],
    );

    const structured = await generateStructuredWithRepair({
      model: "google/gemini-3.7-flash",
      messages: [{ role: "user", content: [{ type: "text", text: structureTrendsPrompt(research.text, sources) }] }],
      schema: TrendsSchema,
    });

    webTrends = structured.trends.map((trend) => ({ ...trend, origin: "web" as const }));
    console.log(`Trend research: ${webTrends.length} trends from ${sources.length} sources.`);
  } catch (err) {
    // The reels still get made, on formats that are reliably popular, but the
    // result is marked "evergreen" so the UI says plainly that they aren't
    // built on this week's research.
    console.warn(
      `Trend research failed for "${project}", falling back to evergreen formats:`,
      err instanceof Error ? err.message : err,
    );
  }

  const result: TrendResearch = {
    researchedAt: new Date().toISOString(),
    origin: webTrends.length > 0 ? "web" : "evergreen",
    // Evergreen formats ride along as backups the plan can use if the album
    // doesn't suit enough of the researched ones.
    trends: [...webTrends, ...EVERGREEN_TRENDS.filter((e) => !webTrends.some((w) => w.id === e.id))],
  };

  writeJson(reelPath(project, "trends.json"), result);

  return result;
}
