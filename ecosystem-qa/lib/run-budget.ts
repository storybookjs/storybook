// How long one run may take, in minutes from its start, the clone and the project install included.
// The agent is asked to answer within `minutes` and reads the clock with `tools/budget.mjs`. At
// `hardStopMinutes` the runner stops the agent, and an answer that is not printed by then is lost.
export interface RunBudget {
  minutes: number;
  hardStopMinutes: number;
}

// What the agent has left to write its answer once the budget is used up.
const ANSWER_MINUTES = 15;

// Every run of the first whole sweep but one ended within 77 minutes; the one that did not spent an
// hour waiting on a build that never finished.
const BUDGET_MINUTES = 90;

// Returns the budget, or a sentence that says why the two values cannot be one.
export const parseBudget = (minutes?: string, hardStopMinutes?: string): RunBudget | string => {
  const budget = minutes === undefined ? BUDGET_MINUTES : Number(minutes);
  const hardStop =
    hardStopMinutes === undefined ? budget + ANSWER_MINUTES : Number(hardStopMinutes);
  if (!(budget > 0) || !Number.isFinite(budget) || !Number.isFinite(hardStop)) {
    return '--budget-minutes and --hard-stop-minutes take a number of minutes above zero.';
  }
  return hardStop > budget
    ? { minutes: budget, hardStopMinutes: hardStop }
    : `The hard stop (${hardStop} minutes) has to come after the budget (${budget} minutes): the time between them is what the agent has to write its answer.`;
};

// Whole milliseconds, which a timer insists on, and never below zero: a run whose clone and install
// already used up the time gets none.
export const msUntilHardStop = (startedAt: Date, budget: RunBudget, now = new Date()): number =>
  Math.max(0, Math.floor(startedAt.getTime() + budget.hardStopMinutes * 60_000 - now.getTime()));

export const budgetRecord = (startedAt: Date, budget: RunBudget): string =>
  `${JSON.stringify({ startedAt: startedAt.toISOString(), ...budget })}\n`;
