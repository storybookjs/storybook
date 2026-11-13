// How long one run may take, in minutes from its start, the clone and the project install included.
// The agent is asked to answer within `minutes` and reads the clock with `tools/budget.mjs`. At
// `hardStopMinutes` the runner stops the agent, and an answer that is not printed by then is lost.
export interface RunBudget {
  minutes: number;
  hardStopMinutes: number;
}

// Every run of the first whole sweep but one ended within 77 minutes; the one that did not spent an
// hour waiting on a build that never finished.
export const DEFAULT_BUDGET: RunBudget = { minutes: 90, hardStopMinutes: 105 };

// Returns the budget, or a sentence that says why the two values cannot be one.
export const parseBudget = (minutes?: string, hardStopMinutes?: string): RunBudget | string => {
  const budget = {
    minutes: minutes === undefined ? DEFAULT_BUDGET.minutes : Number(minutes),
    hardStopMinutes:
      hardStopMinutes === undefined ? DEFAULT_BUDGET.hardStopMinutes : Number(hardStopMinutes),
  };
  if (!(budget.minutes > 0) || !Number.isFinite(budget.hardStopMinutes)) {
    return '--budget-minutes and --hard-stop-minutes take a number of minutes above zero.';
  }
  return budget.hardStopMinutes > budget.minutes
    ? budget
    : `The hard stop (${budget.hardStopMinutes} minutes) has to come after the budget (${budget.minutes} minutes): the time between them is what the agent has to write its answer.`;
};

// A run whose clone and install already used up the time gets no time at all, never a negative one,
// which a timer would refuse.
export const msUntilHardStop = (startedAt: Date, budget: RunBudget, now = new Date()): number =>
  Math.max(0, startedAt.getTime() + budget.hardStopMinutes * 60_000 - now.getTime());

export const budgetRecord = (startedAt: Date, budget: RunBudget): string =>
  `${JSON.stringify({ startedAt: startedAt.toISOString(), ...budget })}\n`;
