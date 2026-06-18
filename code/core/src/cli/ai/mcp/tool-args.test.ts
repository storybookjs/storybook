import { describe, expect, it } from 'vitest';

import { parsePort, parseToolArgs, scanConfigDirToken, scanCwdToken } from './tool-args.ts';

function args(
  tokens: string[],
  defaults?: {
    cwd?: string;
    configDir?: string;
    port?: string;
    json?: string;
  }
) {
  const result = parseToolArgs(tokens, defaults);
  if (!result.ok) {
    throw new Error(`expected ok, got error: ${result.error}`);
  }
  return result;
}

function error(
  tokens: string[],
  defaults?: {
    cwd?: string;
    configDir?: string;
    port?: string;
    json?: string;
  }
) {
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
      cwd: undefined,
      configDir: undefined,
      port: undefined,
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

  describe('--cwd', () => {
    it('consumes --cwd instead of forwarding it', () => {
      expect(args(['--cwd', '/projects/foo', '--id', 'x'])).toEqual({
        ok: true,
        cwd: '/projects/foo',
        configDir: undefined,
        port: undefined,
        help: false,
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

  describe('--config-dir', () => {
    it.each(['--config-dir', '-c'])('consumes %s instead of forwarding it', (flag) => {
      expect(args([flag, 'config/storybook', '--id', 'x'])).toEqual({
        ok: true,
        cwd: undefined,
        configDir: 'config/storybook',
        port: undefined,
        help: false,
        args: { id: 'x' },
      });
    });

    it('uses the commander-parsed default and lets a token override it', () => {
      expect(args(['--id', 'x'], { configDir: 'config/a' }).configDir).toBe('config/a');
      expect(args(['--config-dir', 'config/b'], { configDir: 'config/a' }).configDir).toBe(
        'config/b'
      );
    });

    it.each(['--config-dir', '-c'])('errors when %s has no value', (flag) => {
      expect(error([flag])).toContain('`-c, --config-dir` requires a value');
    });

    it('treats a single-dash value after -c as the config dir', () => {
      expect(args(['-c', '-storybook', '--id', 'x'])).toMatchObject({
        ok: true,
        configDir: '-storybook',
        args: { id: 'x' },
      });
      expect(error(['-c', '--port', '6006'])).toContain('`-c, --config-dir` requires a value');
    });
  });

  describe('--port', () => {
    it('consumes --port as a raw value instead of forwarding it', () => {
      expect(args(['--port', '6006', '--id', 'x'])).toEqual({
        ok: true,
        cwd: undefined,
        configDir: undefined,
        port: '6006',
        help: false,
        args: { id: 'x' },
      });
    });

    it('uses the commander-parsed default and lets a token override it', () => {
      expect(args(['--id', 'x'], { port: '6006' }).port).toBe('6006');
      expect(args(['--port', '6007'], { port: '6006' }).port).toBe('6007');
    });

    it('errors when --port has no value', () => {
      expect(error(['--port'])).toContain('`--port` requires a value');
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

describe('scanCwdToken', () => {
  it('finds `--cwd value` and `--cwd=value`', () => {
    expect(scanCwdToken(['--cwd', '/x'])).toBe('/x');
    expect(scanCwdToken(['--cwd=/x'])).toBe('/x');
  });

  it('returns undefined without a --cwd token or without its value', () => {
    expect(scanCwdToken([])).toBeUndefined();
    expect(scanCwdToken(['--id', 'x'])).toBeUndefined();
    expect(scanCwdToken(['--cwd'])).toBeUndefined();
    expect(scanCwdToken(['--cwd', '--id'])).toBeUndefined();
  });

  it('lets the last occurrence win, matching the full parser', () => {
    expect(scanCwdToken(['--cwd', '/a', '--cwd=/b'])).toBe('/b');
  });

  it('tolerates tokens the full parser rejects', () => {
    expect(parseToolArgs(['positional', '--cwd', '/x'])).toMatchObject({ ok: false });
    expect(scanCwdToken(['positional', '--cwd', '/x'])).toBe('/x');
    expect(scanCwdToken(['--cwd', '/x', '--json', '{bad'])).toBe('/x');
  });
});

describe('scanConfigDirToken', () => {
  it('returns the last config-dir token value without validating the remaining args', () => {
    expect(
      scanConfigDirToken(['--config-dir', 'config/storybook', '--json', '{bad', '-c', 'alt'])
    ).toBe('alt');
  });

  it('ignores config-dir tokens without a value', () => {
    expect(scanConfigDirToken(['--config-dir', '--json', '{bad'])).toBeUndefined();
    expect(scanConfigDirToken(['-c', '--json', '{bad'])).toBeUndefined();
  });

  it('accepts single-dash config-dir values after -c', () => {
    expect(scanConfigDirToken(['-c', '-storybook', '--json', '{bad'])).toBe('-storybook');
  });
});
