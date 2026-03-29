import { writeFile } from "node:fs/promises";
import { join } from "node:path";
import type { AgentName, Logger, TrialConfig, TrialResult, Agent } from "../types.ts";
import { claudeAgent } from "./agents/claude-code.ts";
import { codexAgent } from "./agents/codex.ts";
import { prepareTrial } from "./prepare-trial.ts";
import { grade } from "./grade.ts";
import { generateTrialId, loadPrompt, captureEnvironment, createLogger } from "./utils.ts";

const agents: Record<AgentName, Agent> = {
  claude: claudeAgent,
  codex: codexAgent,
};

/**
 * Run a full eval trial: prepare -> execute agent -> grade -> save.
 */
export async function runTask(
  config: TrialConfig,
  logger?: Logger,
): Promise<TrialResult> {
  const { project, agent: agentName, model, effort, prompt: promptName } = config;
  const log = logger ?? createLogger();
  const trialId = generateTrialId(project.name, agentName, model, promptName || "setup");
  const timestamp = new Date().toISOString();

  log.log(`Preparing ${project.name}...`);

  // 1. Prepare the trial
  const paths = await prepareTrial(project, trialId, log);

  // 2. Capture environment
  await captureEnvironment(paths.resultsDir);

  // 3. Load the prompt
  const prompt = loadPrompt(promptName);
  await writeFile(join(paths.resultsDir, "prompt.md"), prompt);

  // 4. Execute the agent
  log.log(`  Running ${agentName} (${model}, effort=${effort})...`);
  const agent = agents[agentName];
  const execution = await agent.execute({
    prompt,
    projectPath: paths.projectPath,
    model,
    effort,
    resultsDir: paths.resultsDir,
    logger: log,
  });
  log.logSuccess(
    `Agent completed (${Math.round(execution.duration)}s, ${execution.cost ? `$${execution.cost.toFixed(2)}` : "cost N/A"}, ${execution.turns} turns)`,
  );

  // 5. Grade the results (pass agent duration for performance scoring)
  const { grading, quality } = await grade(paths, log, execution.duration);

  // 6. Assemble final result
  const result: TrialResult = {
    schemaVersion: 1,
    project: project.name,
    agent: agentName,
    model,
    effort,
    timestamp,
    prompt: promptName || "setup",
    baselineCommit: paths.baselineCommit,
    execution,
    grading,
    quality,
  };

  await writeFile(join(paths.resultsDir, "summary.json"), JSON.stringify(result, null, 2));
  log.logSuccess(`Results saved to ${paths.resultsDir}`);

  return result;
}
