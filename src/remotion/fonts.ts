import { loadFont } from "@remotion/fonts";
import { continueRender, delayRender, staticFile } from "remotion";

// Brand fonts are loaded from files vendored into public/fonts rather than from
// the Typekit stylesheet in src/app/layout.tsx — that stylesheet is part of the
// Next app and is never pulled into the Remotion bundle, so compositions were
// silently falling back to sans-serif on any machine that didn't happen to have
// the font installed locally. Imported by src/remotion/index.ts so every
// composition gets them in Studio and in CLI renders alike.
const handle = delayRender("Loading brand fonts");

Promise.all([
  loadFont({
    family: "baga",
    url: staticFile("fonts/Baga-Semibold.otf"),
    weight: "600",
  }),
])
  .then(() => continueRender(handle))
  .catch((error: unknown) => {
    // Never hang a render over a font: fall back and say why.
    console.error("Brand font loading failed, falling back to sans-serif:", error);
    continueRender(handle);
  });
