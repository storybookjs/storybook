import { writeFile } from 'node:fs/promises';
import { join } from 'pathe';
import type { Logger } from './utils.ts';
import type { AgentId, AgentDriver, AgentVariant } from './agents/config.ts';
import type { Project } from './projects.ts';
import { collectGhostStoriesGrade, grade } from './grade.ts';
import { claudeAgent } from './agents/claude-code.ts';
import { codexAgent } from './agents/codex.ts';
import { publishTrialBranch, type PublishMetadata } from './publish-trial.ts';
import { prepareTrial } from './prepare-trial.ts';
import { buildEvalData, type EvalData } from './result-docs.ts';
import {
  captureEnvironment,
  createLogger,
  generateTrialId,
  getEvalResultsRelativePath,
  loadPrompt,
} from './utils.ts';

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
  const trialId = generateTrialId();
  const timestamp = new Date().toISOString();

  log.log(`Preparing ${project.name}...`);

  // 1. Prepare the trial
  const workspace = await prepareTrial(project, trialId, log);

  // 2. Capture environment
  const environment = await captureEnvironment();

  // 3. Capture a baseline ghost-stories score before the agent changes the repo.
  const baselineGhostStories = await collectGhostStoriesGrade(
    workspace.projectPath,
    log,
    'baseline ghost stories'
  );

  // 4. Load the prompt
  const prompt = loadPrompt(promptName);
  await writeFile(join(workspace.resultsDir, 'prompt.md'), prompt);

  // 5. Execute the agent
  log.log(`  Running ${agentName} (${model}, effort=${variant.effort})...`);
  const driver = drivers[agentName];
  const { execution, transcript } = await driver.execute({
    prompt,
    projectPath: workspace.projectPath,
    variant,
    resultsDir: workspace.resultsDir,
    logger: log,
    verbose: config.verbose,
  });
  log.logSuccess(
    `Agent completed (${Math.round(execution.duration)}s, ${execution.cost ? `$${execution.cost.toFixed(2)}` : 'cost N/A'}, ${execution.turns} turns)`
  );

  const provisionalArtifacts = {
    buildOutput: {
      path: getEvalResultsRelativePath('build-output.txt', project.projectDir),
      success: false,
    },
    typecheckOutput: {
      path: getEvalResultsRelativePath('typecheck-output.txt', project.projectDir),
      errorCount: 0,
    },
  };

  // 6. Write provisional data so the baseline-owned MDX files can resolve it during grading.
  const provisionalData = buildEvalData({
    id: trialId,
    timestamp,
    project,
    variant,
    prompt: {
      name: promptName,
      content: prompt,
    },
    baselineCommit: workspace.baselineCommit,
    environment,
    execution,
    grade: {
      baselineGhostStories,
      buildSuccess: false,
      typeCheckErrors: 0,
      fileChanges: [],
      storybookChanges: [],
      hasCssCheckStory: false,
    },
    score: {
      score: 0,
      breakdown: {
        beforeRate: 0,
        afterRate: 0,
        gain: 0,
      },
    },
    transcript,
    artifacts: provisionalArtifacts,
  });

  await writeFile(
    join(workspace.resultsDir, 'data.json'),
    JSON.stringify(provisionalData, null, 2)
  );

  // 6. Grade the results using story-render preview gain as the score.
  const { grade: trialGrade, score } = await grade(workspace, log, baselineGhostStories);

  // 7. Rewrite the provisional data with the final grade.
  const reportForCommit = buildEvalData({
    ...provisionalData,
    grade: trialGrade,
    score,
    artifacts: {
      ...provisionalArtifacts,
      buildOutput: {
        ...provisionalArtifacts.buildOutput,
        success: trialGrade.buildSuccess,
      },
      typecheckOutput: {
        ...provisionalArtifacts.typecheckOutput,
        errorCount: trialGrade.typeCheckErrors,
      },
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
