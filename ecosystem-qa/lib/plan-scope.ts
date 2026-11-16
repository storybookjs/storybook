import { existsSync, readFileSync } from 'node:fs';

import { basename } from 'pathe';

import { loadEntries } from './catalog.ts';
import { checkPlanText, planBatches, planHash, type Plan } from './qa-plan.ts';
import { PlanRecord } from './schema.ts';

// The batch of a checked plan file that a run or a collect is about.
export interface PlanScope {
  file: string;
  hash: string;
  plan: Plan;
  batch: number;
}

// End a script on a request it cannot serve, with the reason as its one line of output.
export const refuse = (message: string): never => {
  console.error(message);
  process.exit(1);
};

export const wholeNumber = (flag: string, value: string): number => {
  const number = Number(value);
  return Number.isInteger(number) && number >= 1
    ? number
    : refuse(`${flag} must be a whole number from 1, found "${value}".`);
};

// Read `--plan` and `--batch`: nothing without them, and a refusal when the plan cannot run or has
// no such batch.
export const readPlanScope = ({
  plan: file,
  batch,
}: {
  plan?: string;
  batch?: string;
}): PlanScope | undefined => {
  if (!file) {
    return batch ? refuse('--batch needs --plan.') : undefined;
  }
  if (!batch) {
    return refuse('--plan needs --batch.');
  }
  const number = wholeNumber('--batch', batch);
  if (!existsSync(file)) {
    return refuse(`${file} does not exist.`);
  }
  if (!PlanRecord.shape.file.safeParse(basename(file)).success) {
    return refuse(
      `${file} cannot name a run record: use letters, digits, dots and hyphens, ending in .md.`
    );
  }
  const text = readFileSync(file, 'utf8');
  const { plan, problems } = checkPlanText(text, { catalog: loadEntries() });
  if (!plan || problems.length > 0) {
    const [first] = problems;
    return refuse(`${file} is not a plan that can run, line ${first!.line}: ${first!.message}`);
  }
  const batches = planBatches(plan);
  if (!batches.includes(number)) {
    return refuse(`${file} has no batch ${number}, only 1 to ${batches.length}.`);
  }
  return { file: basename(file), hash: planHash(text), plan, batch: number };
};
