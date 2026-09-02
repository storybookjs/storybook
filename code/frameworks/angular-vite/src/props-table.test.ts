import { describe, expect, it, vi } from 'vitest';

import { deprecate, logger } from 'storybook/internal/node-logger';

import { resolvePropsTable, warnAboutPropsTable } from './props-table.ts';

// The shared setup's node-logger mock keeps the real `deprecate`, which logs past the mocked
// `logger`, so deprecations are only observable through a file-local mock.
vi.mock('storybook/internal/node-logger', () => ({
  logger: { warn: vi.fn() },
  deprecate: vi.fn(),
}));

const warnings = (
  frameworkOptions: Record<string, unknown>,
  features: Record<string, boolean> = {}
) => {
  vi.mocked(logger.warn).mockClear();
  vi.mocked(deprecate).mockClear();
  warnAboutPropsTable(frameworkOptions, features);
  return [...vi.mocked(logger.warn).mock.calls, ...vi.mocked(deprecate).mock.calls].map(
    ([message]) => String(message)
  );
};

describe('resolvePropsTable', () => {
  it('defaults to api', () => {
    expect(resolvePropsTable({}, {})).toBe('api');
  });

  it('reads the framework option', () => {
    expect(resolvePropsTable({ propsTable: 'all' }, {})).toBe('all');
  });

  it('maps the deprecated flag onto the ladder', () => {
    expect(resolvePropsTable({}, { angularFilterNonInputControls: true })).toBe('inputs');
    expect(resolvePropsTable({}, { angularFilterNonInputControls: false })).toBe('all');
  });

  it('lets an explicit propsTable win over the deprecated flag', () => {
    expect(resolvePropsTable({ propsTable: 'api' }, { angularFilterNonInputControls: true })).toBe(
      'api'
    );
  });

  it('defaults when core reports no framework options at all', () => {
    expect(resolvePropsTable(null, {})).toBe('api');
  });

  it('falls back past a value that is not a mode', () => {
    expect(resolvePropsTable({ propsTable: 'API' as never }, {})).toBe('api');
    expect(
      resolvePropsTable({ propsTable: 'input' as never }, { angularFilterNonInputControls: true })
    ).toBe('inputs');
  });
});

describe('warnAboutPropsTable', () => {
  it('names propsTable as the replacement for the deprecated flag', () => {
    const messages = warnings({}, { angularFilterNonInputControls: true });

    expect(messages).toHaveLength(1);
    expect(messages[0]).toContain('angularFilterNonInputControls');
    expect(messages[0]).toContain("propsTable: 'inputs'");
  });

  it('says the flag is ignored when propsTable is set too', () => {
    const messages = warnings(
      { propsTable: 'all' },
      { angularFilterNonInputControls: true, experimentalDocgenServer: true }
    );

    expect(messages).toHaveLength(1);
    expect(messages[0]).toContain('takes precedence');
  });

  it('stays quiet when neither the flag nor an unsupported mode is configured', () => {
    expect(warnings({}, { experimentalDocgenServer: true })).toEqual([]);
    expect(warnings({ propsTable: 'all' })).toEqual([]);
  });

  it('warns that an explicit api needs the docgen server, without downgrading it', () => {
    const messages = warnings({ propsTable: 'api' });

    expect(messages).toHaveLength(1);
    expect(messages[0]).toContain('experimentalDocgenServer');
  });

  it('does not warn about the api default, which nobody asked for', () => {
    expect(warnings({})).toEqual([]);
  });

  it('calls out a value that is not a mode instead of half-applying it', () => {
    const messages = warnings({ propsTable: 'input' });

    expect(messages).toHaveLength(1);
    expect(messages[0]).toContain('"input"');
    expect(messages[0]).toContain("'inputs'");
  });
});
