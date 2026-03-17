import { describe, expect, it } from 'vitest';

import type { ActionDisplay } from '../../models';

import { addAction } from './actionUtils';

const createAction = (
  name: string,
  args: any[],
  options: Partial<ActionDisplay['options']> = {}
): ActionDisplay => ({
  id: `action-${Date.now()}-${Math.random()}`,
  data: { name, args },
  count: 0,
  options: {
    limit: 10,
    clearOnStoryChange: true,
    ...options,
  },
});

describe('ActionLogger - addAction logic', () => {
  describe('adding new actions', () => {
    it('should add a new action to empty list', () => {
      const action = createAction('click', ['button']);
      const result = addAction([], action);

      expect(result).toHaveLength(1);
      expect(result[0].count).toBe(1);
      expect(result[0].data.name).toBe('click');
    });

    it('should add multiple different actions', () => {
      const action1 = createAction('click', ['button']);
      const action2 = createAction('focus', ['input']);
      const action3 = createAction('change', ['input', 'value']);

      let result = addAction([], action1);
      result = addAction(result, action2);
      result = addAction(result, action3);

      expect(result).toHaveLength(3);
    });
  });

  describe('incrementing count for same actions', () => {
    it('should increment count when same action is added consecutively', () => {
      const action = createAction('click', ['button']);
      const action2 = createAction('click', ['button']);

      let result = addAction([], action);
      result = addAction(result, action2);

      expect(result).toHaveLength(1);
      expect(result[0].count).toBe(2);
    });

    it('should increment count multiple times', () => {
      const action = createAction('click', ['button']);

      let result = addAction([], action);
      result = addAction(result, createAction('click', ['button']));
      result = addAction(result, createAction('click', ['button']));
      result = addAction(result, createAction('click', ['button']));

      expect(result).toHaveLength(1);
      expect(result[0].count).toBe(4);
    });

    it('should not increment count for different actions', () => {
      const action1 = createAction('click', ['button']);
      const action2 = createAction('click', ['button2']); // different args

      let result = addAction([], action1);
      result = addAction(result, action2);

      expect(result).toHaveLength(2);
      expect(result[0].count).toBe(1);
      expect(result[1].count).toBe(1);
    });
  });

  describe('immutability', () => {
    it('should not mutate the incoming action object', () => {
      const originalAction = createAction('click', ['button']);
      const originalCount = originalAction.count;

      addAction([], originalAction);

      expect(originalAction.count).toBe(originalCount);
    });

    it('should not mutate previous actions in state', () => {
      const action1 = createAction('click', ['button']);
      const action2 = createAction('focus', ['input']);

      let result = addAction([], action1);
      const firstResultSnapshot = [...result];
      result = addAction(result, action2);

      // Original first action should not be mutated
      expect(firstResultSnapshot[0].count).toBe(1);
    });
  });

  describe('limit behavior', () => {
    it('should retain newest actions when limit is reached', () => {
      const limit = 3;
      const actions = [
        createAction('click', ['1'], { limit }),
        createAction('click', ['2'], { limit }),
        createAction('click', ['3'], { limit }),
        createAction('click', ['4'], { limit }), // This should push out '1'
      ];

      let result: ActionDisplay[] = [];
      actions.forEach((action) => {
        result = addAction(result, action);
      });

      expect(result).toHaveLength(3);
      // Should keep the newest 3: ['2', '3', '4']
      expect(result.map((a) => a.data.args[0])).toEqual(['2', '3', '4']);
    });

    it('should handle limit of 1', () => {
      const limit = 1;
      const action1 = createAction('click', ['first'], { limit });
      const action2 = createAction('click', ['second'], { limit });

      let result = addAction([], action1);
      result = addAction(result, action2);

      expect(result).toHaveLength(1);
      expect(result[0].data.args[0]).toBe('second');
    });

    it('should still apply limit when incrementing count', () => {
      const limit = 2;
      const action1 = createAction('click', ['1'], { limit });
      const action2 = createAction('click', ['2'], { limit });
      const action3 = createAction('click', ['2'], { limit }); // Same as action2

      let result: ActionDisplay[] = [];
      result = addAction(result, action1);
      result = addAction(result, action2);
      result = addAction(result, action3);

      expect(result).toHaveLength(2);
      // Should keep ['click 2' (count: 2)] since action1 was pushed out
      expect(result.map((a) => a.data.args[0])).toEqual(['2']);
      expect(result[0].count).toBe(2);
    });
  });
});
