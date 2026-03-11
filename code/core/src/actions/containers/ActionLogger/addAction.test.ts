import { describe, expect, it } from 'vitest';

import type { ActionDisplay } from '../../models';
import { computeAddAction } from './addAction';

function createAction(overrides: Partial<ActionDisplay> = {}): ActionDisplay {
  return {
    id: String(Math.random()),
    count: 0,
    data: { name: 'onClick', args: ['test'] },
    options: { limit: 3, clearOnStoryChange: true },
    ...overrides,
  };
}

describe('computeAddAction', () => {
  it('adds a new action with count 1', () => {
    const action = createAction({ id: '1' });
    const result = computeAddAction([], action);

    expect(result).toHaveLength(1);
    expect(result[0].count).toBe(1);
    expect(result[0].id).toBe('1');
  });

  it('increments count when consecutive actions have the same data', () => {
    const action1 = createAction({ id: '1', data: { name: 'onClick', args: ['a'] } });
    const action2 = createAction({ id: '2', data: { name: 'onClick', args: ['a'] } });

    const state1 = computeAddAction([], action1);
    const state2 = computeAddAction(state1, action2);

    expect(state2).toHaveLength(1);
    expect(state2[0].count).toBe(2);
  });

  it('does not mutate the input action objects', () => {
    const action1 = createAction({ id: '1', data: { name: 'onClick', args: ['a'] } });
    const state1 = computeAddAction([], action1);

    expect(action1.count).toBe(0);

    const action2 = createAction({ id: '2', data: { name: 'onClick', args: ['a'] } });
    computeAddAction(state1, action2);

    expect(action1.count).toBe(0);
    expect(action2.count).toBe(0);
    expect(state1[0].count).toBe(1);
  });

  it('does not mutate the previous state array', () => {
    const action1 = createAction({ id: '1', data: { name: 'first', args: ['1'] } });
    const state1 = computeAddAction([], action1);
    const originalState1 = [...state1];

    const action2 = createAction({ id: '2', data: { name: 'second', args: ['2'] } });
    computeAddAction(state1, action2);

    expect(state1).toEqual(originalState1);
  });

  it('retains newest actions when limit is reached, not oldest', () => {
    const action1 = createAction({
      id: '1',
      data: { name: 'first', args: ['1'] },
      options: { limit: 2, clearOnStoryChange: true },
    });
    const action2 = createAction({
      id: '2',
      data: { name: 'second', args: ['2'] },
      options: { limit: 2, clearOnStoryChange: true },
    });
    const action3 = createAction({
      id: '3',
      data: { name: 'third', args: ['3'] },
      options: { limit: 2, clearOnStoryChange: true },
    });

    let state = computeAddAction([], action1);
    state = computeAddAction(state, action2);
    state = computeAddAction(state, action3);

    expect(state).toHaveLength(2);
    expect(state[0].data.name).toBe('second');
    expect(state[1].data.name).toBe('third');
  });

  it('respects limit even when incrementing count on the last action', () => {
    const action1 = createAction({
      id: '1',
      data: { name: 'first', args: ['1'] },
      options: { limit: 2, clearOnStoryChange: true },
    });
    const action2 = createAction({
      id: '2',
      data: { name: 'second', args: ['2'] },
      options: { limit: 2, clearOnStoryChange: true },
    });
    const action3 = createAction({
      id: '3',
      data: { name: 'second', args: ['2'] },
      options: { limit: 2, clearOnStoryChange: true },
    });

    let state = computeAddAction([], action1);
    state = computeAddAction(state, action2);
    state = computeAddAction(state, action3);

    expect(state).toHaveLength(2);
    expect(state[1].data.name).toBe('second');
    expect(state[1].count).toBe(2);
  });

  it('adds distinct actions as separate entries', () => {
    const action1 = createAction({ id: '1', data: { name: 'click', args: ['a'] } });
    const action2 = createAction({ id: '2', data: { name: 'hover', args: ['b'] } });

    let state = computeAddAction([], action1);
    state = computeAddAction(state, action2);

    expect(state).toHaveLength(2);
    expect(state[0].data.name).toBe('click');
    expect(state[1].data.name).toBe('hover');
  });

  it('falls back to default limit of 50 when limit is undefined', () => {
    const actions: ActionDisplay[] = [];
    let state = actions;

    for (let i = 0; i < 55; i++) {
      state = computeAddAction(
        state,
        createAction({
          id: String(i),
          data: { name: `action-${i}`, args: [i] },
          options: { clearOnStoryChange: true },
        }),
      );
    }

    expect(state).toHaveLength(50);
    expect(state[0].data.name).toBe('action-5');
    expect(state[49].data.name).toBe('action-54');
  });
});
