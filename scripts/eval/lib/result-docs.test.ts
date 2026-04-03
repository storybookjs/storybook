import { describe, expect, it } from 'vitest';

import { buildEvalData, normalizeTranscriptForDocs } from './result-docs';

describe('normalizeTranscriptForDocs', () => {
  it('normalizes claude transcript entries into MCP transcript props', () => {
    const normalized = normalizeTranscriptForDocs({
      prompt: 'Write stories',
      summary: {
        execution: { turns: 2, duration: 12, durationApi: 8, cost: 0.42 },
      },
      transcript: [
        {
          type: 'system',
          subtype: 'init',
          agent: 'Claude Code',
          model: 'claude-opus',
          tools: ['Read', 'Write'],
          cwd: '/repo',
        },
        {
          type: 'assistant',
          message: {
            content: [
              { type: 'text', text: 'I will inspect the codebase.' },
              {
                type: 'tool_use',
                id: 'tool_1',
                name: 'Read',
                input: { path: 'src/Button.tsx' },
              },
            ],
            usage: { output_tokens: 42 },
          },
        },
        {
          type: 'user',
          message: {
            content: [
              {
                type: 'tool_result',
                tool_use_id: 'tool_1',
                content: 'file contents',
              },
            ],
          },
        },
        {
          type: 'result',
          subtype: 'success',
          num_turns: 2,
          total_cost_usd: 0.42,
          duration_ms: 12000,
          duration_api_ms: 8000,
        },
      ],
    });

    expect(normalized.prompt).toBe('Write stories');
    expect(normalized.messages).toMatchObject([
      {
        type: 'system',
        subtype: 'init',
        agent: 'Claude Code',
        model: 'claude-opus',
        tools: ['Read', 'Write'],
        cwd: '/repo',
      },
      {
        type: 'assistant',
        message: {
          content: [
            { type: 'text', text: 'I will inspect the codebase.' },
            {
              type: 'tool_use',
              id: 'tool_1',
              name: 'Read',
              input: { path: 'src/Button.tsx' },
              isMCP: false,
            },
          ],
        },
        tokenCount: 42,
      },
      {
        type: 'user',
        message: {
          content: [
            {
              type: 'tool_result',
              tool_use_id: 'tool_1',
              content: 'file contents',
            },
          ],
        },
      },
      {
        type: 'result',
        subtype: 'success',
        num_turns: 2,
        total_cost_usd: 0.42,
        duration_ms: 12000,
        duration_api_ms: 8000,
      },
    ]);
  });

  it('normalizes codex command entries into a copied transcript-compatible tool call/result pair', () => {
    const normalized = normalizeTranscriptForDocs({
      prompt: 'Build a story',
      summary: {
        variant: { agent: 'codex', model: 'gpt-5.4' },
        execution: { turns: 3, duration: 9, cost: 0.1 },
      },
      transcript: [
        {
          type: 'command_execution',
          command: 'npm test',
          exit_code: 1,
          aggregated_output: 'failing output',
        },
      ],
    });

    expect(normalized.messages).toMatchObject([
      {
        type: 'system',
        subtype: 'init',
        agent: 'Codex',
        model: 'gpt-5.4',
      },
      {
        type: 'assistant',
        message: {
          content: [
            {
              type: 'tool_use',
              name: 'Bash',
              input: { command: 'npm test' },
              isMCP: false,
            },
          ],
        },
      },
      {
        type: 'user',
        message: {
          content: [
            {
              type: 'tool_result',
              content: 'Exit code: 1\n\nfailing output',
            },
          ],
        },
      },
      {
        type: 'result',
        subtype: 'success',
        num_turns: 3,
      },
    ]);
  });

  it('maps Claude terminal subtypes other than success to error in transcript props', () => {
    const normalized = normalizeTranscriptForDocs({
      prompt: 'Write stories',
      summary: {
        execution: {
          turns: 51,
          duration: 12,
          durationApi: 8,
          cost: 0.42,
          terminalResultSubtype: 'error_max_turns',
        },
      },
      transcript: [
        {
          type: 'result',
          subtype: 'error_max_turns',
          num_turns: 51,
          total_cost_usd: 0.42,
          duration_ms: 12000,
          duration_api_ms: 8000,
        },
      ],
    });

    expect(normalized.messages).toMatchObject([
      {
        type: 'result',
        subtype: 'error',
        num_turns: 51,
        total_cost_usd: 0.42,
      },
    ]);
  });

  it('treats missing Claude tool result content as empty text', () => {
    const normalized = normalizeTranscriptForDocs({
      prompt: 'Write stories',
      transcript: [
        {
          type: 'user',
          message: {
            content: [
              {
                type: 'tool_result',
                tool_use_id: 'tool_1',
              },
            ],
          },
        },
      ],
    });

    expect(normalized.messages).toHaveLength(1);
    expect(normalized.messages[0]).toMatchObject({
      type: 'user',
      message: {
        content: [
          {
            type: 'tool_result',
            tool_use_id: 'tool_1',
            content: '',
          },
        ],
      },
    });
  });

  it('builds a single persisted eval data object', () => {
    const data = buildEvalData({
      id: '20260402T041205123Z-deadbeef',
      timestamp: '2026-04-02T04:12:05.123Z',
      project: {
        name: 'mealdrop',
        repo: 'https://github.com/storybook-tmp/mealdrop',
        branch: 'main',
        githubSlug: 'storybook-tmp/mealdrop',
      },
      variant: {
        agent: 'codex',
        model: 'gpt-5.4',
        effort: 'medium',
      },
      prompt: {
        name: 'setup',
        content: 'Write stories',
      },
      baselineCommit: 'deadbeef',
      environment: {
        nodeVersion: 'v22.21.1',
        evalBranch: 'branch',
        evalCommit: 'commit',
      },
      execution: {
        duration: 12,
        turns: 2,
      },
      grade: {
        buildSuccess: true,
        typeCheckErrors: 0,
        fileChanges: [],
        storybookChanges: [],
      },
      score: {
        score: 1,
        breakdown: { beforeRate: 0, afterRate: 1, gain: 1 },
      },
      screenshots: [],
      transcript: [],
      artifacts: {
        buildOutput: { path: '.storybook/eval-results/build-output.txt', success: true },
        typecheckOutput: {
          path: '.storybook/eval-results/typecheck-output.txt',
          errorCount: 0,
        },
      },
    });

    expect(data).toMatchObject({
      schemaVersion: 3,
      id: '20260402T041205123Z-deadbeef',
      prompt: {
        name: 'setup',
        content: 'Write stories',
      },
      artifacts: {
        buildOutput: { path: '.storybook/eval-results/build-output.txt', success: true },
        typecheckOutput: {
          path: '.storybook/eval-results/typecheck-output.txt',
          errorCount: 0,
        },
      },
      docs: {
        transcript: {
          prompt: 'Write stories',
          messages: [
            expect.objectContaining({
              type: 'system',
              subtype: 'init',
            }),
            expect.objectContaining({
              type: 'result',
              subtype: 'success',
            }),
          ],
        },
      },
    });
  });
});
