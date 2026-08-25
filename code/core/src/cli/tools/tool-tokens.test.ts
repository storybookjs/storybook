import { describe, expect, it } from 'vitest';

import { parseToolsTokens, printsJsonToStdout, type ToolsOutputFlags } from './tool-tokens.ts';

describe('parseToolsTokens', () => {
  it('parses --key value pairs with JSON coercion', () => {
    const result = parseToolsTokens(['--maxDistance', '2', '--name', 'button']);

    expect(result).toEqual({
      ok: true,
      help: false,
      json: false,
      output: undefined,
      args: { maxDistance: 2, name: 'button' },
    });
  });

  it('parses --key=value and bare flags as true', () => {
    const result = parseToolsTokens(['--id=button-docs', '--withStoryIds']);

    expect(result).toMatchObject({ ok: true, args: { id: 'button-docs', withStoryIds: true } });
  });

  it('parses JSON values for arrays and objects', () => {
    const result = parseToolsTokens(['--stories', '[{"storyId":"button--primary"}]']);

    expect(result).toMatchObject({ ok: true, args: { stories: [{ storyId: 'button--primary' }] } });
  });

  it('merges --input with flags, flags winning', () => {
    const result = parseToolsTokens(['--input', '{"a":1,"b":1}', '--b', '2']);

    expect(result).toMatchObject({ ok: true, args: { a: 1, b: 2 } });
  });

  it('accepts the commander-side flag values as defaults, overridden by tokens', () => {
    const result = parseToolsTokens(['--output', 'later.md'], {
      input: '{"a":1}',
      json: true,
      output: 'early.md',
    });

    expect(result).toMatchObject({ ok: true, json: true, output: 'later.md', args: { a: 1 } });
  });

  it('treats --json and --help as bare CLI flags, never tool arguments', () => {
    const result = parseToolsTokens(['--json', '--help']);

    expect(result).toMatchObject({ ok: true, json: true, help: true, args: {} });
  });

  it('consumes -o and --output with a path', () => {
    expect(parseToolsTokens(['-o', 'out.md'])).toMatchObject({ ok: true, output: 'out.md' });
    expect(parseToolsTokens(['--output=out.md'])).toMatchObject({ ok: true, output: 'out.md' });
    expect(parseToolsTokens(['-o'])).toMatchObject({ ok: false });
    expect(parseToolsTokens(['--output='])).toMatchObject({ ok: false });
  });

  it('rejects bare positional tokens', () => {
    const result = parseToolsTokens(['button']);

    expect(result).toMatchObject({ ok: false });
    expect(result.ok === false && result.error).toContain('`button`');
  });

  it('rejects invalid --input JSON and non-object --input values', () => {
    expect(parseToolsTokens(['--input', '{nope'])).toMatchObject({ ok: false });
    expect(parseToolsTokens(['--input', '[1]'])).toMatchObject({ ok: false });
    expect(parseToolsTokens(['--input'])).toMatchObject({ ok: false });
  });

  it('rejects values on the bare flags', () => {
    expect(parseToolsTokens(['--json=data'])).toMatchObject({ ok: false });
    expect(parseToolsTokens(['--help=me'])).toMatchObject({ ok: false });
  });
});

describe('printsJsonToStdout', () => {
  /** A complete command path, which is what `--json` turns into a JSON document. */
  const invocation = (tokens: string[], flags?: ToolsOutputFlags) => ({
    toolset: 'docs',
    tool: 'show',
    tokens,
    flags,
  });

  it('is true when --json is given on either side of the tool name', () => {
    expect(printsJsonToStdout(invocation(['--json']))).toBe(true);
    expect(printsJsonToStdout(invocation([], { json: true }))).toBe(true);
  });

  it('is false without --json', () => {
    expect(printsJsonToStdout(invocation(['--id', 'button-docs']))).toBe(false);
  });

  it('is false when the document goes to a file instead of stdout', () => {
    expect(printsJsonToStdout(invocation(['--json', '-o', 'out.json']))).toBe(false);
    expect(printsJsonToStdout(invocation(['--json'], { output: 'out.json' }))).toBe(false);
  });

  it('is false for help, which renders markdown even under --json', () => {
    expect(printsJsonToStdout(invocation(['--json', '--help']))).toBe(false);
  });

  it('is false when the tokens do not parse, since no JSON is produced', () => {
    expect(printsJsonToStdout(invocation(['--json', 'button']))).toBe(false);
  });

  it('is false for an incomplete command path, which lists what is available as markdown', () => {
    expect(printsJsonToStdout({ tokens: [], flags: { json: true } })).toBe(false);
    expect(printsJsonToStdout({ toolset: 'docs', tokens: ['--json'] })).toBe(false);
  });
});
