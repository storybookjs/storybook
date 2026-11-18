import { describe, expect, it } from 'vitest';

import { planOfPush } from './plan-push.ts';

const diff = (...lines: string[]) => `${lines.join('\n')}\n`;

describe('planOfPush', () => {
  it.each([
    ['an added plan', diff('A\tecosystem-qa/plans/11.0.md')],
    ['a changed plan', diff('M\tecosystem-qa/plans/11.0.md')],
    ['a plan that was a link before', diff('T\tecosystem-qa/plans/11.0.md')],
    [
      'a plan renamed with changes',
      diff('R087\tecosystem-qa/plans/draft.md\tecosystem-qa/plans/11.0.md'),
    ],
    [
      'an added plan next to a deleted one',
      diff('D\tecosystem-qa/plans/10.6.md', 'A\tecosystem-qa/plans/11.0.md'),
    ],
  ])('runs %s', (_, nameStatus) => {
    expect(planOfPush(nameStatus)).toEqual({ kind: 'run', file: 'ecosystem-qa/plans/11.0.md' });
  });

  it('ends the run on two plans and names both', () => {
    expect(
      planOfPush(diff('A\tecosystem-qa/plans/11.0.md', 'M\tecosystem-qa/plans/10.6.md'))
    ).toEqual({
      kind: 'error',
      reason:
        'The push adds or changes 2 plans, ecosystem-qa/plans/11.0.md, ecosystem-qa/plans/10.6.md. Push one plan at a time.',
    });
  });

  it('skips a deletion and a pure rename, whose text has run already', () => {
    expect(planOfPush(diff('D\tecosystem-qa/plans/11.0.md'))).toEqual({
      kind: 'skip',
      reason: 'The push only deletes or renames plans: ecosystem-qa/plans/11.0.md.',
    });
    expect(
      planOfPush(diff('R100\tecosystem-qa/plans/draft.md\tecosystem-qa/plans/11.0.md'))
    ).toMatchObject({ kind: 'skip' });
  });

  it.each([
    ['a letter git prints as is with core.quotePath off', 'ecosystem-qa/plans/café.md'],
    ['a quote, which git quotes', '"ecosystem-qa/plans/a\\"b.md"'],
    ['a space', 'ecosystem-qa/plans/11 0.md'],
    ['a folder', 'ecosystem-qa/plans/drafts/11.0.md'],
  ])('ends the run on a plan whose name has %s, and names it', (_, path) => {
    expect(planOfPush(diff(`A\t${path}`, 'M\tecosystem-qa/plans/10.6.md'))).toEqual({
      kind: 'error',
      reason: `The push adds or changes ${path}, whose name is not the name of a plan, so no sweep starts. A plan is a file in ecosystem-qa/plans/ whose name has only letters, digits, dots, underscores and hyphens and ends in .md.`,
    });
  });

  it('skips a push without a plan', () => {
    const none = { kind: 'skip', reason: 'The push adds or changes no plan.' };

    expect(planOfPush('')).toEqual(none);
    expect(planOfPush(diff('A\tecosystem-qa/plans/README.txt', 'M\tecosystem-qa/run.ts'))).toEqual(
      none
    );
    expect(planOfPush(diff('D\tecosystem-qa/plans/café.md'))).toEqual(none);
  });
});
