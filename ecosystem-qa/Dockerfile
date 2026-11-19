# The tag must match the `playwright` version in package.json: the evidence tools load that package
# from the mounted node_modules and launch the browsers baked into this image.
FROM mcr.microsoft.com/playwright:v1.58.2-noble

RUN apt-get update && apt-get install -y --no-install-recommends curl git jq \
  && rm -rf /var/lib/apt/lists/*

RUN corepack enable
ENV COREPACK_ENABLE_DOWNLOAD_PROMPT=0

# The project under test may pin another Playwright version and install its browsers here.
RUN chmod -R a+rwX /ms-playwright

ARG AGENT_UID=1000
ARG AGENT_GID=1000
RUN groupmod -o -g $AGENT_GID pwuser && usermod -o -u $AGENT_UID -g $AGENT_GID -d /home/agent -m -l agent pwuser
USER ${AGENT_UID}:${AGENT_GID}

# The defaults match the workflow env; the workflow passes its own values as build args.
ARG CLAUDE_CODE_VERSION=2.1.312
ARG CODEX_VERSION=0.166.0
ENV NPM_CONFIG_PREFIX=/home/agent/.npm-global
ENV PATH="/home/agent/.local/bin:/home/agent/.npm-global/bin:$PATH"
RUN curl -fsSL https://claude.ai/install.sh | bash -s "$CLAUDE_CODE_VERSION" \
  && npm install -g "@openai/codex@$CODEX_VERSION" \
  && claude --version && codex --version

WORKDIR /home/agent
ENTRYPOINT ["sleep", "infinity"]
