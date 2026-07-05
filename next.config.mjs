import { BUILD_DIR } from "./build-dir.mjs";
import { withWorkflow } from "workflow/next"; 

/** @type {import('next').NextConfig} */
const nextConfig = {
    reactStrictMode: true,
    serverExternalPackages: ['@mediabunny/server', '@seydx/node-av'],
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