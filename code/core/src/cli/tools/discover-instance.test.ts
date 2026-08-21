import { beforeEach, describe, expect, it, vi } from 'vitest';

import { detectAgent } from '../../telemetry/detect-agent.ts';
import { discoverRunningInstance } from './discover-instance.ts';
import { readRegistry } from './instances/registry.ts';
import type { StorybookInstanceRecord } from './instances/types.ts';

vi.mock('./instances/registry.ts', { spy: true });
vi.mock('../../telemetry/detect-agent.ts', { spy: true });

function record(
  cwd: string,
  overrides: Partial<StorybookInstanceRecord> = {}
): StorybookInstanceRecord {
  return {
    schemaVersion: 1,
    instanceId: 'inst-1',
    pid: 1001,
    cwd,
    url: 'http://localhost:6006',
    port: 6006,
    mcp: { status: 'ready', endpoint: 'http://localhost:6006/mcp' },
    ...overrides,
  };
}

beforeEach(() => {
  vi.mocked(readRegistry).mockReset();
  vi.mocked(detectAgent).mockReset();
  vi.mocked(detectAgent).mockReturnValue(undefined);
});

describe('discoverRunningInstance', () => {
  it('forwards an explicit port to resolveInstance and returns the matching record', async () => {
    const onPort = record('/repo', {
      instanceId: 'a',
      pid: 1,
      port: 6007,
      url: 'http://localhost:6007',
    });
    const other = record('/repo', {
      instanceId: 'b',
      pid: 2,
      port: 6006,
      url: 'http://localhost:6006',
    });
    vi.mocked(readRegistry).mockResolvedValue([other, onPort]);

    const discovery = await discoverRunningInstance({ cwd: '/repo', port: 6007 });

    expect(discovery.currentRecord).toEqual(onPort);
    expect(discovery.portMismatch).toBeUndefined();
  });

  it('preserves port-mismatch when the project matches but no instance is on the port', async () => {
    const running = record('/repo');
    vi.mocked(readRegistry).mockResolvedValue([running]);

    const discovery = await discoverRunningInstance({ cwd: '/repo', port: 9999 });

    expect(discovery.currentRecord).toBeUndefined();
    expect(discovery.portMismatch).toEqual({
      port: 9999,
      projectRecords: [running],
    });
  });

  it('does not treat an unrelated project as a port-mismatch', async () => {
    const other = record('/other');
    vi.mocked(readRegistry).mockResolvedValue([other]);

    const discovery = await discoverRunningInstance({ cwd: '/repo', port: 6006 });

    expect(discovery.currentRecord).toBeUndefined();
    expect(discovery.portMismatch).toBeUndefined();
  });
});
