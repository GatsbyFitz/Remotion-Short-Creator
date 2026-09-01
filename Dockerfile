# Single stage on purpose: /api/render bundles the Remotion project at runtime,
# so the image needs the source and the full node_modules (webpack included).
# Pruning to a standalone build would break rendering.
FROM node:22-bookworm-slim

# Chromium from Debian rather than Remotion's downloader: it pulls in the shared
# libraries headless Chrome needs anyway, keeps the image reproducible, and
# means the first render is not stuck behind a ~150MB download. Wired up via
# REMOTION_BROWSER_EXECUTABLE below.
RUN apt-get update && apt-get install -y --no-install-recommends \
      chromium \
      fonts-liberation \
      ca-certificates \
    && rm -rf /var/lib/apt/lists/*

ENV REMOTION_BROWSER_EXECUTABLE=/usr/bin/chromium
ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1

WORKDIR /app

RUN corepack enable && corepack prepare pnpm@10.33.0 --activate

# Dependencies first so edits to src/ do not invalidate the install layer.
COPY package.json pnpm-lock.yaml ./
RUN pnpm install --frozen-lockfile

COPY . .

RUN pnpm build

# Project data and rendered output are bind-mounted in compose; creating them
# here keeps the app working when it is run without volumes.
RUN mkdir -p public/projects public/miscellaneous out

EXPOSE 3000
CMD ["pnpm", "start"]
