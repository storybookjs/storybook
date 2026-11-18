export const PLANS_BRANCH = 'qa/plans';

const PLAN_FILE = /^ecosystem-qa\/plans\/[\w.-]+\.md$/;
// git quotes a path that holds a quote, a tab, a newline or a byte it is told to escape.
const IN_PLANS = /^"?ecosystem-qa\/plans\//;

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

const addsOrChanges = ({ status, score }: Change) =>
  'AMT'.includes(status) || ('RC'.includes(status) && score < 100);

export const planOfPush = (nameStatus: string): PushPlan => {
  const changes = nameStatus
    .split('\n')
    .filter((line) => line.trim() !== '')
    .map(changeOf)
    .filter((change) => IN_PLANS.test(change.path));
  const misnamed = changes.filter(
    (change) => addsOrChanges(change) && /\.md"?$/.test(change.path) && !PLAN_FILE.test(change.path)
  );
  if (misnamed.length > 0) {
    return {
      kind: 'error',
      reason: `The push adds or changes ${misnamed.map(({ path }) => path).join(', ')}, ${misnamed.length === 1 ? 'whose name is' : 'whose names are'} not the name of a plan, so no sweep starts. A plan is a file in ecosystem-qa/plans/ whose name has only letters, digits, dots, underscores and hyphens and ends in .md.`,
    };
  }
  const plans = changes.filter((change) => PLAN_FILE.test(change.path) && addsOrChanges(change));
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
  const plansTouched = changes.filter((change) => PLAN_FILE.test(change.path));
  return {
    kind: 'skip',
    reason:
      plansTouched.length > 0
        ? `The push only deletes or renames plans: ${plansTouched.map(({ path }) => path).join(', ')}.`
        : 'The push adds or changes no plan.',
  };
};
