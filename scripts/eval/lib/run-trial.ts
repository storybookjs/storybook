import { writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import type { Logger } from './utils.ts';
import type { AgentId, AgentDriver, AgentVariant } from './agents/config.ts';
import type { Project } from './projects.ts';
import { grade } from './grade.ts';
import { claudeAgent } from './agents/claude-code.ts';
import { codexAgent } from './agents/codex.ts';
import { publishTrialBranch, type PublishMetadata } from './publish-trial.ts';
import { prepareTrial } from './prepare-trial.ts';
import { runStorybookScreenshots } from './screenshots.ts';
import { buildEvalData, type EvalData } from './result-docs.ts';
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

export type TrialReport = EvalData;

export interface RunTrialResult extends EvalData {
  publish: PublishMetadata;
}

const drivers: Record<AgentId, AgentDriver> = {
  claude: claudeAgent,
  codex: codexAgent,
};

/**
 * Run a full eval trial: prepare -> execute agent -> grade -> save.
 */
export async function runTrial(config: TrialConfig, logger?: Logger): Promise<RunTrialResult> {
  const { project, variant, prompt: promptName } = config;
  const { agent: agentName, model } = variant;
  const log = logger ?? createLogger();
  const resolvedPromptName = promptName || 'setup';
  const trialId = generateTrialId();
  const timestamp = new Date().toISOString();

  log.log(`Preparing ${project.name}...`);

  // 1. Prepare the trial
  const workspace = await prepareTrial(project, trialId, log);

  // 2. Capture environment
  const environment = await captureEnvironment();

  // 3. Load the prompt
  const prompt = loadPrompt(promptName);
  await writeFile(join(workspace.resultsDir, 'prompt.md'), prompt);

  // 4. Execute the agent
  log.log(`  Running ${agentName} (${model}, effort=${variant.effort})...`);
  const driver = drivers[agentName];
  const { execution, transcript } = await driver.execute({
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
  const screenshotRun = trialGrade.buildSuccess
    ? await runStorybookScreenshots({
        projectPath: workspace.projectPath,
        repoRoot: workspace.repoRoot,
        resultsDir: workspace.resultsDir,
        fileChanges: trialGrade.storybookChanges,
        logger: log,
      })
    : { screenshots: [], attempted: false, success: true };

  // 7. Assemble report content that will be committed with the trial branch
  const reportForCommit = buildEvalData({
    id: trialId,
    timestamp,
    project,
    variant,
    prompt: {
      name: resolvedPromptName,
      content: prompt,
    },
    baselineCommit: workspace.baselineCommit,
    environment,
    execution,
    grade: trialGrade,
    score,
    screenshots: screenshotRun.screenshots,
    transcript,
    artifacts: {
      buildOutput: {
        path: 'eval-results/build-output.txt',
        success: trialGrade.buildSuccess,
      },
      typecheckOutput: {
        path: 'eval-results/typecheck-output.txt',
        errorCount: trialGrade.typeCheckErrors,
      },
      screenshotOutput: screenshotRun.attempted
        ? {
            path: 'eval-results/screenshot-output.txt',
            attempted: screenshotRun.attempted,
            success: screenshotRun.success,
          }
        : undefined,
    },
  });

  await writeFile(
    join(workspace.resultsDir, 'data.json'),
    JSON.stringify(reportForCommit, null, 2)
  );

  // 8. Commit, push, and open the benchmark PR
  const publish = await publishTrialBranch({
    data: reportForCommit,
    workspace,
    logger: log,
  });

  log.logSuccess(`Results saved to ${workspace.resultsDir}`);

  return {
    ...reportForCommit,
    publish,
  };
}
