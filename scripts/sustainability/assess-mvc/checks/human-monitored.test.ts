import { describe, expect, it } from 'vitest';

import { checkHumanMonitored } from './human-monitored.ts';

describe('checkHumanMonitored', () => {
  it('PASS when agent-scan:human is present', () => {
    expect(checkHumanMonitored({ labels: ['bug', 'agent-scan:human'] })).toMatchObject({
      id: 'human',
      status: 'pass',
    });
  });

  it.each(['agent-scan:mixed', 'agent-scan:automated'])('FAILs on %s', (label) => {
    const r = checkHumanMonitored({ labels: [label] });
    expect(r.status).toBe('fail');
    expect(r.evidence).toContain(label);
  });

  it('DEFERS when no agent-scan label is present', () => {
    expect(checkHumanMonitored({ labels: ['bug'] }).status).toBe('deferred');
  });
});
