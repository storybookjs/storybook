import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';

import { afterEach, describe, expect, it } from 'vitest';

import { normalizeTranscriptForDocs, writeEvalResultDocs } from './result-docs';

let TMP = '';

afterEach(() => {
  if (TMP) {
    rmSync(TMP, { recursive: true, force: true });
    TMP = '';
  }
});

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
              { type: 'tool_use', id: 'tool_1', name: 'Read', input: { path: 'src/Button.tsx' } },
            ],
            usage: { output_tokens: 42 },
          },
        },
        {
          type: 'user',
          message: {
            content: [{ type: 'tool_result', tool_use_id: 'tool_1', content: 'file contents' }],
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
          content: [{ type: 'tool_result', tool_use_id: 'tool_1', content: 'file contents' }],
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
});

describe('writeEvalResultDocs', () => {
  it('writes the transcript view as a direct template copy', async () => {
    TMP = mkdtempSync(join(tmpdir(), 'eval-result-docs-'));

    writeFileSync(join(TMP, 'prompt.md'), 'Write a story');
    writeFileSync(join(TMP, 'transcript.json'), '[]');
    writeFileSync(
      join(TMP, 'summary.json'),
      JSON.stringify({
        project: { name: 'demo' },
        prompt: 'setup',
        variant: { agent: 'codex', model: 'gpt-5.4', effort: 'high' },
        score: { score: 1 },
        grade: { buildSuccess: true, typeCheckErrors: 0, fileChanges: [] },
        publish: { screenshots: [] },
      })
    );

    await writeEvalResultDocs(TMP);

    expect(readFileSync(join(TMP, 'transcript.tsx'), 'utf-8')).toBe(
      readFileSync(new URL('./result-doc-templates/transcript.tsx.txt', import.meta.url), 'utf-8')
    );
    expect(readFileSync(join(TMP, 'transcript.types.ts'), 'utf-8')).toBe(
      readFileSync(
        new URL('./result-doc-templates/transcript.types.ts.txt', import.meta.url),
        'utf-8'
      )
    );
    expect(readFileSync(join(TMP, 'transcript.mdx'), 'utf-8')).toContain(
      "import { Transcript } from './transcript';"
    );
    expect(readFileSync(join(TMP, 'transcript-data.json'), 'utf-8')).toContain('"prompt": "Write a story"');
  });
});
