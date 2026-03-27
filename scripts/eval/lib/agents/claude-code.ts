import { writeFileSync } from 'node:fs';
import { join } from 'node:path';
import type { Agent, ExecutionResult, SupportedModel } from '../../types';
import { exec } from '../utils';

export const claudeCodeAgent: Agent = {
  name: 'claude-code',

  async execute(
    prompt: string,
    projectPath: string,
    model: SupportedModel,
    options?: { verbose?: boolean; resultsDir?: string }
  ): Promise<ExecutionResult> {
    const { verbose, resultsDir } = options ?? {};
    const startTime = Date.now();

    const args = [
      '--print',
      '--model',
      model,
      '--output-format',
      'stream-json',
      '--verbose',
      '--max-turns',
      '50',
      prompt,
    ];

    const result = await exec('claude', args, {
      cwd: projectPath,
      timeout: 600_000, // 10 minutes
      throwOnError: false,
      stdin: 'ignore',
      env: {
        ...process.env,
        CLAUDE_CODE_DISABLE_NONESSENTIAL_TRAFFIC: '1',
      },
    });

    const duration = (Date.now() - startTime) / 1000;

    // Save raw output for debugging
    if (resultsDir) {
      writeFileSync(join(resultsDir, 'agent-stdout.txt'), result.stdout);
      writeFileSync(join(resultsDir, 'agent-stderr.txt'), result.stderr);
    }

    // Parse stream-json output for metrics
    let cost: number | undefined;
    let turns = 0;
    let durationApi: number | undefined;

    const lines = result.stdout.split('\n').filter(Boolean);
    for (const line of lines) {
      try {
        const msg = JSON.parse(line);
        if (msg.type === 'result') {
          cost = msg.total_cost_usd;
          turns = msg.num_turns ?? 0;
          durationApi = msg.duration_api_ms ? msg.duration_api_ms / 1000 : undefined;
        }
      } catch {
        // Skip non-JSON lines
      }
    }

    if (verbose && result.stderr) {
      process.stderr.write(result.stderr);
    }

    return {
      agent: 'claude-code',
      model,
      cost,
      duration,
      durationApi,
      turns,
    };
  },
};
