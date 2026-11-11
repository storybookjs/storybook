import { describe, expect, it } from 'vitest';

import { buildClaudeCodeCliArgs } from '@vercel/agent-eval/dist/lib/agents/claude-code/run.mjs';

import { AGENT_CONFIG, agenticRefExperiment, providerOf } from './experiment.ts';

import type { RunCompleteContext } from '@vercel/agent-eval';

describe('Claude Code command line', () => {
  // The runner only forwards thinkingDisplay because of this repo's patch to @vercel/agent-eval.
  it('asks headless Claude Code for thinking summaries', () => {
    const args = buildClaudeCodeCliArgs({
      prompt: 'the prompt',
      agentOptions: AGENT_CONFIG['claude-code'].agentOptions,
    });

    expect(args.slice(-3)).toEqual(['--thinking-display', 'summarized', 'the prompt']);
  });
});

describe('providerOf', () => {
  it('reads a gateway-routed agent as the AI gateway', () => {
    expect(providerOf('vercel-ai-gateway/claude-code')).toBe('ai-gateway');
  });

  it('reads a bare claude-code agent as anthropic, i.e. direct', () => {
    expect(providerOf('claude-code')).toBe('anthropic');
  });

  // Codex runs direct against OpenAI; recording it as anthropic would be wrong.
  it('reads a codex agent as openai, i.e. direct', () => {
    expect(providerOf('codex')).toBe('openai');
  });
});

describe('run output provider', () => {
  // The provider cannot be read back out of a transcript, so the hook must
  // record it at collection time from the eval config that ran.
  it('records the eval config LLM provider in the run result', async () => {
    const experiment = agenticRefExperiment({ name: 'provider-probe', evals: [] });
    const context = {
      runData: { result: {} },
      fixture: { path: '/nowhere' },
    } as unknown as RunCompleteContext;

    const runData = (await experiment.onRunComplete?.(context)) as {
      result: { analysis: { provider?: string } };
    };

    expect(runData.result.analysis.provider).toBe('anthropic');
  });
});
