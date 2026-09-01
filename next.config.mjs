import { withWorkflow } from "workflow/next";

/** @type {import('next').NextConfig} */
const nextConfig = {
    reactStrictMode: true,
    // These ship native binaries or resolve files at runtime, so they must stay
    // outside the server bundle. @remotion/bundler and @remotion/renderer are
    // used by /api/render to bundle and render compositions on the server.
    serverExternalPackages: [
        '@mediabunny/server',
        '@remotion/bundler',
        '@remotion/renderer',
        // Pulls in @tailwindcss/webpack -> lightningcss, whose native bindings
        // Next cannot trace into the server bundle.
        '@remotion/tailwind-v4',
    ],
};

export default withWorkflow(nextConfig);
