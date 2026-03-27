import { randomUUID } from 'node:crypto';
import { Command } from 'commander';
import pc from 'picocolors';
import type { TrialConfig, TrialResult, AgentName, SupportedModel, Effort } from './types.ts';
import { MODELS_BY_AGENT, EFFORTS } from './types.ts';
import { PROJECTS, DEFAULT_AGENT, DEFAULT_MODEL } from './config.ts';
import { runTask } from './lib/run-task.ts';
import { listPrompts } from './lib/generate-prompt.ts';
import { log, formatDuration, formatCost } from './lib/utils.ts';

const program = new Command()
  .name('eval')
  .description('Evaluate AI agents on Storybook setup tasks')
  .option('-p, --project <name>', 'run only this project (by name)')
  .option('-a, --agent <name>', 'agent to use', DEFAULT_AGENT)
  .option('-m, --model <name>', 'model to use', DEFAULT_MODEL)
  .option('-e, --effort <level>', 'effort level: low, medium, high, max', 'high')
  .option('--prompt <names...>', 'prompt names to compose (from prompts/ dir)', ['setup'])
  .option('-n, --iterations <n>', 'number of iterations per project', '1')
  .option('-v, --verbose', 'verbose output')
  .option('-u, --upload-id <id>', 'upload ID for grouping results in Google Sheets')
  .option('--list-projects', 'list available projects and exit')
  .option('--list-models', 'list supported models and exit')
  .option('--list-prompts', 'list available prompts and exit');

program.parse();

const opts = program.opts();

// --- List commands ---

if (opts.listProjects) {
  log('Available projects:');
  for (const p of PROJECTS) {
    log(`  ${pc.bold(p.name)} - ${p.description || p.repo}`);
  }
  process.exit(0);
}

if (opts.listPrompts) {
  log('Available prompts (compose with --prompt name1 name2):');
  for (const name of listPrompts()) {
    log(`  ${pc.bold(name)}`);
  }
  process.exit(0);
}

if (opts.listModels) {
  log('Models by agent:');
  for (const [agent, models] of Object.entries(MODELS_BY_AGENT)) {
    log(`\n  ${pc.bold(agent)}:`);
    for (const m of models) log(`    - ${m}`);
  }
  log(`\n  Effort levels: ${EFFORTS.join(', ')}`);
  process.exit(0);
}

// --- Validate inputs ---

const agentName = opts.agent as AgentName;
const model = opts.model as SupportedModel;
const effort = opts.effort as Effort;
const iterations = parseInt(opts.iterations as string, 10);

const supportedModels = MODELS_BY_AGENT[agentName];
if (!supportedModels) {
  log(pc.red(`Unknown agent: ${agentName}. Use --list-models to see available agents.`));
  process.exit(1);
}
if (!supportedModels.includes(model)) {
  log(pc.red(`Model ${model} is not supported by agent ${agentName}. Use --list-models to see options.`));
  process.exit(1);
}
if (!EFFORTS.includes(effort)) {
  log(pc.red(`Unknown effort: ${effort}. Options: ${EFFORTS.join(', ')}`));
  process.exit(1);
}

// Filter projects
const projects = opts.project
  ? PROJECTS.filter((p) => p.name === opts.project)
  : PROJECTS;

if (projects.length === 0) {
  log(pc.red(`Project not found: ${opts.project}. Use --list-projects to see available projects.`));
  process.exit(1);
}

// --- Run evals ---

const runId = randomUUID().slice(0, 8);
const uploadId = (opts.uploadId as string) || `eval-${runId}`;

log(pc.bold('\nStorybook Setup Eval'));
log(`Agent: ${pc.cyan(agentName)} | Model: ${pc.cyan(model)} | Effort: ${pc.cyan(effort)} | Iterations: ${iterations}`);
log(`Projects: ${projects.map((p) => p.name).join(', ')}`);
log(`Run: ${runId} | Upload: ${uploadId}`);

const allResults: TrialResult[] = [];

for (const project of projects) {
  for (let i = 0; i < iterations; i++) {
    const suffix = iterations > 1 ? ` (iteration ${i + 1}/${iterations})` : '';
    log(pc.bold(`\n${'='.repeat(60)}`));
    log(pc.bold(`${project.name}${suffix}`));
    log(`${project.description || ''}`);
    log(pc.bold('='.repeat(60)));

    const config: TrialConfig = {
      project,
      agent: agentName,
      model,
      effort,
      prompts: opts.prompt as string[],
      verbose: opts.verbose as boolean | undefined,
    };

    try {
      const result = await runTask(config, runId, uploadId);
      allResults.push(result);
    } catch (error) {
      log(pc.red(`\nFailed to evaluate ${project.name}: ${error instanceof Error ? error.message : error}`));
      if (opts.verbose && error instanceof Error) {
        log(error.stack || '');
      }
    }
  }
}

// --- Print summary table ---

if (allResults.length > 0) {
  log(pc.bold('\n\nResults Summary'));
  log('='.repeat(120));

  // Header
  const header = [
    'Project'.padEnd(15),
    'Build'.padEnd(7),
    'TS Err'.padEnd(8),
    'Ghost'.padEnd(12),
    'Patterns'.padEnd(10),
    'Quality'.padEnd(9),
    'Cost'.padEnd(8),
    'Time'.padEnd(8),
    'Turns'.padEnd(7),
  ].join(' | ');
  log(header);
  log('-'.repeat(120));

  // Rows
  for (const r of allResults) {
    const buildStr = r.grading.buildSuccess ? 'PASS' : 'FAIL';
    const buildColored = r.grading.buildSuccess ? pc.green(buildStr) : pc.red(buildStr);
    const ghost = r.grading.ghostStories;
    const ghostStr = ghost ? `${ghost.passed}/${ghost.total}` : '-';
    const patternsStr = String(r.grading.setupPatterns.length);
    const row = [
      r.project.padEnd(15),
      buildStr.padEnd(7).replace(buildStr, buildColored),
      String(r.grading.typeCheckErrors).padEnd(8),
      ghostStr.padEnd(12),
      patternsStr.padEnd(10),
      String(r.quality.score).padEnd(9),
      formatCost(r.execution.cost).padEnd(8),
      formatDuration(r.execution.duration).padEnd(8),
      String(r.execution.turns).padEnd(7),
    ].join(' | ');
    log(row);
  }

  log('-'.repeat(120));

  // Aggregate
  const avgQuality =
    allResults.reduce((sum, r) => sum + r.quality.score, 0) / allResults.length;
  const totalCost = allResults.reduce((sum, r) => sum + (r.execution.cost || 0), 0);
  const passRate =
    allResults.filter((r) => r.grading.buildSuccess).length / allResults.length;

  log(`\nBuild pass rate: ${pc.bold(`${Math.round(passRate * 100)}%`)}`);
  log(`Average quality: ${pc.bold(avgQuality.toFixed(2))}`);
  log(`Total cost: ${pc.bold(formatCost(totalCost))}`);
}

log('\nDone.');
