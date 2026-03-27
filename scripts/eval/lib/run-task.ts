import { writeFileSync } from 'node:fs';
import { join } from 'node:path';
import type { TrialConfig, TrialResult } from '../types';
import { MODEL_TIERS } from '../types';
import { agents } from '../config';
import { prepareTrial } from './prepare-trial';
import { generatePrompt } from './generate-prompt';
import { grade } from './grade';
import { generateTrialId, log, logSuccess } from './utils';

/**
 * Run a full eval trial: prepare -> execute agent -> grade.
 */
export async function runTask(config: TrialConfig): Promise<TrialResult> {
  const { project, agent: agentName, model, promptFile, verbose } = config;
  const trialId = generateTrialId(project.name, agentName, model);
  const timestamp = new Date().toISOString();

  log(`\nPreparing ${project.name}...`);

  // 1. Prepare the trial (clone, clean, init storybook, baseline commit)
  const paths = await prepareTrial(project, trialId);

  // 2. Generate the prompt
  const prompt = generatePrompt(promptFile);
  writeFileSync(join(paths.resultsDir, 'prompt.md'), prompt);

  // 3. Execute the agent
  log(`  Running ${agentName} (${model})...`);
  const agent = agents[agentName];
  const execution = await agent.execute(prompt, paths.projectPath, model, {
    verbose,
    resultsDir: paths.resultsDir,
  });
  logSuccess(
    `Agent completed (${Math.round(execution.duration)}s, ${execution.cost ? `$${execution.cost.toFixed(2)}` : 'cost N/A'}, ${execution.turns} turns)`
  );

  // 4. Grade the results
  const { grading, quality } = await grade(paths);

  // 5. Assemble final result
  const result: TrialResult = {
    schemaVersion: 1,
    project: project.name,
    agent: agentName,
    model,
    modelTier: MODEL_TIERS[model],
    timestamp,
    promptFile: promptFile || 'setup.md',
    baselineCommit: paths.baselineCommit,
    execution,
    grading,
    quality,
  };

  writeFileSync(join(paths.resultsDir, 'summary.json'), JSON.stringify(result, null, 2));
  logSuccess(`Results saved to ${paths.resultsDir}`);

  return result;
}
