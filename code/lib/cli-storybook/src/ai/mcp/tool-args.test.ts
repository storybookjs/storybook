import { describe, expect, it } from 'vitest';

import { parseToolArgs } from './tool-args.ts';

function args(tokens: string[], defaults?: { cwd?: string; json?: string }) {
  const result = parseToolArgs(tokens, defaults);
  if (!result.ok) {
    throw new Error(`expected ok, got error: ${result.error}`);
  }
  return result;
}

function error(tokens: string[], defaults?: { cwd?: string; json?: string }) {
  const result = parseToolArgs(tokens, defaults);
  if (result.ok) {
    throw new Error(`expected error, got ok: ${JSON.stringify(result.args)}`);
  }
  return result.error;
}

describe('parseToolArgs', () => {
  it('returns empty args for no tokens', () => {
    expect(args([])).toEqual({ ok: true, cwd: undefined, args: {} });
  });

  it('maps `--key value` pairs to tool arguments', () => {
    expect(args(['--id', 'button-docs']).args).toEqual({ id: 'button-docs' });
  });

  it('supports `--key=value`', () => {
    expect(args(['--id=button-docs']).args).toEqual({ id: 'button-docs' });
  });

  describe('JSON-parse coercion', () => {
    it('coerces booleans, numbers and null', () => {
      expect(args(['--a', 'true', '--b', '42', '--c', 'null']).args).toEqual({
        a: true,
        b: 42,
        c: null,
      });
    });

    it('coerces JSON arrays and objects', () => {
      expect(args(['--ids', '["a","b"]', '--filter', '{"tag":"x"}']).args).toEqual({
        ids: ['a', 'b'],
        filter: { tag: 'x' },
      });
    });

    it('falls back to the raw string when the value is not valid JSON', () => {
      expect(args(['--id', 'button-docs', '--path', 'src/Button.tsx']).args).toEqual({
        id: 'button-docs',
        path: 'src/Button.tsx',
      });
    });

    it('unquotes explicitly quoted JSON strings', () => {
      expect(args(['--id', '"true"']).args).toEqual({ id: 'true' });
    });

    it('accepts negative numbers as values', () => {
      expect(args(['--offset', '-1']).args).toEqual({ offset: -1 });
    });
  });

  it('treats a bare `--flag` as true', () => {
    expect(args(['--withStoryIds']).args).toEqual({ withStoryIds: true });
    expect(args(['--withStoryIds', '--id', 'x']).args).toEqual({ withStoryIds: true, id: 'x' });
  });

  it('lets the last occurrence of a repeated key win', () => {
    expect(args(['--id', 'a', '--id', 'b']).args).toEqual({ id: 'b' });
  });

  describe('--cwd', () => {
    it('consumes --cwd instead of forwarding it', () => {
      expect(args(['--cwd', '/projects/foo', '--id', 'x'])).toEqual({
        ok: true,
        cwd: '/projects/foo',
        args: { id: 'x' },
      });
    });

    it('uses the commander-parsed default when not repeated in the tokens', () => {
      expect(args(['--id', 'x'], { cwd: '/projects/foo' }).cwd).toBe('/projects/foo');
    });

    it('prefers a --cwd token over the commander-parsed default', () => {
      expect(args(['--cwd', '/b'], { cwd: '/a' }).cwd).toBe('/b');
    });

    it('errors when --cwd has no value', () => {
      expect(error(['--cwd'])).toContain('`--cwd` requires a value');
    });
  });

  describe('--json escape hatch', () => {
    it('uses the JSON object as the tool arguments', () => {
      expect(args(['--json', '{"id":"x","n":1}']).args).toEqual({ id: 'x', n: 1 });
    });

    it('lets explicit --key flags override --json entries', () => {
      expect(args(['--json', '{"id":"x","n":1}', '--id', 'y']).args).toEqual({ id: 'y', n: 1 });
    });

    it('accepts --json parsed by commander before the tool name', () => {
      expect(args(['--id', 'y'], { json: '{"id":"x","n":1}' }).args).toEqual({ id: 'y', n: 1 });
    });

    it('errors on invalid JSON', () => {
      expect(error(['--json', '{nope'])).toContain('`--json` must be valid JSON');
    });

    it('errors when the JSON is not an object', () => {
      expect(error(['--json', '[1,2]'])).toContain('must be a JSON object');
      expect(error(['--json', '"text"'])).toContain('must be a JSON object');
      expect(error(['--json', 'null'])).toContain('must be a JSON object');
    });

    it('errors when --json has no value', () => {
      expect(error(['--json'])).toContain('`--json` requires a value');
    });
  });

  it('errors on positional tokens', () => {
    expect(error(['positional'])).toContain('Unexpected argument `positional`');
  });

  it('errors on a bare `--` separator', () => {
    expect(error(['--'])).toContain('Unexpected argument `--`');
  });

  it('errors on `--=value`', () => {
    expect(error(['--=x'])).toContain('Invalid flag');
  });
});
