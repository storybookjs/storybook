export const PLANS_BRANCH = 'qa/plans';

const PLAN_FILE = /^ecosystem-qa\/plans\/[^/]+\.md$/;

export type PushPlan =
  | { kind: 'run'; file: string }
  | { kind: 'skip'; reason: string }
  | { kind: 'error'; reason: string };

type Change = { status: string; score: number; path: string };

// A line of `git diff --name-status` is the status, an optional similarity score, and one path, or
// the old and the new path of a rename or a copy.
const changeOf = (line: string): Change => {
  const [code = '', ...paths] = line.split('\t');
  const score = Number(code.slice(1) || '0');
  return { status: code.charAt(0), score, path: paths.at(-1) ?? '' };
};

export const planOfPush = (nameStatus: string): PushPlan => {
  const changes = nameStatus
    .split('\n')
    .filter((line) => line.trim() !== '')
    .map(changeOf)
    .filter((change) => PLAN_FILE.test(change.path));
  const plans = changes.filter(
    ({ status, score }) => 'AMT'.includes(status) || ('RC'.includes(status) && score < 100)
  );
  if (plans.length > 1) {
    return {
      kind: 'error',
      reason: `The push adds or changes ${plans.length} plans, ${plans.map(({ path }) => path).join(', ')}. Push one plan at a time.`,
    };
  }
  const [plan] = plans;
  if (plan) {
    return { kind: 'run', file: plan.path };
  }
  return {
    kind: 'skip',
    reason:
      changes.length > 0
        ? `The push only deletes or renames plans: ${changes.map(({ path }) => path).join(', ')}.`
        : 'The push adds or changes no plan.',
  };
};
