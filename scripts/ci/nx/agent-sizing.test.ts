import { describe, expect, it } from 'vitest';

import { type Work, agentsFor, simulate } from './agent-sizing.ts';

const independent = (n: number, seconds: number): Work =>
  Object.fromEntries(Array.from({ length: n }, (_, i) => [`t${i}`, { seconds, dependsOn: [] }]));

describe('the agents a run needs', () => {
  it('bills each agent from its boot until no task is left to hand out', () => {
    expect(simulate({ a: { seconds: 100, dependsOn: [] } }, 2, 60)).toEqual({
      seconds: 160,
      // The idle agent stops once the only task is handed out.
      agentSeconds: 160 + 60,
    });
  });

  it('starts a task once the tasks it waits for are done', () => {
    const work: Work = {
      compile: { seconds: 30, dependsOn: [] },
      test: { seconds: 50, dependsOn: ['compile'] },
    };
    expect(simulate(work, 2, 60).seconds).toBe(60 + 30 + 50);
  });

  it('hands out the task with the longest chain behind it first', () => {
    const work: Work = {
      short: { seconds: 10, dependsOn: [] },
      sandbox: { seconds: 10, dependsOn: [] },
      e2e: { seconds: 100, dependsOn: ['sandbox'] },
    };
    // With `short` first, the E2E test would start 10 seconds later.
    expect(simulate(work, 1, 0).seconds).toBe(120);
    expect(simulate(work, 2, 0).seconds).toBe(110);
  });

  it('starts no agent that only shaves a few seconds off the run', () => {
    expect(agentsFor(independent(2, 10), { max: 44, bootSeconds: 60 }).agents).toBe(1);
  });

  it('starts as many agents as long independent tasks need, up to the maximum', () => {
    expect(agentsFor(independent(10, 600), { max: 44, bootSeconds: 60 }).agents).toBe(10);
    expect(agentsFor(independent(440, 300), { max: 44, bootSeconds: 60 }).agents).toBe(44);
    // 400 tasks take ten rounds on 40 agents as on 44.
    expect(agentsFor(independent(400, 300), { max: 44, bootSeconds: 60 }).agents).toBe(40);
  });

  it('does not add agents to a run its longest chain decides', () => {
    const chain: Work = {
      a: { seconds: 300, dependsOn: [] },
      b: { seconds: 300, dependsOn: ['a'] },
      ...independent(5, 20),
    };
    expect(agentsFor(chain, { max: 44, bootSeconds: 60 }).agents).toBe(2);
  });

  it('starts no agent for no work', () => {
    expect(agentsFor({}, { max: 44, bootSeconds: 60 })).toEqual({
      agents: 0,
      seconds: 0,
      agentSeconds: 0,
    });
  });
});
