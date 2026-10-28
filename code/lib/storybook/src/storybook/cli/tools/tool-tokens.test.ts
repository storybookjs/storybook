import { describe, expect, it } from 'vitest';

import { parsePort, parseToolsTokens } from './tool-tokens.ts';

describe('parseToolsTokens', () => {
  it('parses --key value pairs with JSON coercion', () => {
    const result = parseToolsTokens(['--maxDistance', '2', '--name', 'button']);

    expect(result).toEqual({
      ok: true,
      help: false,
      json: false,
      output: undefined,
      attach: undefined,
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

  it('treats --json, --help, --attach, and --no-attach as bare CLI flags, never tool arguments', () => {
    const result = parseToolsTokens(['--json', '--help', '--attach']);

    expect(result).toMatchObject({ ok: true, json: true, help: true, attach: true, args: {} });
    expect(parseToolsTokens(['--no-attach'])).toMatchObject({
      ok: true,
      attach: false,
      args: {},
    });
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
    expect(parseToolsTokens(['--attach=yes'])).toMatchObject({ ok: false });
    expect(parseToolsTokens(['--no-attach=yes'])).toMatchObject({ ok: false });
    expect(parseToolsTokens(['--attach', '--no-attach'])).toMatchObject({ ok: false });
  });
});

describe('parseToolsTokens --story shorthand', () => {
  it('maps each repeated --story to a { storyId } entry of stories', () => {
    const cases: Record<string, string[]> = {
      'one story': ['--story', 'button--primary'],
      repeated: ['--story', 'button--primary', '--story=button--secondary'],
      'numeric id stays a string': ['--story', '123'],
      'appended after --stories': ['--stories', '[{"storyId":"a--one"}]', '--story', 'b--two'],
      'appended after --input stories': [
        '--input',
        '{"stories":[{"storyId":"a--one"}],"viewport":"mobile"}',
        '--story',
        'b--two',
      ],
      'missing id': ['--story'],
      'missing id before a flag': ['--story', '--json'],
      'non-array --stories': ['--stories', 'button', '--story', 'b--two'],
    };
    const results = Object.fromEntries(
      Object.entries(cases).map(([name, argv]) => {
        const result = parseToolsTokens(argv);
        return [name, result.ok ? result.args : result.error];
      })
    );

    expect(results).toMatchInlineSnapshot(`
      {
        "appended after --input stories": {
          "stories": [
            {
              "storyId": "a--one",
            },
            {
              "storyId": "b--two",
            },
          ],
          "viewport": "mobile",
        },
        "appended after --stories": {
          "stories": [
            {
              "storyId": "a--one",
            },
            {
              "storyId": "b--two",
            },
          ],
        },
        "missing id": "\`--story\` requires a story id.",
        "missing id before a flag": "\`--story\` requires a story id.",
        "non-array --stories": "\`--story\` cannot be combined with a non-array \`--stories\`.",
        "numeric id stays a string": {
          "stories": [
            {
              "storyId": "123",
            },
          ],
        },
        "one story": {
          "stories": [
            {
              "storyId": "button--primary",
            },
          ],
        },
        "repeated": {
          "stories": [
            {
              "storyId": "button--primary",
            },
            {
              "storyId": "button--secondary",
            },
          ],
        },
      }
    `);
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
