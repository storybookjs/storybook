import { describe, expect, it } from 'vitest';

import { MAX_AGENTS, agentsFor } from './agent-sizing.ts';

describe('the agents a run starts', () => {
  it('starts one for every four tasks NX Cloud hands out', () => {
    expect(agentsFor({ tasks: 96, uncached: 96 }, MAX_AGENTS.linux)).toBe(24);
    expect(agentsFor({ tasks: 1, uncached: 1 }, MAX_AGENTS.linux)).toBe(1);
  });

  it('counts no cached task, but keeps one agent while any task is selected', () => {
    expect(agentsFor({ tasks: 224, uncached: 15 }, MAX_AGENTS.linux)).toBe(4);
    expect(agentsFor({ tasks: 56, uncached: 0 }, MAX_AGENTS.windows)).toBe(1);
  });

  it('starts at most the maximum, and none for an empty run', () => {
    expect(agentsFor({ tasks: 315, uncached: 315 }, MAX_AGENTS.linux)).toBe(44);
    expect(agentsFor({ tasks: 56, uncached: 56 }, MAX_AGENTS.windows)).toBe(4);
    expect(agentsFor({ tasks: 0, uncached: 0 }, MAX_AGENTS.linux)).toBe(0);
  });
});
