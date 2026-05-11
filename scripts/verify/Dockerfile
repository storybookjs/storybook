# syntax=docker/dockerfile:1.7

############################################################
# Stage 1: base — pin Playwright image by digest.
# Digest resolved via `docker manifest inspect --verbose
# mcr.microsoft.com/playwright:v1.58.2-jammy` on 2026-05-11.
# linux/amd64 entry. Renovate (§8.7a) re-resolves weekly.
############################################################
FROM mcr.microsoft.com/playwright:v1.58.2-jammy@sha256:02627380acd41aa17ec78d3fb554be2fffd1f3c603d659aadafbdd6fb34289b0 AS base

ARG HEAD_SHA=unknown
ARG NODE_VERSION=22.22.1
ARG BUN_VERSION=1.3.0

ENV DEBIAN_FRONTEND=noninteractive \
    NODE_ENV=production \
    STORYBOOK_DISABLE_TELEMETRY=1 \
    PLAYWRIGHT_SKIP_BROWSER_DOWNLOAD=1 \
    YARN_ENABLE_GLOBAL_CACHE=false \
    YARN_ENABLE_TELEMETRY=false \
    COREPACK_ENABLE_DOWNLOAD_PROMPT=0

# 1.a Pin Node 22.22.1. Re-install only if mismatch (OQ-V5-0-E resolved:
# playwright:v1.58.2-jammy ships Node 24.x, so the re-install always fires).
# xz-utils + ca-certificates are required to extract the .tar.xz and validate
# TLS to nodejs.org. Both are absent from the jammy base. apt lists pruned
# after install to keep the layer slim.
RUN set -eux; \
    if [ "$(node --version 2>/dev/null || true)" != "v${NODE_VERSION}" ]; then \
      apt-get update; \
      apt-get install -y --no-install-recommends xz-utils ca-certificates; \
      rm -rf /var/lib/apt/lists/*; \
      curl -fsSLo /tmp/node.tar.xz "https://nodejs.org/dist/v${NODE_VERSION}/node-v${NODE_VERSION}-linux-x64.tar.xz"; \
      tar -xJf /tmp/node.tar.xz -C /usr/local --strip-components=1 --no-same-owner; \
      rm /tmp/node.tar.xz; \
    fi; \
    node --version | grep -F "v${NODE_VERSION}"

# 1.b HIGH #4 — Corepack network-fetch bypass. We invoke yarn directly from the
# on-disk binary that the harden script overlaid from base-sha. No corepack,
# no network fetch of yarn from npm. The `node $HARNESS_YARN_BIN` invocation is used
# in every subsequent yarn step.
ENV HARNESS_YARN_BIN=/opt/verify-harness/repo/.yarn/releases/yarn-4.10.3.cjs \
    COREPACK_ENABLE_NETWORK=0 \
    COREPACK_ENABLE_DOWNLOAD_PROMPT=0
# We do NOT run `corepack enable` — the binary at $HARNESS_YARN_BIN is the source of
# truth. The on-disk binary is verified to exist + report 4.10.3 in stage 2
# (after .yarn/ is COPYed in). If the file is absent or yields the wrong
# version, stage 2 fails the build before yarn install runs.

# 1.c Bun — pinned by digest, copied from official multi-arch image (F-6).
# Digest resolved via `docker manifest inspect --verbose oven/bun:1.3.0-slim`
# on 2026-05-11 (linux/amd64).
COPY --from=oven/bun:1.3.0-slim@sha256:337866545ababba9c5b7432e0b446eaba25621a55d2757df1f933f6f609714c7 /usr/local/bin/bun /usr/local/bin/bun
RUN bun --version | grep -F "${BUN_VERSION}"

# 1.d Non-root user. Playwright's jammy base already ships `pwuser` at
# UID/GID 1000, so the create commands are guarded with getent/id probes
# (idempotent for a future base image that drops the prebuilt user).
RUN if ! getent group 1000 > /dev/null; then groupadd --gid 1000 verify; fi && \
    if ! id -u 1000 > /dev/null 2>&1; then \
      useradd --uid 1000 --gid 1000 --create-home --shell /bin/bash verify; \
    fi && \
    mkdir -p /workspace /workspace/.verify-output /opt/verify-harness && \
    chown -R 1000:1000 /workspace /opt/verify-harness

# 1.e Bake HEAD_SHA (F-4).
RUN echo "$HEAD_SHA" > /opt/verify-harness/HEAD_SHA && \
    chown 1000:1000 /opt/verify-harness/HEAD_SHA && \
    chmod 0444 /opt/verify-harness/HEAD_SHA
LABEL org.storybook.verify.head_sha=$HEAD_SHA

############################################################
# Stage 2: deps — install root + scripts + code workspaces' node_modules.
# Inputs come from the build context (hardened head checkout).
############################################################
FROM base AS deps

WORKDIR /opt/verify-harness/repo

# Manifests first (layer cache).
COPY --chown=1000:1000 package.json yarn.lock .yarnrc.yml ./
COPY --chown=1000:1000 .yarn .yarn

# Enumerate every workspace's package.json. Concrete list mirrored from the
# root package.json `workspaces.packages` glob — kept as explicit per-workspace
# COPY lines (BuildKit does not support `--parents` for arbitrary globs in the
# stable 1.7 frontend, so we enumerate). The hardened build context guarantees
# every path below exists at base-sha.
COPY --chown=1000:1000 scripts/package.json scripts/
# Portal target referenced from scripts/package.json
# ("eslint-plugin-local-rules": "portal:./eslint-plugin-local-rules"). Yarn must
# see the portal directory at install time to resolve the manifest. Copy the
# whole directory so the plugin's runtime files are also present for `yarn lint`.
COPY --chown=1000:1000 scripts/eslint-plugin-local-rules/ scripts/eslint-plugin-local-rules/
COPY --chown=1000:1000 code/package.json code/
COPY --chown=1000:1000 code/core/package.json code/core/

# code/addons/*
COPY --chown=1000:1000 code/addons/a11y/package.json code/addons/a11y/
COPY --chown=1000:1000 code/addons/docs/package.json code/addons/docs/
COPY --chown=1000:1000 code/addons/links/package.json code/addons/links/
COPY --chown=1000:1000 code/addons/onboarding/package.json code/addons/onboarding/
COPY --chown=1000:1000 code/addons/pseudo-states/package.json code/addons/pseudo-states/
COPY --chown=1000:1000 code/addons/themes/package.json code/addons/themes/
COPY --chown=1000:1000 code/addons/vitest/package.json code/addons/vitest/

# code/builders/*
COPY --chown=1000:1000 code/builders/builder-vite/package.json code/builders/builder-vite/
COPY --chown=1000:1000 code/builders/builder-webpack5/package.json code/builders/builder-webpack5/

# code/frameworks/*
COPY --chown=1000:1000 code/frameworks/angular/package.json code/frameworks/angular/
COPY --chown=1000:1000 code/frameworks/ember/package.json code/frameworks/ember/
COPY --chown=1000:1000 code/frameworks/html-vite/package.json code/frameworks/html-vite/
COPY --chown=1000:1000 code/frameworks/nextjs/package.json code/frameworks/nextjs/
COPY --chown=1000:1000 code/frameworks/nextjs-vite/package.json code/frameworks/nextjs-vite/
COPY --chown=1000:1000 code/frameworks/preact-vite/package.json code/frameworks/preact-vite/
COPY --chown=1000:1000 code/frameworks/react-native-web-vite/package.json code/frameworks/react-native-web-vite/
COPY --chown=1000:1000 code/frameworks/react-vite/package.json code/frameworks/react-vite/
COPY --chown=1000:1000 code/frameworks/react-webpack5/package.json code/frameworks/react-webpack5/
COPY --chown=1000:1000 code/frameworks/server-webpack5/package.json code/frameworks/server-webpack5/
COPY --chown=1000:1000 code/frameworks/svelte-vite/package.json code/frameworks/svelte-vite/
COPY --chown=1000:1000 code/frameworks/sveltekit/package.json code/frameworks/sveltekit/
COPY --chown=1000:1000 code/frameworks/tanstack-react/package.json code/frameworks/tanstack-react/
COPY --chown=1000:1000 code/frameworks/vue3-vite/package.json code/frameworks/vue3-vite/
COPY --chown=1000:1000 code/frameworks/web-components-vite/package.json code/frameworks/web-components-vite/

# code/lib/*
COPY --chown=1000:1000 code/lib/cli-sb/package.json code/lib/cli-sb/
COPY --chown=1000:1000 code/lib/cli-storybook/package.json code/lib/cli-storybook/
COPY --chown=1000:1000 code/lib/codemod/package.json code/lib/codemod/
COPY --chown=1000:1000 code/lib/core-webpack/package.json code/lib/core-webpack/
COPY --chown=1000:1000 code/lib/create-storybook/package.json code/lib/create-storybook/
COPY --chown=1000:1000 code/lib/csf-plugin/package.json code/lib/csf-plugin/
COPY --chown=1000:1000 code/lib/eslint-plugin/package.json code/lib/eslint-plugin/
COPY --chown=1000:1000 code/lib/react-dom-shim/package.json code/lib/react-dom-shim/

# code/presets/*
COPY --chown=1000:1000 code/presets/create-react-app/package.json code/presets/create-react-app/
COPY --chown=1000:1000 code/presets/react-webpack/package.json code/presets/react-webpack/
COPY --chown=1000:1000 code/presets/server-webpack/package.json code/presets/server-webpack/

# code/renderers/*
COPY --chown=1000:1000 code/renderers/html/package.json code/renderers/html/
COPY --chown=1000:1000 code/renderers/preact/package.json code/renderers/preact/
COPY --chown=1000:1000 code/renderers/react/package.json code/renderers/react/
COPY --chown=1000:1000 code/renderers/server/package.json code/renderers/server/
COPY --chown=1000:1000 code/renderers/svelte/package.json code/renderers/svelte/
COPY --chown=1000:1000 code/renderers/vue3/package.json code/renderers/vue3/
COPY --chown=1000:1000 code/renderers/web-components/package.json code/renderers/web-components/

# `WORKDIR /opt/verify-harness/repo` (line 79) was executed as root, so the
# directory itself is root-owned even though COPY --chown=1000:1000 placed
# its contents with uid 1000. Yarn runs as uid 1000 (USER below) and must
# `mkdir node_modules/` here — chown the workdir so the link step succeeds.
RUN chown 1000:1000 /opt/verify-harness/repo

USER 1000:1000

# HIGH #4 — verify the on-disk yarn binary BEFORE invoking it, then call it via
# node directly. No corepack network fetch.
RUN test -f "$HARNESS_YARN_BIN" || { echo "::error::yarn binary missing at $HARNESS_YARN_BIN"; exit 1; } && \
    node "$HARNESS_YARN_BIN" --version | grep -F "4.10.3"

RUN --mount=type=cache,target=/home/verify/.yarn-cache,uid=1000,gid=1000 \
    YARN_GLOBAL_FOLDER=/home/verify/.yarn-cache node "$HARNESS_YARN_BIN" install --immutable

############################################################
# Stage 3: build — compile code/core + bootstrap sandbox.
############################################################
FROM deps AS build

ENV STORYBOOK_SANDBOX_ROOT=/opt/verify-harness/storybook-sandboxes

# Full source tree.
COPY --chown=1000:1000 . /opt/verify-harness/repo

WORKDIR /opt/verify-harness/repo

# 3.a Compile core + the CLI packages that scripts/utils/cli-step.ts resolves
# via `require.resolve(...dist/bin/...)` at module-eval time. The sandbox task
# imports cli-step.ts, so cli-storybook and create-storybook must be compiled
# before the next step runs.
RUN node "$HARNESS_YARN_BIN" nx run-many -t compile -p core,cli-storybook,create-storybook

# 3.b Bootstrap the sandbox at the baked path.
RUN mkdir -p /opt/verify-harness/storybook-sandboxes && \
    node "$HARNESS_YARN_BIN" task sandbox --template react-vite/default-ts --start-from auto

# 3.c Sanitize resolutions + snapshot via bun (F-12 — node strip-types rejects non-erasable enums).
# MEDIUM — `bun -e` is the correct CLI (no `run`); use absolute import path.
RUN bun -e "import('/opt/verify-harness/repo/scripts/verify/sandbox.ts').then(async (m) => { \
      const dir = m.resolveSandboxDir(); \
      await m.snapshotSandbox(dir); \
      await m.sanitizeResolutions(dir); \
      console.log('[build] sandbox snapshotted and sanitized at', dir); \
    })"

# 3.d Materialise dist as plain directory (NOT a symlink).
RUN set -eux; \
    SBX_DIST="${STORYBOOK_SANDBOX_ROOT}/react-vite-default-ts/node_modules/storybook/dist"; \
    rm -rf "${SBX_DIST}"; \
    cp -RL /opt/verify-harness/repo/code/core/dist "${SBX_DIST}"; \
    ls "${SBX_DIST}/index.js" >/dev/null

# 3.e Permissions sweep.
USER root
RUN chown -R 1000:1000 /opt/verify-harness

############################################################
# Stage 4: runtime — smoke script + entrypoint.
############################################################
FROM build AS runtime

ENV VERIFY_HARNESS_IN_CONTAINER=1 \
    STORYBOOK_SANDBOX_ROOT=/opt/verify-harness/storybook-sandboxes \
    STORYBOOK_DISABLE_TELEMETRY=1

# Smoke script — emits a single-line JSON sentinel to stdout, fail-closed on digest.
# BLOCKER #1: NO all-zero fallback. Missing/malformed digest → exit non-zero.
RUN printf '%s\n' \
  '#!/usr/bin/env bash' \
  'set -euo pipefail' \
  'cd /opt/verify-harness/repo' \
  'DIGEST="${VERIFY_HARNESS_IMAGE_DIGEST:-}"' \
  '[ -n "$DIGEST" ] || { echo "::error::smoke missing VERIFY_HARNESS_IMAGE_DIGEST" >&2; exit 1; }' \
  '[[ "$DIGEST" =~ ^sha256:[a-f0-9]{64}$ ]] || { echo "::error::smoke digest malformed: $DIGEST" >&2; exit 1; }' \
  'START=$(date +%s%3N)' \
  'export VERIFY_HARNESS_IN_CONTAINER=1' \
  'node "$HARNESS_YARN_BIN" verify-pr --skip-recipe >/dev/null' \
  'END=$(date +%s%3N)' \
  'printf "{\"event\":\"smoke\",\"status\":\"ready\",\"durationMs\":%s,\"imageDigest\":\"%s\"}\n" "$((END-START))" "$DIGEST"' \
  > /opt/verify-harness/smoke.sh && chmod +x /opt/verify-harness/smoke.sh

WORKDIR /workspace
USER 1000:1000

# HIGH #4 — entrypoint invokes yarn via the on-disk binary, not via PATH lookup
# (which would resolve corepack's shim and could re-introduce a network fetch).
ENTRYPOINT ["node", "/opt/verify-harness/repo/.yarn/releases/yarn-4.10.3.cjs", "--cwd", "/opt/verify-harness/repo", "verify-pr"]
CMD ["--help"]
