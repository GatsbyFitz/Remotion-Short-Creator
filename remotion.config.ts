// See all configuration options: https://remotion.dev/docs/config
// Each option also is available as a CLI flag: https://remotion.dev/docs/cli

// Note: When using the Node.JS APIs, the config file doesn't apply. Instead, pass options directly to the APIs

import { Config } from "@remotion/cli/config";
import { enableTailwind } from "@remotion/tailwind-v4";

// PNG, not JPEG: JPEG has no alpha channel, so it flattens the transparency the
// overlay compositions depend on before the ProRes 4444 encode ever sees it.
Config.setVideoImageFormat("png");
Config.setStillImageFormat("png");

// Render at 2x the composition's dimensions by default (1920x1080 -> 3840x2160).
// Scale is a render-level setting — it is NOT part of calculateMetadata, so it
// cannot be set per-composition; this config (or --scale on the CLI) is the only
// place it belongs.
Config.setScale(2);
Config.overrideWebpackConfig(enableTailwind);
Config.setExperimentalClientSideRenderingEnabled(true);
