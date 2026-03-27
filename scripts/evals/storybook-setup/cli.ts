import { Command } from 'commander';

import { BENCHMARKS } from './benchmarks';
import { ALL_MODELS, ALL_TIERS } from './models';
import { getDefaultWorkspaceRoot, runEval } from './run';
import { PROMPT_VARIANTS } from './variants';

const program = new Command();

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
  .requiredOption('--benchmark <id>', 'Benchmark id to run')
  .requiredOption('--agent <agent>', 'Agent to use: claude-code or codex-cli')
  .option('--variant <id>', 'Prompt variant id', 'baseline')
  .option('--tier <tier>', 'Tier to use when model is omitted', 'sonnet')
  .option('--model <model>', 'Explicit model override')
  .option(
    '--workspace-root <path>',
    `Workspace for trial clones and artifacts. Defaults to ${getDefaultWorkspaceRoot()}`
  )
  .option('--prepare-only', 'Clone, clean, install, init, and checkpoint without running an agent')
  .description('Run a single benchmark trial.')
  .action(async (options) => {
    const result = await runEval({
      benchmarkId: options.benchmark,
      agent: options.agent,
      model: options.model,
      tier: options.tier,
      variantId: options.variant,
      workspaceRoot: options.workspaceRoot,
      prepareOnly: options.prepareOnly,
    });

    console.log(JSON.stringify(result, null, 2));
  });

program.parseAsync(process.argv).catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
});
