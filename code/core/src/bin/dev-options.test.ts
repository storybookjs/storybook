import { describe, expect, it } from 'vitest';

import { resolveDevCommandOptions } from './dev-options.ts';

describe('resolveDevCommandOptions', () => {
  it('uses PORT when no explicit --port was provided', () => {
    expect(resolveDevCommandOptions({}, { env: { PORT: '6123' } })).toMatchObject({
      port: 6123,
    });
  });

  it('keeps explicit --port precedence over PORT outside Claude preview', () => {
    expect(resolveDevCommandOptions({ port: '7007' }, { env: { PORT: '6123' } })).toMatchObject({
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

  it('preserves existing SBCONFIG_PORT-style string parsing', () => {
    expect(
      resolveDevCommandOptions({ port: '7007' }, { env: { PORT: '6123', SBCONFIG_PORT: '7008' } })
    ).toMatchObject({
      port: 7008,
    });
  });

  it('keeps SBCONFIG_PORT precedence over explicit --port', () => {
    expect(
      resolveDevCommandOptions({ port: '7007' }, { env: { SBCONFIG_PORT: '7008' } })
    ).toMatchObject({
      port: 7008,
    });
  });

  it('keeps legacy SBCONFIG_PORT parsing for prefixed numeric values', () => {
    expect(resolveDevCommandOptions({}, { env: { SBCONFIG_PORT: '7007abc' } })).toMatchObject({
      port: 7007,
    });
  });

  it('does not add new validation to invalid SBCONFIG_PORT values', () => {
    expect(() =>
      resolveDevCommandOptions({}, { env: { SBCONFIG_PORT: 'not-a-port' } })
    ).not.toThrow();
  });

  it('fails clearly when PORT is not a port number', () => {
    expect(() => resolveDevCommandOptions({}, { env: { PORT: 'not-a-port' } })).toThrow(
      'PORT must be a valid port number'
    );
  });

  it('fails clearly when PORT is outside the port range', () => {
    expect(() => resolveDevCommandOptions({}, { env: { PORT: '70000' } })).toThrow(
      'PORT must be a valid port number from 1 to 65535, received "70000"'
    );
  });

  it('ignores empty PORT values', () => {
    expect(resolveDevCommandOptions({}, { env: { PORT: '' } })).not.toHaveProperty('port');
    expect(resolveDevCommandOptions({}, { env: { PORT: '   ' } })).not.toHaveProperty('port');
  });

  it('trims PORT values before parsing', () => {
    expect(resolveDevCommandOptions({}, { env: { PORT: ' 6123 ' } })).toMatchObject({
      port: 6123,
    });
  });

  it('does not treat --port placeholders as PORT interpolation', () => {
    expect(() => resolveDevCommandOptions({ port: '$PORT' }, { env: { PORT: '6123' } })).toThrow(
      '--port must be a valid port number from 1 to 65535, received "$PORT"'
    );
  });

  it('does not hide --port placeholders in Claude preview launches', () => {
    expect(() =>
      resolveDevCommandOptions(
        { port: '$PORT' },
        { env: { CLAUDE_AGENT_SDK_VERSION: '0.1.0', PORT: '6123' } }
      )
    ).toThrow('--port must be a valid port number from 1 to 65535, received "$PORT"');
  });

  it('fails clearly when explicit --port is invalid', () => {
    expect(() => resolveDevCommandOptions({ port: '7007abc' })).toThrow(
      '--port must be a valid port number from 1 to 65535, received "7007abc"'
    );
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
});
