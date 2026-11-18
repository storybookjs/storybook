import { describe, expect, it } from 'vitest';
import { z } from 'zod';

import { CHECK_IDS } from '../checks.ts';
import { loaded } from './fixtures.ts';
import { AgentOutput, agentOutput, CheckResult, RunResultFile } from './schema.ts';

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

  it('accepts the plan checks it was given and rejects one it was not', () => {
    const planRun = [...ids, 'plan.story-sort-in-main'] as const;

    expect(agentOutput(planRun).safeParse(reporting(...planRun)).success).toBe(true);
    expect(
      agentOutput(planRun).safeParse(reporting(...planRun, 'plan.preview-animations')).success
    ).toBe(false);
  });

  describe('for the plan checks it names', () => {
    const plan = 'plan.story-sort-in-main';
    const schema = agentOutput([...ids, plan], [plan]);
    const failing = (id: string, note?: string) => {
      const output = reporting(...ids, plan);
      return {
        ...output,
        checks: output.checks.map((check) => ({
          ...check,
          note: 'Saw it',
          ...(check.id === id ? { state: 'fail', note } : {}),
        })),
      };
    };
    const finding = (checkId: string) => ({
      checkId,
      title: 'Sort is lost',
      baseline: 'pass',
      expected: 'The order of the baseline',
      actual: 'Another order',
      reproSteps: ['Start Storybook'],
      evidence: { logs: [] },
      windowsOnly: false,
    });
    const problems = (output: unknown) => {
      const parsed = schema.safeParse(output);
      return parsed.success ? [] : parsed.error.issues.map(({ message }) => message);
    };

    it('asks for a finding on a fail, also when the agent doubts the plan', () => {
      expect(problems(failing(plan, 'The plan expects the wrong order'))).toEqual([
        `plan check "${plan}" is "fail" and needs a finding`,
      ]);
      expect(
        problems({
          ...failing(plan, 'The plan expects the wrong order'),
          findings: [finding(plan)],
        })
      ).toEqual([]);
    });

    it('counts only a finding of the failed plan check itself', () => {
      const output = failing(plan, 'Another order');
      const bothFail = {
        ...output,
        checks: output.checks.map((check) =>
          check.id === 'core.dev-server' ? { ...check, state: 'fail' } : check
        ),
        findings: [finding('core.dev-server')],
      };

      expect(problems(bothFail)).toEqual([`plan check "${plan}" is "fail" and needs a finding`]);
    });

    it('asks for a note on every state, a pass included', () => {
      expect(problems(reporting(...ids, plan))).toEqual([
        `plan check "${plan}" needs a note with what you saw`,
      ]);
    });

    it('refuses a finding on a plan check that the project could not run, so it opens no issue', () => {
      const output = failing(plan);
      const skipped = {
        ...output,
        checks: output.checks.map((check) =>
          check.id === plan
            ? { ...check, state: 'skip', note: 'No storySort in .storybook/preview.ts' }
            : check
        ),
        findings: [finding(plan)],
      };

      expect(problems(skipped)).toEqual([`finding for "${plan}" needs that check to be "fail"`]);
      expect(problems({ ...skipped, findings: [] })).toEqual([]);
    });

    it('leaves a static fail without a finding and a static check without a note alone', () => {
      expect(problems(failing('core.dev-server'))).toEqual([]);
    });
  });
});

describe('RunResultFile', () => {
  const record = (usd: number | null) => {
    const { result } = loaded('linux', 'claude', []);
    return RunResultFile.safeParse({ ...result, usage: { ...result.usage, usd } }).success;
  };

  it('takes a run without a price, and rejects a price below zero', () => {
    expect(record(1.25)).toBe(true);
    expect(record(null)).toBe(true);
    expect(record(-0.01)).toBe(false);
  });
});

describe('CheckResult', () => {
  const check = (id: string) => CheckResult.safeParse({ id, label: id, state: 'pass' }).success;

  it('accepts the id of a plan check in a run record', () => {
    expect(check('plan.story-sort-in-main')).toBe(true);
  });

  it.each(['plan.story`sort', 'plan.story sort', 'plan.Story-sort', `plan.${'a'.repeat(76)}`])(
    'rejects %j as the id of a check',
    (id) => {
      expect(check(id)).toBe(false);
    }
  );
});
