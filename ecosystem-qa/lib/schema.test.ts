import { describe, expect, it } from 'vitest';

import { CHECK_IDS } from '../checks.ts';
import { AgentOutput } from './schema.ts';

const answer = (storybookVersionBefore: unknown) => ({
  storybookVersionBefore,
  storybookVersionInstalled: '11.0.0',
  checks: CHECK_IDS.map((id) => ({ id, label: id, state: 'pass' })),
  findings: [],
});

describe('AgentOutput', () => {
  it.each(['10.6.0', '10.0.0-beta.3', null])('accepts %j as the starting version', (version) => {
    expect(AgentOutput.safeParse(answer(version)).success).toBe(true);
  });

  it.each(['@everyone', 'see https://evil.example/x', '10.6', '10.6.0\n```'])(
    'rejects %j as the starting version',
    (version) => {
      expect(AgentOutput.safeParse(answer(version)).success).toBe(false);
    }
  );
});
