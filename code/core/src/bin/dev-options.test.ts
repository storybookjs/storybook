import { describe, expect, it } from 'vitest';

import { resolveDevCommandOptions } from './dev-options.ts';

describe('resolveDevCommandOptions', () => {
  it('preserves truthy getEnvConfig-style env overrides for existing dev options', () => {
    expect(
      resolveDevCommandOptions(
        { ci: false, configDir: 'cli-config', host: 'cli-host', staticDir: 'cli-static' },
        {
          env: {
            CI: 'false',
            SBCONFIG_CONFIG_DIR: 'env-config',
            SBCONFIG_HOSTNAME: 'env-host',
            SBCONFIG_STATIC_DIR: 'env-static',
          },
        }
      )
    ).toMatchObject({
      ci: 'false',
      configDir: 'env-config',
      host: 'env-host',
      staticDir: 'env-static',
    });
  });

  it('uses PORT when no explicit port or SBCONFIG_PORT was provided', () => {
    expect(resolveDevCommandOptions({}, { env: { PORT: '6123' } })).toMatchObject({
      port: 6123,
    });
  });

  it('keeps explicit --port precedence over PORT outside Claude preview', () => {
    expect(resolveDevCommandOptions({ port: '7007' }, { env: { PORT: '6123' } })).toMatchObject({
      port: 7007,
    });
  });

  it('uses SBCONFIG_PORT over PORT outside Claude preview', () => {
    expect(
      resolveDevCommandOptions({}, { env: { PORT: '6123', SBCONFIG_PORT: '7008' } })
    ).toMatchObject({
      port: 7008,
    });
  });

  it('keeps explicit --port precedence over SBCONFIG_PORT outside Claude preview', () => {
    expect(
      resolveDevCommandOptions({ port: '7007' }, { env: { SBCONFIG_PORT: '7008' } })
    ).toMatchObject({
      port: 7007,
    });
  });

  it('uses Claude preview PORT over explicit --port', () => {
    expect(
      resolveDevCommandOptions(
        { port: '7007' },
        { env: { CLAUDE_AGENT_SDK_VERSION: '0.1.0', PORT: '6123' } }
      )
    ).toMatchObject({
      port: 6123,
    });
  });

  it('uses explicit --port over SBCONFIG_PORT in Claude preview when PORT is absent', () => {
    expect(
      resolveDevCommandOptions(
        { port: '7007' },
        { env: { CLAUDE_AGENT_SDK_VERSION: '0.1.0', SBCONFIG_PORT: '7008' } }
      )
    ).toMatchObject({
      port: 7007,
    });
  });

  it('uses SBCONFIG_PORT in Claude preview when PORT and explicit --port are absent', () => {
    expect(
      resolveDevCommandOptions(
        {},
        { env: { CLAUDE_AGENT_SDK_VERSION: '0.1.0', SBCONFIG_PORT: '7008' } }
      )
    ).toMatchObject({
      port: 7008,
    });
  });

  it('defaults browser opening to false for Claude preview launches', () => {
    expect(
      resolveDevCommandOptions({ open: true }, { env: { CLAUDE_AGENT_SDK_VERSION: '0.1.0' } })
    ).toMatchObject({
      open: false,
    });
  });

  it('keeps the browser opening default outside Claude preview', () => {
    expect(resolveDevCommandOptions({ open: true }, { env: {} })).toMatchObject({
      open: true,
    });
  });

  it('rejects invalid selected PORT values', () => {
    expect(() => resolveDevCommandOptions({}, { env: { PORT: 'not-a-port' } })).toThrow(
      'not-a-port'
    );
  });

  it('rejects invalid selected SBCONFIG_PORT values', () => {
    expect(() => resolveDevCommandOptions({}, { env: { SBCONFIG_PORT: '7007abc' } })).toThrow(
      '7007abc'
    );
  });

  it('does not treat --port placeholders as PORT interpolation', () => {
    expect(() => resolveDevCommandOptions({ port: '$PORT' }, { env: { PORT: '6123' } })).toThrow(
      '$PORT'
    );
  });

  it('rejects selected ports outside the valid range', () => {
    expect(() => resolveDevCommandOptions({ port: '70000' })).toThrow('70000');
  });
});
