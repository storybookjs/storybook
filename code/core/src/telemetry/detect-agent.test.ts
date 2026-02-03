import { describe, expect, it } from 'vitest';

import { detectAgent } from './detect-agent';

describe('detectAgent', () => {
  it('detects amp via AGENT=amp (highest precedence)', () => {
    expect(
      detectAgent({
        stdoutIsTTY: true,
        env: {
          AGENT: 'amp',
          CLAUDECODE: '1',
          GEMINI_CLI: '1',
          CODEX_SANDBOX: '1',
          CURSOR_AGENT: '1',
        },
      })
    ).toEqual({ name: 'amp' });

    expect(
      detectAgent({
        stdoutIsTTY: true,
        env: {
          CLAUDECODE: '1',
          GEMINI_CLI: '1',
          CODEX_SANDBOX: '1',
          CURSOR_AGENT: '1',
          AGENT: 'something',
        },
      })
    ).toEqual({ name: 'claude-code' });
  });

  it('detects Gemini CLI via GEMINI_CLI', () => {
    expect(detectAgent({ stdoutIsTTY: true, env: { GEMINI_CLI: '1' } })).toEqual({
      name: 'gemini-cli',
    });
  });

  it('detects OpenAI Codex via CODEX_SANDBOX', () => {
    expect(detectAgent({ stdoutIsTTY: true, env: { CODEX_SANDBOX: '1' } })).toEqual({
      name: 'codex',
    });
  });

  it('detects Cursor Agent via CURSOR_AGENT (even if AGENT is also set)', () => {
    expect(
      detectAgent({ stdoutIsTTY: true, env: { CURSOR_AGENT: '1', AGENT: 'something' } })
    ).toEqual({
      name: 'cursor',
    });
  });

  it('treats generic AGENT as unknown', () => {
    expect(detectAgent({ stdoutIsTTY: true, env: { AGENT: 'some-agent' } })).toEqual({
      name: 'unknown',
    });
  });

  it('does not use heuristics when stdout is a TTY', () => {
    expect(detectAgent({ stdoutIsTTY: true, env: { TERM: 'dumb' } })).toEqual(undefined);
    expect(detectAgent({ stdoutIsTTY: true, env: { GIT_PAGER: 'cat' } })).toEqual(undefined);
  });

  it('detects unknown agent via TERM=dumb when stdout is not a TTY', () => {
    expect(detectAgent({ stdoutIsTTY: false, env: { TERM: 'dumb' } })).toEqual({
      name: 'unknown',
    });
  });

  it('detects unknown agent via GIT_PAGER=cat when stdout is not a TTY', () => {
    expect(detectAgent({ stdoutIsTTY: false, env: { GIT_PAGER: 'cat' } })).toEqual({
      name: 'unknown',
    });
  });

  it('returns isAgent=false when there are no signals', () => {
    expect(detectAgent({ stdoutIsTTY: false, env: {} })).toEqual(undefined);
  });

  it('applies heuristics even when CI is set (no CI special-casing)', () => {
    expect(
      detectAgent({
        stdoutIsTTY: false,
        env: { CI: 'true', TERM: 'dumb' },
      })
    ).toEqual({ name: 'unknown' });
  });

  it('still detects explicit agents in CI', () => {
    expect(detectAgent({ stdoutIsTTY: false, env: { CI: 'true', CODEX_SANDBOX: '1' } })).toEqual({
      name: 'codex',
    });
  });
});
