import { describe, expect, it } from 'vitest';
import { z } from 'zod';

import { CHECK_IDS } from '../checks.ts';
import { AgentOutput, agentOutput } from './schema.ts';

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

describe('agentOutput', () => {
  const ids = ['core.dev-server', 'upgrade.index-cli', 'upgrade.command'] as const;

  const reporting = (...reported: string[]) => ({
    storybookVersionBefore: '10.6.0',
    storybookVersionInstalled: '11.0.0',
    checks: reported.map((id) => ({ id, label: id, state: 'pass' })),
    findings: [],
  });

  it('names the check ids to the agent in the order given, for checks and for findings', () => {
    const schema = z.toJSONSchema(agentOutput(ids)) as unknown as {
      properties: {
        checks: { items: { properties: { id: { enum: string[] } } } };
        findings: { items: { properties: { checkId: { enum: string[] } } } };
      };
    };

    expect(schema.properties.checks.items.properties.id.enum).toEqual([...ids]);
    expect(schema.properties.findings.items.properties.checkId.enum).toEqual([...ids]);
  });

  it('rejects a check that is not among the ids given', () => {
    expect(agentOutput(ids).safeParse(reporting(...ids)).success).toBe(true);
    expect(agentOutput(ids).safeParse(reporting(...ids, 'build.static')).success).toBe(false);
  });
});
