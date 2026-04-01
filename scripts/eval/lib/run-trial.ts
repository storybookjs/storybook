import { writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import type { Logger } from './utils.ts';
import type { AgentId, AgentDriver, AgentVariant, Execution } from './agents/config.ts';
import type { Project } from './projects.ts';
import { grade, type Grade, type QualityScore } from './grade.ts';
import { claudeAgent } from './agents/claude-code.ts';
import { codexAgent } from './agents/codex.ts';
import {
  buildTrialArtifactUrls,
  buildTrialLabels,
  publishTrialBranch,
  type PublishMetadata,
} from './publish-trial.ts';
import { prepareTrial } from './prepare-trial.ts';
import { writeEvalResultDocs } from './result-docs.ts';
import { runStorybookScreenshots } from './screenshots.ts';
import { generateTrialId, loadPrompt, captureEnvironment, createLogger } from './utils.ts';

export interface TrialConfig {
  /** Which project to evaluate from its normalized benchmark baseline branch. */
  project: Project;
  /** Agent, model, and effort level. */
  variant: AgentVariant;
  /** Prompt name — maps to `prompts/{name}.md` (e.g. "setup"). */
  prompt: string;
  /** Log agent messages to stdout. */
  verbose?: boolean;
}

export interface TrialReport {
  schemaVersion: 2;
  project: Project;
  variant: AgentVariant;
  prompt: string;
  timestamp: string;
  baselineCommit: string;
  execution: Execution;
  grade: Grade;
  score: QualityScore;
  publish: PublishMetadata;
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
  const resolvedPromptName = promptName || 'setup';
  const trialId = generateTrialId(project.name, agentName, model, resolvedPromptName);
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

  // 6. Generate screenshots for the created or modified story files
  const screenshots = trialGrade.buildSuccess
    ? await runStorybookScreenshots({
        projectPath: workspace.projectPath,
        repoRoot: workspace.repoRoot,
        resultsDir: workspace.resultsDir,
        fileChanges: trialGrade.storybookChanges,
        logger: log,
      })
    : [];

  const publishForCommit = {
    branch: workspace.trialBranch,
    labels: buildTrialLabels(project, variant, resolvedPromptName),
    ...buildTrialArtifactUrls(project, workspace.trialBranch),
    screenshots,
  } satisfies PublishMetadata;

  // 7. Assemble report content that will be committed with the trial branch
  const reportForCommit: TrialReport = {
    schemaVersion: 2,
    project,
    variant,
    timestamp,
    prompt: resolvedPromptName,
    baselineCommit: workspace.baselineCommit,
    execution,
    grade: trialGrade,
    score,
    publish: publishForCommit,
  };

  await writeFile(
    join(workspace.resultsDir, 'summary.json'),
    JSON.stringify(reportForCommit, null, 2)
  );
  await writeEvalResultDocs(workspace.resultsDir);

  // 8. Commit, push, and open the benchmark PR
  const publish = await publishTrialBranch({
    project,
    workspace,
    variant,
    prompt: resolvedPromptName,
    trialId,
    score: score.score,
    screenshots,
    logger: log,
  });

  log.logSuccess(`Results saved to ${workspace.resultsDir}`);

  return {
    ...reportForCommit,
    publish,
  };
}
