import { describe, expect, it } from 'vitest';

import type { StorybookInstanceRecord } from '../instances/types.ts';
import { AttachUnavailableError } from './errors.ts';

const record: StorybookInstanceRecord = {
  schemaVersion: 1,
  instanceId: 'instance',
  pid: 123,
  cwd: '/repo',
  url: 'http://localhost:6006',
  port: 6006,
  token: 'channel-secret',
  embedBaseUrl: 'http://localhost:6006/embed/embed-secret',
  mcp: { status: 'ready' },
};

describe('AttachUnavailableError', () => {
  it('keeps instance secrets out of its agent-facing payload', () => {
    const error = new AttachUnavailableError({
      reason: 'connection-failed',
      instances: [record],
      remediation: 'Restart Storybook.',
    });

    expect(error.data.instances).toEqual([
      expect.objectContaining({ url: 'http://localhost:6006', port: 6006 }),
    ]);
    expect(JSON.stringify(error.data)).not.toMatch(/channel-secret|embed-secret/);
  });
});
