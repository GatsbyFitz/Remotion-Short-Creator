import { setStatus } from "./reelsShared";

// Records why a run stopped, so the UI can show it rather than sitting on the
// last status forever.
export async function markReelsFailed(project: string, message: string) {
  "use step";

  setStatus(project, "failed", message);
}
