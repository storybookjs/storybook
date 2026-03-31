import { writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import type { Logger } from './utils.ts';
import type { AgentId, AgentDriver, AgentVariant, Execution } from './agents/config.ts';
import type { Project } from './projects.ts';
import { grade, type Grade, type QualityScore } from './grade.ts';
import { claudeAgent } from './agents/claude-code.ts';
import { codexAgent } from './agents/codex.ts';
import { prepareTrial } from './prepare-trial.ts';
import { generateTrialId, loadPrompt, captureEnvironment, createLogger } from './utils.ts';

export interface TrialConfig {
  /** Which project to evaluate (cloned from its eval-baseline branch). */
  project: Project;
  /** Agent, model, and effort level. */
  variant: AgentVariant;
  /** Prompt name — maps to `prompts/{name}.md` (e.g. "setup"). */
  prompt: string;
  /** Log agent messages to stdout. */
  verbose?: boolean;
}

export interface TrialReport {
  schemaVersion: 1;
  project: Project;
  variant: AgentVariant;
  prompt: string;
  timestamp: string;
  baselineCommit: string;
  execution: Execution;
  grade: Grade;
  score: QualityScore;
}

const drivers: Record<AgentId, AgentDriver> = {
  claude: claudeAgent,
  codex: codexAgent,
};

/**
 * Run a full eval trial: prepare -> execute agent -> grade -> save.
 */
export async function runTrial(config: TrialConfig, logger?: Logger): Promise<TrialReport> {
  const { project, variant, prompt: promptName } = config;
  const { agent: agentName, model } = variant;
  const log = logger ?? createLogger();
  const trialId = generateTrialId(project.name, agentName, model, promptName || 'setup');
  const timestamp = new Date().toISOString();

  log.log(`Preparing ${project.name}...`);

  // 1. Prepare the trial
  const workspace = await prepareTrial(project, trialId, log);

  // 2. Capture environment
  await captureEnvironment(workspace.resultsDir);

  // 3. Load the prompt
  const prompt = loadPrompt(promptName);
  await writeFile(join(workspace.resultsDir, 'prompt.md'), prompt);

  // 4. Execute the agent
  log.log(`  Running ${agentName} (${model}, effort=${variant.effort})...`);
  const driver = drivers[agentName];
  const execution = await driver.execute({
    prompt,
    projectPath: workspace.projectPath,
    variant,
    resultsDir: workspace.resultsDir,
    logger: log,
  });
  log.logSuccess(
    `Agent completed (${Math.round(execution.duration)}s, ${execution.cost ? `$${execution.cost.toFixed(2)}` : 'cost N/A'}, ${execution.turns} turns)`
  );

  // 5. Grade the results (pass agent duration for performance scoring)
  const { grade: trialGrade, score } = await grade(workspace, log, execution.duration);

  // 6. Assemble final report
  const report: TrialReport = {
    schemaVersion: 1,
    project,
    variant,
    timestamp,
    prompt: promptName || 'setup',
    baselineCommit: workspace.baselineCommit,
    execution,
    grade: trialGrade,
    score,
  };

  await writeFile(join(workspace.resultsDir, 'summary.json'), JSON.stringify(report, null, 2));
  log.logSuccess(`Results saved to ${workspace.resultsDir}`);

  return report;
}
