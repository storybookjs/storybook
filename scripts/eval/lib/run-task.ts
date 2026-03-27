import { writeFileSync } from "node:fs";
import { join } from "node:path";
import type { TrialConfig, TrialResult } from "../types.ts";
import { agents } from "../config.ts";
import { prepareTrial } from "./prepare-trial.ts";
import { generatePrompt } from "./generate-prompt.ts";
import { grade } from "./grade.ts";
import { captureEnvironment, saveToGoogleSheets } from "./save.ts";
import { generateTrialId, createLogger } from "./utils.ts";
import type { Logger } from "./utils.ts";

/**
 * Run a full eval trial: prepare -> execute agent -> grade -> save.
 */
export async function runTask(
  config: TrialConfig,
  runId: string,
  uploadId: string,
  logger?: Logger,
): Promise<TrialResult> {
  const { project, agent: agentName, model, effort, prompt: promptName, verbose } = config;
  const { log, logSuccess } = logger ?? createLogger();
  const trialId = generateTrialId(project.name, agentName, model, promptName || "setup");
  const timestamp = new Date().toISOString();

  log(`Preparing ${project.name}...`);

  // 1. Prepare the trial
  const paths = await prepareTrial(project, trialId);

  // 2. Capture environment
  const environment = await captureEnvironment(paths.resultsDir);

  // 3. Generate the prompt
  const prompt = generatePrompt(promptName);
  writeFileSync(join(paths.resultsDir, "prompt.md"), prompt);

  // 4. Execute the agent
  log(`  Running ${agentName} (${model}, effort=${effort})...`);
  const agent = agents[agentName];
  const execution = await agent.execute(prompt, paths.projectPath, model, {
    effort,
    verbose,
    resultsDir: paths.resultsDir,
  });
  logSuccess(
    `Agent completed (${Math.round(execution.duration)}s, ${execution.cost ? `$${execution.cost.toFixed(2)}` : "cost N/A"}, ${execution.turns} turns)`,
  );

  // 5. Grade the results
  const { grading, quality } = await grade(paths);

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

  writeFileSync(join(paths.resultsDir, "summary.json"), JSON.stringify(result, null, 2));
  logSuccess(`Results saved to ${paths.resultsDir}`);

  // 7. Upload to Google Sheets
  await saveToGoogleSheets(result, environment, runId, uploadId);

  return result;
}
