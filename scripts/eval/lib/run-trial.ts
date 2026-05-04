import { writeFile } from 'node:fs/promises';
import { join } from 'pathe';
import { x } from 'tinyexec';
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
  /** Prompt variant name — registered in `code/lib/cli-storybook/src/ai/prompts/` (e.g. "pattern-copy-play"). */
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

  // 4. Load the nudge prompt the agent will receive. The agent itself runs
  //    `npx storybook ai setup` as a tool call — mirroring what real users do
  //    when they copy the "Set up Storybook with AI" prompt from the UI.
  const prompt = loadPrompt(promptName);
  await writeFile(join(workspace.resultsDir, 'prompt.md'), prompt);

  // 5. Capture the full markdown the agent will receive from `ai setup` so
  //    the trial record contains a reproducible, project-aware snapshot of
  //    the instructions (not just the one-line nudge). Runs the same CLI the
  //    agent will run, in the same workspace, with the same env. Persisted as
  //    a separate file so the resulting PR diff shows the exact instructions
  //    the agent was given for this trial.
  const promptContent = await captureAiSetupMarkdown(workspace.projectPath, promptName, log);
  await writeFile(join(workspace.resultsDir, 'setup-prompt.md'), promptContent);

  // 6. Execute the agent. EVAL_SETUP_PROMPT is forwarded into the agent's
  //    environment so its `ai setup` tool call resolves to the selected
  //    prompt variant (unset for real users → always the default).
  log.log(`  Running ${agentName} (${model}, effort=${variant.effort})...`);
  const driver = drivers[agentName];
  const { execution, transcript } = await driver.execute({
    prompt,
    projectPath: workspace.projectPath,
    variant,
    resultsDir: workspace.resultsDir,
    logger: log,
    verbose: config.verbose,
    env: { EVAL_SETUP_PROMPT: promptName },
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

  // 7. Write provisional data so the baseline-owned MDX files can resolve it during grading.
  const provisionalData = buildEvalData({
    id: trialId,
    timestamp,
    project,
    variant,
    prompt: {
      name: promptName,
      content: promptContent,
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

  // 8. Grade the results using story-render preview gain as the score.
  const { grade: trialGrade, score } = await grade(workspace, log, baselineGhostStories);

  // 9. Rewrite the provisional data with the final grade.
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

  // 10. Commit, push, and open the benchmark PR
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

/**
 * Run `npx storybook ai setup` inside the prepared trial workspace and return
 * its stdout — the exact project-aware markdown the agent will receive from
 * the same CLI invocation. `EVAL_SETUP_PROMPT` selects the variant;
 * `STORYBOOK_DISABLE_TELEMETRY` keeps the harness's capture invocation out of
 * telemetry.
 *
 * Failures (spawn errors, timeouts, non-zero exit) are logged and swallowed:
 * capturing the prompt content is bookkeeping, not the thing being measured,
 * so it must never abort the trial.
 */
export async function captureAiSetupMarkdown(
  projectPath: string,
  promptName: string,
  log: Logger
): Promise<string> {
  try {
    const result = await x('npx', ['storybook', 'ai', 'setup'], {
      throwOnError: false,
      timeout: 60_000,
      nodeOptions: {
        cwd: projectPath,
        env: {
          ...process.env,
          EVAL_SETUP_PROMPT: promptName,
          STORYBOOK_DISABLE_TELEMETRY: '1',
        },
      },
    });

    if (result.exitCode !== 0) {
      log.logError(
        `Failed to capture ai setup markdown (exit ${result.exitCode}). Falling back to nudge-only record.`
      );
      log.logError(result.stderr.trim() || result.stdout.trim());
      return '';
    }

    return result.stdout.trim();
  } catch (error) {
    log.logError(
      `Failed to capture ai setup markdown (${error instanceof Error ? error.message : String(error)}). Falling back to nudge-only record.`
    );
    return '';
  }
}
