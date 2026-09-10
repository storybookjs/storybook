import { telemetry } from 'storybook/internal/telemetry';

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import {
  commandPartsFromRef,
  reportToolsCommandEvent,
  shouldReportSdkInvocation,
  toolsCommandDimensions,
} from './command-telemetry.ts';

vi.mock('storybook/internal/telemetry', { spy: true });

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

describe('commandPartsFromRef', () => {
  it('splits a dotted method id into the CLI spelling of both parts', () => {
    expect(commandPartsFromRef('docs.list')).toEqual({ toolset: 'docs', tool: 'list' });
    expect(commandPartsFromRef('stories.findByComponent')).toEqual({
      toolset: 'stories',
      tool: 'find-by-component',
    });
  });

  it('collapses a malformed reference', () => {
    expect(commandPartsFromRef('not-a-ref')).toEqual({ toolset: '(invalid)', tool: '(invalid)' });
  });

  it('collapses a part that is not a name-shaped token', () => {
    expect(commandPartsFromRef('my project.list')).toEqual({
      toolset: '(invalid)',
      tool: 'list',
    });
  });
});

describe('reportToolsCommandEvent', () => {
  beforeEach(() => {
    vi.mocked(telemetry).mockReset();
    vi.mocked(telemetry).mockResolvedValue(undefined);
  });

  it('merges the report under the record and names the tool by the report', async () => {
    await reportToolsCommandEvent(
      {
        toolset: 'stories',
        tool: 'findByComponent',
        success: true,
        outcome: 'success',
        client: 'cli',
        requestedMode: 'auto',
        attachMode: 'local',
      },
      {
        report: {
          toolset: 'stories',
          tool: 'find-by-component',
          event: 'tool:stories_findByComponent',
          payload: { componentCount: 2, success: 'not a record field' },
        },
        configDir: '/repo/.storybook',
      }
    );

    expect(telemetry).toHaveBeenCalledWith(
      'tools-command',
      {
        toolset: 'stories',
        tool: 'find-by-component',
        event: 'tool:stories_findByComponent',
        componentCount: 2,
        success: true,
        outcome: 'success',
        client: 'cli',
        requestedMode: 'auto',
        attachMode: 'local',
      },
      { configDir: '/repo/.storybook' }
    );
  });

  it('sends the record alone when the run produced no report', async () => {
    await reportToolsCommandEvent({
      success: false,
      outcome: 'intercept',
      client: 'cli',
      requestedMode: 'auto',
      attachMode: 'auto',
    });

    expect(telemetry).toHaveBeenCalledWith(
      'tools-command',
      {
        success: false,
        outcome: 'intercept',
        client: 'cli',
        requestedMode: 'auto',
        attachMode: 'auto',
      },
      { configDir: undefined }
    );
  });

  it('never lets a telemetry failure escape', async () => {
    vi.mocked(telemetry).mockRejectedValue(new Error('offline'));

    await expect(
      reportToolsCommandEvent({
        success: true,
        outcome: 'success',
        client: 'sdk',
        requestedMode: 'local',
        attachMode: 'local',
      })
    ).resolves.toBeUndefined();
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
