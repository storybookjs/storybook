import { describe, expect, it } from 'vitest';

import { parsePort, parseToolArgs } from './tool-args.ts';

function args(tokens: string[], defaults?: { json?: string }) {
  const result = parseToolArgs(tokens, defaults);
  if (!result.ok) {
    throw new Error(`expected ok, got error: ${result.error}`);
  }
  return result;
}

function error(tokens: string[], defaults?: { json?: string }) {
  const result = parseToolArgs(tokens, defaults);
  if (result.ok) {
    throw new Error(`expected error, got ok: ${JSON.stringify(result.args)}`);
  }
  return result.error;
}

describe('parseToolArgs', () => {
  it('returns empty args for no tokens', () => {
    expect(args([])).toEqual({
      ok: true,
      help: false,
      args: {},
    });
  });

  it('consumes --help and -h as a help request instead of forwarding them', () => {
    expect(args(['--help'])).toMatchObject({ help: true, args: {} });
    expect(args(['-h'])).toMatchObject({ help: true, args: {} });
    expect(args(['--id', 'x', '--help'])).toMatchObject({ help: true, args: { id: 'x' } });
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

  it('treats target-looking long flags after the command name as tool arguments', () => {
    expect(
      args(['--cwd', '/projects/foo', '--config-dir', 'config/storybook', '--port', '6006']).args
    ).toEqual({
      cwd: '/projects/foo',
      'config-dir': 'config/storybook',
      port: 6006,
    });
  });

  it('allows bare target-looking long flags as boolean tool arguments', () => {
    expect(args(['--cwd', '--port']).args).toEqual({ cwd: true, port: true });
  });

  it('rejects short flags after the command name', () => {
    expect(error(['-c', 'config/storybook'])).toContain('Unexpected argument `-c`');
  });

  describe('--json escape hatch', () => {
    it('uses the JSON object as the tool arguments', () => {
      expect(args(['--json', '{"id":"x","n":1}']).args).toEqual({ id: 'x', n: 1 });
    });

    it('lets explicit --key flags override --json entries', () => {
      expect(args(['--json', '{"id":"x","n":1}', '--id', 'y']).args).toEqual({ id: 'y', n: 1 });
    });

    it('accepts --json parsed by commander before the command name', () => {
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

  describe('relocated raw-object escape flag', () => {
    it('treats a bare `--json` as a normal boolean flag when the escape moves to `--input`', () => {
      const result = parseToolArgs(['--id', 'Button', '--json'], {}, { rawObjectFlag: 'input' });
      expect(result).toMatchObject({ ok: true, args: { id: 'Button', json: true } });
    });

    it('uses `--input` as the raw-object escape hatch', () => {
      const result = parseToolArgs(
        ['--input', '{"id":"Button","json":true}'],
        {},
        { rawObjectFlag: 'input' }
      );
      expect(result).toMatchObject({ ok: true, args: { id: 'Button', json: true } });
    });

    it('reports the relocated flag name in escape-hatch errors', () => {
      const result = parseToolArgs(['--input'], {}, { rawObjectFlag: 'input' });
      expect(result).toMatchObject({ ok: false });
      if (!result.ok) {
        expect(result.error).toContain('`--input` requires a value');
      }
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

describe('parsePort', () => {
  it('returns undefined when no port is provided', () => {
    expect(parsePort(undefined)).toEqual({ ok: true, port: undefined });
  });

  it('parses valid port values', () => {
    expect(parsePort('6006')).toEqual({ ok: true, port: 6006 });
  });

  it('rejects non-numeric or out-of-range ports', () => {
    expect(parsePort('abc')).toMatchObject({ ok: false });
    expect(parsePort('0')).toMatchObject({ ok: false });
    expect(parsePort('65536')).toMatchObject({ ok: false });
    expect(parsePort('6006.5')).toMatchObject({ ok: false });
  });
});
