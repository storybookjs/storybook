import { afterEach, describe, expect, it, vi } from 'vitest';

import { logger } from 'storybook/internal/node-logger';

import { resolvePropsTable, warnAboutPropsTable } from './props-table.ts';

afterEach(() => {
  vi.restoreAllMocks();
});

const resolve = (
  frameworkOptions: Record<string, unknown>,
  features: Record<string, unknown> = {}
) => resolvePropsTable(frameworkOptions, features);

const warnings = (
  frameworkOptions: Record<string, unknown>,
  features: Record<string, unknown> = {}
) => {
  const warn = vi.spyOn(logger, 'warn').mockImplementation(() => {});
  warnAboutPropsTable(resolve(frameworkOptions, features));
  return warn.mock.calls.map(([message]) => String(message));
};

describe('resolvePropsTable', () => {
  it('defaults to api', () => {
    expect(resolve({})).toMatchObject({ mode: 'api', configured: false });
  });

  it('reads the framework option', () => {
    expect(resolve({ propsTable: 'all' })).toMatchObject({ mode: 'all', configured: true });
  });

  it('maps the deprecated flag onto the ladder', () => {
    expect(resolve({}, { angularFilterNonInputControls: true })).toMatchObject({
      mode: 'inputs',
      configured: false,
    });
    expect(resolve({}, { angularFilterNonInputControls: false })).toMatchObject({
      mode: 'all',
      configured: false,
    });
  });

  it('lets an explicit propsTable win over the deprecated flag', () => {
    expect(resolve({ propsTable: 'api' }, { angularFilterNonInputControls: true })).toMatchObject({
      mode: 'api',
    });
  });

  it('defaults when core reports no framework options at all', () => {
    expect(resolvePropsTable(null, {})).toMatchObject({ mode: 'api', configured: false });
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
});
