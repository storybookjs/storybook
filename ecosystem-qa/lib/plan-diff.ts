import {
  type Decision,
  type DiscoveredRepo,
  layoutPlan,
  manualChecksOf,
  type Place,
  type Plan,
  type PlanEntry,
  placesOf,
} from './qa-plan.ts';
import type { Window } from './window.ts';

const code = (value: string) => `\`${value}\``;
const codes = (values: string[]) => values.map(code).join(', ');

const kindOf = (decision: Decision): string => {
  if (decision === null) {
    return 'no decision yet';
  }
  if ('none' in decision) {
    return 'no QA';
  }
  if (!('entries' in decision)) {
    return 'manual QA';
  }
  const rest = 'manual' in decision ? ', manual QA for the rest' : '';
  return `tested by ${codes(decision.entries)}${rest}`;
};

// A place names the kind of decision and the entries or group that hold the PR, and no text of a
// check or a reason, so that rewording one moves no PR.
const placeText = (place: Place): string => {
  switch (place.kind) {
    case 'entry':
      return `tested by ${code(place.slug)}`;
    case 'manual':
      return place.row.check === null ? 'no decision yet' : 'manual QA';
    case 'none':
      return 'no QA';
    case 'group':
      return place.group.slug === null
        ? 'in no group yet'
        : `group ${code(place.group.slug)}, ${kindOf(place.group.decision)}`;
  }
};

const placesByPr = (plan: Plan, window: Window): Map<number, string> => {
  const places = placesOf(plan, layoutPlan(plan).at);
  return new Map(
    window.prs.map((pr) => {
      const own = (places.get(pr.number) ?? []).map(placeText).join('; ');
      return [pr.number, own || (pr.status === 'verified' ? 'verified by hand' : 'nowhere')];
    })
  );
};

const entryText = (entry: PlanEntry) =>
  `${code(entry.slug)}${entry.probe ? ', a probe,' : ''} in batch ${entry.batch} on ${codes(entry.repos.map((repo) => repo.id))}`;

const changedFields = (before: PlanEntry, after: PlanEntry) =>
  (Object.keys({ ...before, ...after }) as (keyof PlanEntry)[]).filter(
    (key) => JSON.stringify(before[key]) !== JSON.stringify(after[key])
  );

const missingFrom = <Item>(items: Item[], others: Item[], key: (item: Item) => string) => {
  const keys = new Set(others.map(key));
  return items.filter((item) => !keys.has(key(item)));
};

const withPrs = (text: string, prs: number[]) =>
  `${text} (${prs.map((pr) => `#${pr}`).join(', ')})`;

const manualChecks = (plan: Plan) =>
  manualChecksOf(plan, layoutPlan(plan).at).map(({ manual, prs }) => withPrs(manual, prs));

const noQaReasons = (plan: Plan) => [
  ...plan.none.map(({ reason, prs }) => withPrs(reason, prs)),
  ...plan.groups.flatMap((group) =>
    group.slug !== null && group.decision && 'none' in group.decision
      ? [withPrs(group.decision.none, group.prs)]
      : []
  ),
];

export type PlanDiff = { lines: string[]; unnamed: number[]; unmoved: number[] };

export const diffPlans = (before: Plan, after: Plan, window: Window, named: number[]): PlanDiff => {
  const was = placesByPr(before, window);
  const is = placesByPr(after, window);
  const moved = window.prs.map((pr) => pr.number).filter((pr) => was.get(pr) !== is.get(pr));
  const unnamed = moved.filter((pr) => !named.includes(pr));
  const slug = (entry: PlanEntry) => entry.slug;
  const id = (repo: DiscoveredRepo) => repo.id;
  const changed = after.entries.flatMap((entry) => {
    const old = before.entries.find((it) => it.slug === entry.slug);
    const fields = old ? changedFields(old, entry) : [];
    return old && fields.length ? [{ old, entry, fields }] : [];
  });
  const checksBefore = manualChecks(before);
  const checksAfter = manualChecks(after);
  const reasonsBefore = noQaReasons(before);
  const reasonsAfter = noQaReasons(after);
  return {
    unnamed,
    unmoved: named.filter((pr) => !moved.includes(pr)),
    lines: [
      ...moved.map(
        (pr) =>
          `#${pr} moved: ${was.get(pr)} -> ${is.get(pr)}${unnamed.includes(pr) ? ', and --moved does not name it' : ''}`
      ),
      ...missingFrom(before.entries, after.entries, slug).map(
        (entry) => `Entry removed: ${entryText(entry)}`
      ),
      ...missingFrom(after.entries, before.entries, slug).map(
        (entry) => `Entry added: ${entryText(entry)}`
      ),
      ...changed.map(({ old, entry, fields }) => {
        const now = entryText(entry);
        const then = entryText(old);
        return `Entry changed: ${then}${now === then ? '' : ` -> ${now}`}, in its ${fields.join(', ')}`;
      }),
      ...missingFrom(before.discovered, after.discovered, id).map(
        (repo) => `Discovered repo removed: ${code(repo.id)} ${repo.repo}`
      ),
      ...missingFrom(after.discovered, before.discovered, id).map(
        (repo) => `Discovered repo added: ${code(repo.id)} ${repo.repo}`
      ),
      ...missingFrom(checksBefore, checksAfter, String).map(
        (check) => `Manual check removed: ${check}`
      ),
      ...missingFrom(checksAfter, checksBefore, String).map(
        (check) => `Manual check added: ${check}`
      ),
      ...missingFrom(reasonsBefore, reasonsAfter, String).map(
        (reason) => `No-QA reason removed: ${reason}`
      ),
      ...missingFrom(reasonsAfter, reasonsBefore, String).map(
        (reason) => `No-QA reason added: ${reason}`
      ),
    ],
  };
};
