import { describe, expect, it } from 'vitest';

import { AGENT_BOOT_SECONDS, MAX_AGENTS, type Work, agentsFor, simulate } from './agent-sizing.ts';

const independent = (n: number, seconds: number, prefix = 't'): Work =>
  Object.fromEntries(
    Array.from({ length: n }, (_, i) => [`${prefix}${i}`, { seconds, dependsOn: [] }])
  );

const linux = { max: MAX_AGENTS.linux, bootSeconds: AGENT_BOOT_SECONDS.linux };
const windows = { max: MAX_AGENTS.windows, bootSeconds: AGENT_BOOT_SECONDS.windows };

describe('the agents a run needs', () => {
  it('hands out the task that has been ready longest, not the longest chain, as NX Cloud does', () => {
    const work: Work = {
      a1: { seconds: 10, dependsOn: [] },
      a2: { seconds: 10, dependsOn: [] },
      z: { seconds: 100, dependsOn: [] },
    };
    expect(simulate(work, 2, 0).seconds).toBe(110);
  });

  it('bills an idle agent only until the last task is handed out', () => {
    expect(simulate({ a: { seconds: 100, dependsOn: [] } }, 2, 60)).toEqual({
      seconds: 160,
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

  it('starts no agent that only shaves a second off the run', () => {
    expect(agentsFor(independent(2, 1), linux).agents).toBe(1);
  });

  it('starts as many agents as long independent tasks need, up to the maximum', () => {
    expect(agentsFor(independent(10, 600), linux).agents).toBe(10);
    expect(agentsFor(independent(440, 300), linux).agents).toBe(MAX_AGENTS.linux);
    expect(agentsFor(independent(440, 300), { ...linux, max: 5 }).agents).toBe(5);
  }, 30_000);

  it('starts no agent that leaves the number of rounds the same', () => {
    expect(agentsFor(independent(400, 300), linux).agents).toBe(40);
  }, 30_000);

  it('starts agents only for the tasks NX Cloud has no cache entry for', () => {
    const rerun: Work = { ...independent(163, 0, 'cached'), ...independent(14, 90) };
    expect(Object.keys(rerun)).toHaveLength(177);
    expect(agentsFor(independent(177, 90), linux).agents).toBeGreaterThan(30);
    expect(agentsFor(rerun, linux).agents).toBeLessThanOrEqual(14);
  });

  it('does not add agents to a run its longest chain decides', () => {
    const chain: Work = {
      a: { seconds: 300, dependsOn: [] },
      b: { seconds: 300, dependsOn: ['a'] },
      ...independent(5, 20),
    };
    expect(agentsFor(chain, linux).agents).toBe(2);
  });

  it('weighs the long boot of a Windows agent, at most four of them', () => {
    expect(agentsFor(independent(2, 600), windows).agents).toBe(2);
    expect(agentsFor(independent(40, 600), windows).agents).toBe(MAX_AGENTS.windows);
  });

  it('starts no agent for no work', () => {
    expect(agentsFor({}, linux)).toEqual({ agents: 0, seconds: 0, agentSeconds: 0 });
  });
});
