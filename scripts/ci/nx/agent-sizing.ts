// How many agents a run of the NX DTE pipeline starts (circleci-dte.ts): one for every
// TASKS_PER_AGENT tasks NX Cloud will hand out, which are the selected tasks it has no cache entry
// for (select.ts). A cached task takes no agent: NX Cloud restores it on the main job.
//
// A count, not a simulation of NX Cloud's scheduling: the simulation assumed NX Cloud starts the
// longest chain of tasks first, which it does not, so it started too few agents and the runs took
// about a minute longer. An agent that finds nothing left to do stops (`--stop-workers-after`), so
// one agent too many costs a Linux run little.
//
// Plain Node with no dependencies: main.ts imports it before `yarn install`.

// Linux agents are `large` containers (4 vCPUs). A Windows `large` agent costs six times the
// credits a minute and boots for about four minutes, so a run starts at most four.
export const MAX_AGENTS = { linux: 44, windows: 4 } as const;

export const TASKS_PER_AGENT = 4;

// At least one agent while any task is selected, also when every one is cached: a run without an
// agent was never tried.
export const agentsFor = ({ tasks, uncached }: { tasks: number; uncached: number }, max: number) =>
  tasks === 0 ? 0 : Math.min(max, Math.max(1, Math.ceil(uncached / TASKS_PER_AGENT)));
