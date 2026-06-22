import { BUILD_DIR } from "./build-dir.mjs";
import { withWorkflow } from "workflow/next"; 

/** @type {import('next').NextConfig} */
const nextConfig = {
    reactStrictMode: true,
    serverExternalPackages: [
        "@mediabunny/server",
        "node-av",
        "@seydx/node-av-darwin-arm64",
    ],
    // Include the Remotion bundle in the API route
    outputFileTracingIncludes: {
        "/api/render": [
            "./" + BUILD_DIR + "/**/*",
            "./render.ts",
            "./ensure-browser.ts",
        ],
    },
};

export default withWorkflow(nextConfig);