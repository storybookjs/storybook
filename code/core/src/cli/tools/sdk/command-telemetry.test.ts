import { afterEach, describe, expect, it, vi } from 'vitest';

import {
  commandNameFromRef,
  shouldReportSdkInvocation,
  toolsCommandDimensions,
  wrapMethodTelemetry,
} from './command-telemetry.ts';

describe('toolsCommandDimensions', () => {
  it('uses resolvedMode for attachMode when a host exists', () => {
    expect(
      toolsCommandDimensions({
        clientInfo: { kind: 'cli' },
        requestedMode: 'auto',
        resolvedMode: 'local',
        host: 'in-process',
        fallbackReason: 'no-instance',
      })
    ).toEqual({
      client: 'cli',
      requestedMode: 'auto',
      resolvedMode: 'local',
      attachMode: 'local',
      host: 'in-process',
      attachGate: 'no-instance',
    });
  });

  it('falls back attachMode to the requested mode when nothing resolved', () => {
    expect(
      toolsCommandDimensions({
        clientInfo: { kind: 'sdk' },
        requestedMode: 'attached',
      })
    ).toEqual({
      client: 'sdk',
      requestedMode: 'attached',
      attachMode: 'attached',
    });
  });
});

describe('commandNameFromRef', () => {
  it('turns a dotted method id into the CLI spelling', () => {
    expect(commandNameFromRef('docs.list')).toBe('docs list');
    expect(commandNameFromRef('stories.findByComponent')).toBe('stories find-by-component');
  });

  it('collapses a malformed reference', () => {
    expect(commandNameFromRef('not-a-ref')).toBe('(invalid)');
  });
});

describe('wrapMethodTelemetry', () => {
  it('merges host dimensions under the method payload', async () => {
    const sink = vi.fn(async () => {});
    const wrapped = wrapMethodTelemetry(sink, {
      client: 'sdk',
      requestedMode: 'auto',
      resolvedMode: 'attached',
      attachMode: 'attached',
      host: 'child',
    });

    await wrapped('tool:listAllDocumentation', { toolset: 'docs' });

    expect(sink).toHaveBeenCalledWith('tool:listAllDocumentation', {
      client: 'sdk',
      requestedMode: 'auto',
      resolvedMode: 'attached',
      attachMode: 'attached',
      host: 'child',
      toolset: 'docs',
    });
  });
});

describe('shouldReportSdkInvocation', () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it('is true only for the SDK outside a child host', () => {
    expect(shouldReportSdkInvocation('sdk')).toBe(true);
    expect(shouldReportSdkInvocation('cli')).toBe(false);
    vi.stubEnv('STORYBOOK_TOOLS_CHILD_HOST', 'true');
    expect(shouldReportSdkInvocation('sdk')).toBe(false);
  });
});
