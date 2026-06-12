import { describe, expect, it } from 'vitest';

import { checkHumanMonitored } from './check.ts';

describe('checkHumanMonitored', () => {
  it('PASS when agent-scan:human is present', () => {
    expect(checkHumanMonitored({ labels: ['bug', 'agent-scan:human'] })).toMatchObject({
      id: 'human',
      status: 'pass',
    });
  });

  it('WARN when agent-scan:ignore is present', () => {
    const r = checkHumanMonitored({ labels: ['agent-scan:ignore'] });
    expect(r.status).toBe('warn');
    expect(r.evidence).toBe('Labeled agent-scan:ignore.');
  });

  it('WARN beats FAIL when both labels are present', () => {
    const r = checkHumanMonitored({
      labels: ['agent-scan:automated', 'agent-scan:ignore'],
    });
    expect(r.status).toBe('warn');
  });

  it('PASS beats WARN when both labels are present', () => {
    const r = checkHumanMonitored({
      labels: ['agent-scan:human', 'agent-scan:ignore'],
    });
    expect(r.status).toBe('pass');
  });

  it.each(['agent-scan:mixed', 'agent-scan:automated'])('FAILs on %s', (label) => {
    const r = checkHumanMonitored({ labels: [label] });
    expect(r.status).toBe('fail');
    expect(r.evidence).toBe(`Labeled ${label}.`);
    expect(r.guidance).toContain('https://github.com/MatteoGabriele/agentscan');
    expect(r.guidance).toContain('https://discord.gg/invite/storybook');
  });

  it('DEFERS when no agent-scan label is present', () => {
    expect(checkHumanMonitored({ labels: ['bug'] }).status).toBe('deferred');
  });
});
