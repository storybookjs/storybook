import { writeFileSync } from 'node:fs';
import { join } from 'node:path';
import type { Agent, ExecutionResult, SupportedModel } from '../../types';
import { exec } from '../utils';

export const copilotAgent: Agent = {
  name: 'copilot-cli',

  async execute(
    prompt: string,
    projectPath: string,
    model: SupportedModel,
    options?: { verbose?: boolean; resultsDir?: string }
  ): Promise<ExecutionResult> {
    const { verbose, resultsDir } = options ?? {};
    const startTime = Date.now();

    const args = ['--model', model, prompt];

    const result = await exec('copilot', args, {
      cwd: projectPath,
      timeout: 600_000,
      throwOnError: false,
      stdin: 'ignore',
    });

    const duration = (Date.now() - startTime) / 1000;

    if (resultsDir) {
      writeFileSync(join(resultsDir, 'agent-stdout.txt'), result.stdout);
      writeFileSync(join(resultsDir, 'agent-stderr.txt'), result.stderr);
    }

    // Count tool execution markers as a proxy for turns
    const toolMarkers = result.stdout.match(/[✓✗]/g) || [];
    const turns = toolMarkers.length;

    if (verbose) {
      if (result.stdout) process.stdout.write(result.stdout);
      if (result.stderr) process.stderr.write(result.stderr);
    }

    return {
      agent: 'copilot-cli',
      model,
      duration,
      turns,
    };
  },
};
