# The sandbox image with the agent CLI replaced by a stand-in that runs gutenberg's package build
# and its Storybook tests in Vitest browser mode. Only for finding what the test run does to the
# memory of the host. Build: docker build -t sb-ecosystem-qa-standin-vitest <this dir>
FROM sb-ecosystem-qa
USER root
RUN rm -f /home/agent/.local/bin/claude
COPY --chmod=755 claude /home/agent/.local/bin/claude
USER agent
