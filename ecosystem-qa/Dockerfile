# The tag must match the `playwright` version in package.json: the evidence tools load that package
# from the mounted node_modules and launch the browsers baked into this image.
FROM mcr.microsoft.com/playwright:v1.58.2-noble

RUN apt-get update && apt-get install -y --no-install-recommends build-essential curl git jq \
  && rm -rf /var/lib/apt/lists/*

# The base image's Node is older than what current projects' dependencies accept.
ARG N_VERSION=11.0.0
ARG NODE_VERSION=24.22.2
RUN npm install -g "n@$N_VERSION" && N_PREFIX=/usr/local n "$NODE_VERSION" && node --version

RUN corepack enable
ENV COREPACK_ENABLE_DOWNLOAD_PROMPT=0

# The project under test may pin another Playwright version and install its browsers here.
RUN chmod -R a+rwX /ms-playwright

ARG AGENT_UID=1000
ARG AGENT_GID=1000
RUN groupmod -o -g $AGENT_GID pwuser && usermod -o -u $AGENT_UID -g $AGENT_GID -d /home/agent -m -l agent pwuser
USER ${AGENT_UID}:${AGENT_GID}

# Lets the agent run `n <version>` unprivileged; this directory is first in PATH.
ENV N_PREFIX=/home/agent/.local
# A project's git hooks have no place in a QA worktree, and husky fails writing the worktree's git config.
ENV HUSKY=0

# The defaults match the workflow env; the workflow passes its own values as build args.
ARG CLAUDE_CODE_VERSION=2.1.312
ARG CODEX_VERSION=0.166.0
ARG BUN_VERSION=1.4.4
ARG MISE_VERSION=v2026.11.6
ENV NPM_CONFIG_PREFIX=/home/agent/.npm-global
ENV PATH="/home/agent/.local/bin:/home/agent/.npm-global/bin:$PATH"
RUN curl -fsSL https://claude.ai/install.sh | bash -s "$CLAUDE_CODE_VERSION" \
  && npm install -g "@openai/codex@$CODEX_VERSION" "bun@$BUN_VERSION" \
  && claude --version && codex --version && bun --version

# Some projects refuse to install without it.
RUN curl -fsSL https://mise.run | MISE_VERSION="$MISE_VERSION" MISE_INSTALL_PATH=/home/agent/.local/bin/mise sh \
  && mise --version

WORKDIR /home/agent
ENTRYPOINT ["sleep", "infinity"]
