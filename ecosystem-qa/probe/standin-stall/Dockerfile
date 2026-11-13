# The sandbox image with the agent CLI replaced by a stand-in that runs gutenberg's dev server and
# package build. Only for proving the runner's memory guard without an agent.
# Build: docker build -t sb-ecosystem-qa-standin-build <this dir>
FROM sb-ecosystem-qa
USER root
RUN rm -f /home/agent/.local/bin/claude
COPY --chmod=755 claude /home/agent/.local/bin/claude
USER agent
