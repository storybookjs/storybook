import { detectAgent as stdEnvDetectAgent } from 'std-env';

export type AgentInfo = {
  /**
   * The name of the detected AI coding agent (e.g. `claude`, `gemini`, `codex`, `cursor`). Can be
   * any value supported by std-env or explicitly set via the `AI_AGENT` environment variable.
   */
  name: string;
};

export type AgentDetection = AgentInfo | undefined;

/** Detect whether Storybook CLI is likely being invoked by an AI agent, using std-env. */
export const detectAgent = (): AgentDetection => {
  const { name } = stdEnvDetectAgent();
  if (!name) {
    return undefined;
  }
  return { name };
};
