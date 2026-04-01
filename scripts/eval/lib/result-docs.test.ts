import { describe, expect, it } from 'vitest';

import { normalizeTranscriptForDocs } from './result-docs';

describe('normalizeTranscriptForDocs', () => {
  it('normalizes claude transcript entries into readable turns', () => {
    const normalized = normalizeTranscriptForDocs({
      prompt: 'Write stories',
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
              { type: 'tool_use', id: 'tool_1', name: 'Read', input: { path: 'src/Button.tsx' } },
            ],
            usage: { output_tokens: 42 },
          },
        },
      ],
    });

    expect(normalized.turns).toMatchObject([
      { type: 'prompt', title: 'Prompt' },
      { type: 'system', title: 'Session started', subtitle: 'claude-opus' },
      { type: 'assistant', title: 'Assistant', content: 'I will inspect the codebase.' },
      { type: 'tool', title: 'Read' },
    ]);
  });

  it('normalizes codex command entries into command turns', () => {
    const normalized = normalizeTranscriptForDocs({
      prompt: '',
      transcript: [
        {
          type: 'command_execution',
          command: 'npm test',
          exit_code: 1,
          aggregated_output: 'failing output',
        },
      ],
    });

    expect(normalized.turns).toEqual([
      {
        id: 'turn-0-command',
        type: 'command',
        title: 'npm test',
        subtitle: 'exit 1',
        content: 'failing output',
        language: 'bash',
        isError: true,
      },
    ]);
  });
});
