import { Command } from 'commander';

import { BENCHMARKS, getBenchmarkById } from './benchmarks';
import { ALL_MODELS, ALL_TIERS } from './models';
import { getDefaultWorkspaceRoot, runEval } from './run';
import { PROMPT_VARIANTS } from './variants';

const program = new Command();

function formatDuration(durationMs?: number) {
  if (durationMs == null) {
    return '-';
  }

  if (durationMs < 1_000) {
    return `${durationMs}ms`;
  }

  if (durationMs < 60_000) {
    return `${Math.round(durationMs / 1_000)}s`;
  }

  const minutes = Math.floor(durationMs / 60_000);
  const seconds = Math.round((durationMs % 60_000) / 1_000);
  return `${minutes}m${seconds}s`;
}

function formatCost(costUsd?: number) {
  if (costUsd == null) {
    return '-';
  }

  return `$${costUsd.toFixed(2)}`;
}

function printSummary(results: Awaited<ReturnType<typeof runEval>>[]) {
  if (results.length === 0) {
    return;
  }

  console.log('\nSummary:');
  for (const result of results) {
    const buildStatus = result.grading.storybookBuild.status.toUpperCase();
    console.log(
      `- ${result.benchmark.id}: build=${buildStatus} cost=${formatCost(
        result.execution?.costUsd
      )} duration=${formatDuration(result.execution?.durationMs)}`
    );
  }
}

program.name('storybook-setup-eval');
program.description('Eval harness for post-init Storybook setup prompts against real React/Vite repositories.');

program
  .command('list')
  .description('List configured benchmarks, variants, and model tiers.')
  .action(() => {
    console.log('Benchmarks:');
    for (const benchmark of BENCHMARKS) {
      console.log(`- ${benchmark.id}: ${benchmark.name} (${benchmark.tags.join(', ')})`);
    }

    console.log('\nPrompt variants:');
    for (const variant of PROMPT_VARIANTS) {
      console.log(`- ${variant.id}: ${variant.description}`);
    }

    console.log('\nModel tiers:');
    for (const tier of ALL_TIERS) {
      console.log(`- ${tier}`);
    }

    console.log('\nExplicit models:');
    for (const model of ALL_MODELS) {
      console.log(`- ${model.id} (${model.agent}, ${model.tier})`);
    }
  });

program
  .command('run')
  .requiredOption('--agent <agent>', 'Agent to use: claude-code or codex-cli')
  .option('--benchmark <id>', 'Benchmark id to run. Omit to run all configured benchmarks.')
  .option('--variant <id>', 'Prompt variant id', 'baseline')
  .option('--tier <tier>', 'Tier to use when model is omitted', 'sonnet')
  .option('--model <model>', 'Explicit model override')
  .option('--prompt-file <path>', 'Append a custom prompt file after the selected variant prompt')
  .option('--iterations <count>', 'Run each selected benchmark this many times', '1')
  .option(
    '--workspace-root <path>',
    `Workspace for trial clones and artifacts. Defaults to ${getDefaultWorkspaceRoot()}`
  )
  .option('--prepare-only', 'Clone, clean, install, init, and checkpoint without running an agent')
  .description('Run one benchmark or all configured benchmarks.')
  .action(async (options) => {
    const iterations = Number.parseInt(options.iterations, 10);
    if (!Number.isFinite(iterations) || iterations < 1) {
      throw new Error(`Invalid iterations value "${options.iterations}".`);
    }

    const selectedBenchmarks = options.benchmark
      ? [getBenchmarkById(options.benchmark)]
      : BENCHMARKS;
    const totalRuns = selectedBenchmarks.length * iterations;
    const results: Awaited<ReturnType<typeof runEval>>[] = [];

    for (const benchmark of selectedBenchmarks) {
      for (let iteration = 1; iteration <= iterations; iteration += 1) {
        const label =
          iterations > 1
            ? `${benchmark.id} (${iteration}/${iterations})`
            : benchmark.id;
        console.log(`\nRunning ${label}...`);

        const result = await runEval({
          benchmarkId: benchmark.id,
          agent: options.agent,
          model: options.model,
          tier: options.tier,
          variantId: options.variant,
          workspaceRoot: options.workspaceRoot,
          prepareOnly: options.prepareOnly,
          promptFile: options.promptFile,
        });

        results.push(result);
        if (totalRuns === 1) {
          console.log(JSON.stringify(result, null, 2));
        } else {
          console.log(
            `Finished ${label}. Artifact: ${result.artifacts.resultPath}`
          );
        }
      }
    }

    if (results.length > 1) {
      printSummary(results);
    }
  });

program.parseAsync(process.argv).catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
});
