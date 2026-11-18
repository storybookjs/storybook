# The version must match the `playwright` version in package.json: the evidence tools load that
# package from the mounted node_modules and launch the browsers baked into this image.
ARG PLAYWRIGHT_VERSION=1.58.2
FROM mcr.microsoft.com/playwright:v${PLAYWRIGHT_VERSION}-noble

ARG PLAYWRIGHT_VERSION

RUN apt-get update && apt-get install -y --no-install-recommends build-essential curl git jq \
  && rm -rf /var/lib/apt/lists/*

# The base image's Node is older than what current projects' dependencies accept.
ARG N_VERSION=11.0.0
ARG NODE_VERSION=24.22.2
RUN npm install -g "n@$N_VERSION" && N_PREFIX=/usr/local n "$NODE_VERSION" && node --version

RUN corepack enable
ENV COREPACK_ENABLE_DOWNLOAD_PROMPT=0

# The project under test may pin another Playwright version and install its browsers here. Its
# install would delete the browser of the image's own Playwright, which the browser tool runs.
RUN chmod -R a+rwX /ms-playwright
ENV PLAYWRIGHT_SKIP_BROWSER_GC=1

# The browser tools no agent gets: a script in the page reads what the page hides from a user, and
# an installed browser replaces the one the browser tool runs. Claude Code's managed settings win
# over the user's and the project's.
ARG DENIED_BROWSER_TOOLS="browser_evaluate browser_run_code browser_install"
RUN mkdir -p /etc/claude-code \
  && jq -n --arg tools "$DENIED_BROWSER_TOOLS" \
    '{permissions: {deny: ($tools | split(" ") | map("mcp__playwright__" + .))}}' \
    > /etc/claude-code/managed-settings.json

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

# Docker's seccomp profile denies the user namespaces of Chromium's own sandbox, which the
# Playwright MCP server turns on, so the server gets --no-sandbox. A plan step may only open
# localhost. The browser server blocks direct requests to a host other than `localhost` and
# `127.0.0.1`. It follows a redirect from `localhost` to another host and lets a WebSocket to
# another host through, so it is no security boundary.
ARG BROWSER_MCP="/home/agent/.npm-global/bin/playwright run-mcp-server --headless --browser chromium --no-sandbox --isolated --viewport-size 1280x800 --allowed-origins localhost:*;127.0.0.1:* --output-dir /home/agent/qa-evidence/browser"
RUN set -f && PLAYWRIGHT_SKIP_BROWSER_DOWNLOAD=1 npm install -g "playwright@$PLAYWRIGHT_VERSION" \
  && claude mcp add --scope user playwright -- $BROWSER_MCP \
  && codex mcp add playwright -- $BROWSER_MCP \
  && jq -cn --arg tools "$DENIED_BROWSER_TOOLS" '"disabled_tools = \($tools | split(" "))"' -r \
    >> /home/agent/.codex/config.toml \
  && claude mcp list && codex mcp get playwright --json

WORKDIR /home/agent
ENTRYPOINT ["sleep", "infinity"]
