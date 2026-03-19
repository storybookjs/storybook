import { describe, expect, it } from 'vitest';

import type { ActionDisplay } from '../../models';
import { applyActionToList } from './index';

const makeAction = (id: string, args: any[], limit = 50): ActionDisplay => ({
  id,
  count: 0,
  data: { name: 'onClick', args },
  options: { limit },
});

describe('applyActionToList', () => {
  it('keeps the most recent actions when the limit is reached', () => {
    const limit = 2;
    const first = makeAction('1', [1], limit);
    const second = makeAction('2', [2], limit);
    const third = makeAction('3', [3], limit);

    const next = applyActionToList(applyActionToList(applyActionToList([], first), second), third);

    expect(next).toHaveLength(2);
    expect(next.map((entry) => entry.id)).toEqual(['2', '3']);
  });

  it('increments count immutably when the latest action data matches', () => {
    const previous = { ...makeAction('1', ['same']), count: 1 };
    const incoming = makeAction('2', ['same']);

    const next = applyActionToList([previous], incoming);

    expect(next).toHaveLength(1);
    expect(next[0]).not.toBe(previous);
    expect(next[0]).toMatchObject({ id: '1', count: 2 });
    expect(previous.count).toBe(1);
  });
});
