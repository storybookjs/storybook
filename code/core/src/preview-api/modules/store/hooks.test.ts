import { beforeEach, describe, expect, it, vi } from 'vitest';

import type { DecoratorFunction, StoryContext } from '@storybook/core/types';

import {
  FORCE_RE_RENDER,
  RESET_STORY_ARGS,
  STORY_RENDERED,
  UPDATE_GLOBALS,
  UPDATE_STORY_ARGS,
} from '@storybook/core/core-events';

import {
  HooksContext,
  addons,
  applyHooks,
  useArgs,
  useCallback,
  useChannel,
  useEffect,
  useGlobals,
  useMemo,
  useParameter,
  useReducer,
  useRef,
  useState,
  useStoryContext,
} from '../addons';
import { defaultDecorateStory } from './decorators';

vi.mock('@storybook/core/client-logger', () => ({
  logger: { warn: vi.fn(), log: vi.fn() },
}));

const SOME_EVENT = 'someEvent';
let mockChannel: any;
let hooks: any;
let onSomeEvent: any;
let removeSomeEventListener: any;
beforeEach(() => {
  onSomeEvent = vi.fn();
  removeSomeEventListener = vi.fn();
  mockChannel = {
    emit: vi.fn(),
    on(event: any, callback: any) {
      switch (event) {
        case STORY_RENDERED:
          callback();
          break;
        case SOME_EVENT:
          onSomeEvent(event, callback);
          break;
        default:
      }
    },
    removeListener(event: any, callback: any) {
      if (event === SOME_EVENT) {
        removeSomeEventListener(event, callback);
      }
    },
  };
  hooks = new HooksContext();
  addons.setChannel(mockChannel);
});

const decorateStory = applyHooks(defaultDecorateStory);

const run = (storyFn: any, decorators: DecoratorFunction[] = [], context = {}) =>
  decorateStory(storyFn, decorators)({ ...context, hooks } as StoryContext);

describe('Preview hooks', () => {
  describe('useEffect', () => {
    it('triggers the effect from story function', () => {
      const effect = vi.fn();
      run(() => {
        useEffect(effect);
      });
      expect(effect).toHaveBeenCalledTimes(1);
    });
    it('triggers the effect from decorator', () => {
      const effect = vi.fn();
      run(() => {}, [
        (storyFn) => {
          useEffect(effect);
          return storyFn();
        },
      ]);
      expect(effect).toHaveBeenCalledTimes(1);
    });
    it('triggers the effect from decorator if story call comes before useEffect', () => {
      const effect = vi.fn();
      run(() => {}, [
        (storyFn) => {
          const story = storyFn();
          useEffect(effect);
          return story;
        },
      ]);
      expect(effect).toHaveBeenCalledTimes(1);
    });
    it('retriggers the effect if no deps array is provided', () => {
      const effect = vi.fn();
      const storyFn = () => {
        useEffect(effect);
      };
      run(storyFn);
      run(storyFn);
      expect(effect).toHaveBeenCalledTimes(2);
    });
    it("doesn't retrigger the effect if empty deps array is provided", () => {
      const effect = vi.fn();
      const storyFn = () => {
        useEffect(effect, []);
      };
      run(storyFn);
      run(storyFn);
      expect(effect).toHaveBeenCalledTimes(1);
    });
    it("doesn't retrigger the effect from decorator if story has changed", () => {
      const effect = vi.fn();
      const decorator = (storyFn: any) => {
        useEffect(effect, []);
        return storyFn();
      };
      run(() => {}, [decorator]);
      run(() => {}, [decorator]);
      expect(effect).toHaveBeenCalledTimes(1);
    });
    it("doesn't retrigger the effect from decorator if story has changed and story call comes before useEffect", () => {
      const effect = vi.fn();
      const decorator = (storyFn: any) => {
        const story = storyFn();
        useEffect(effect, []);
        return story;
      };
      run(() => {}, [decorator]);
      run(() => {}, [decorator]);
      expect(effect).toHaveBeenCalledTimes(1);
    });
    it("doesn't retrigger the effect from if decorator calls story twice", () => {
      const effect = vi.fn();
      const story = () => {
        useEffect(effect, []);
      };
      const decorator = (storyFn: any) => {
        storyFn();
        return storyFn();
      };
      run(story, [decorator]);
      expect(effect).toHaveBeenCalledTimes(1);
    });
    it('handles decorator conditionally rendering the story', () => {
      const effect = vi.fn();
      const story = () => {
        useEffect(effect, []);
      };
      const decorator = (storyFn: any) => {
        const [counter, setCounter] = useState(0);
        useEffect(() => {
          setCounter((prevCounter) => prevCounter + 1);
        }, [counter]);
        if (counter % 2 === 1) storyFn();
        return 'placeholder while waiting';
      };
      run(story, [decorator]);
      run(story, [decorator]);
      run(story, [decorator]);
      run(story, [decorator]);
      expect(effect).toHaveBeenCalledTimes(2);
    });
    it('retriggers the effect if some of the deps are changed', () => {
      const effect = vi.fn();
      let counter = 0;
      const storyFn = () => {
        useEffect(effect, [counter]);
        counter += 1;
      };
      run(storyFn);
      run(storyFn);
      expect(effect).toHaveBeenCalledTimes(2);
    });
    it("doesn't retrigger the effect if none of the deps are changed", () => {
      const effect = vi.fn();
      const storyFn = () => {
        useEffect(effect, [0]);
      };
      run(storyFn);
      run(storyFn);
      expect(effect).toHaveBeenCalledTimes(1);
    });
    it('performs cleanup when retriggering', () => {
      const destroy = vi.fn();
      const storyFn = () => {
        useEffect(() => destroy);
      };
      run(storyFn);
      run(storyFn);
      expect(destroy).toHaveBeenCalledTimes(1);
    });
    it("doesn't perform cleanup when keeping the current effect", () => {
      const destroy = vi.fn();
      const storyFn = () => {
        useEffect(() => destroy, []);
      };
      run(storyFn);
      run(storyFn);
      expect(destroy).not.toHaveBeenCalled();
    });
    it('performs cleanup when removing the decorator', () => {
      const destroy = vi.fn();
      run(() => {}, [
        (storyFn) => {
          useEffect(() => destroy);
          return storyFn();
        },
      ]);
      run(() => {});
      expect(destroy).toHaveBeenCalledTimes(1);
    });
  });
  describe('useChannel', () => {
    it('calls .on when rendering the decorator', () => {
      const handler = () => {};
      run(() => {}, [
        (storyFn) => {
          useChannel({
            [SOME_EVENT]: handler,
          });
          return storyFn();
        },
      ]);
      expect(onSomeEvent).toHaveBeenCalledTimes(1);
      expect(removeSomeEventListener).toHaveBeenCalledTimes(0);
    });
    it('calls .removeListener when removing the decorator', () => {
      const handler = () => {};
      run(() => {}, [
        (storyFn) => {
          useChannel({
            [SOME_EVENT]: handler,
          });
          return storyFn();
        },
      ]);
      expect(onSomeEvent).toHaveBeenCalledTimes(1);
      expect(removeSomeEventListener).toHaveBeenCalledTimes(0);
      run(() => {});
      expect(removeSomeEventListener).toHaveBeenCalledTimes(1);
    });
  });
  describe('useStoryContext', () => {
    it('returns current context', () => {
      const context = {};
      run(
        () => {
          expect(useStoryContext()).toEqual({ ...context, hooks });
        },
        [],
        context
      );
    });
  });
  describe('useParameter', () => {
    it('will pull value from storyStore', () => {
      run(
        () => {},
        [
          (storyFn) => {
            expect(useParameter('foo', 4)).toEqual(42);
            return storyFn();
          },
        ],
        { parameters: { foo: 42 } }
      );
    });
    it('will return default value', () => {
      run(
        () => {},
        [
          (storyFn) => {
            expect(useParameter('bar', 4)).toEqual(4);
            return storyFn();
          },
        ],
        { parameters: {} }
      );
    });
    it('will return undefined when no value is found', () => {
      run(
        () => {},
        [
          (storyFn) => {
            expect(useParameter('bar')).toBe(undefined);
            return storyFn();
          },
        ],
        { parameters: {} }
      );
    });
  });
  describe('useMemo', () => {
    it('performs the calculation', () => {
      let result;
      const nextCreate = vi.fn(() => 'foo');
      const storyFn = () => {
        result = useMemo(nextCreate, []);
      };
      run(storyFn);
      expect(nextCreate).toHaveBeenCalledTimes(1);
      expect(result).toBe('foo');
    });
    it('performs the calculation once if deps are unchanged', () => {
      let result;
      const nextCreate = vi.fn(() => 'foo');
      const storyFn = () => {
        result = useMemo(nextCreate, []);
      };
      run(storyFn);
      run(storyFn);
      expect(nextCreate).toHaveBeenCalledTimes(1);
      expect(result).toBe('foo');
    });
    it('performs the calculation again if deps are changed', () => {
      let result;
      let counter = 0;
      const nextCreate = vi.fn(() => counter);
      const storyFn = () => {
        counter += 1;
        result = useMemo(nextCreate, [counter]);
      };
      run(storyFn);
      run(storyFn);
      expect(nextCreate).toHaveBeenCalledTimes(2);
      expect(result).toBe(counter);
    });
  });
  describe('useCallback', () => {
    it('returns the callback', () => {
      let result;
      const callback = () => {};
      const storyFn = () => {
        result = useCallback(callback, []);
      };
      run(storyFn);
      expect(result).toBe(callback);
    });
    it('returns the previous callback reference if deps are unchanged', () => {
      const callbacks: (() => void)[] = [];
      const storyFn = () => {
        const callback = useCallback(() => {}, []);
        callbacks.push(callback);
      };
      run(storyFn);
      run(storyFn);
      expect(callbacks[0]).toBe(callbacks[1]);
    });
    it('creates new callback reference if deps are changed', () => {
      const callbacks: (() => void)[] = [];
      let counter = 0;
      const storyFn = () => {
        counter += 1;
        const callback = useCallback(() => {}, [counter]);
        callbacks.push(callback);
      };
      run(storyFn);
      run(storyFn);
      expect(callbacks[0]).not.toBe(callbacks[1]);
    });
  });
  describe('useRef', () => {
    it('attaches initial value', () => {
      let ref: any;
      const storyFn = () => {
        ref = useRef('foo');
      };
      run(storyFn);
      expect(ref.current).toBe('foo');
    });
    it('stores mutations', () => {
      let refValueFromSecondRender;
      let counter = 0;
      const storyFn = () => {
        counter += 1;
        const ref = useRef('foo');

        if (counter === 1) {
          ref.current = 'bar';
        } else {
          refValueFromSecondRender = ref.current;
        }
      };
      run(storyFn);
      run(storyFn);
      expect(refValueFromSecondRender).toBe('bar');
    });
  });
  describe('useState', () => {
    it('sets initial state', () => {
      let state;
      const storyFn = () => {
        [state] = useState('foo');
      };
      run(storyFn);
      expect(state).toBe('foo');
    });
    it('calculates initial state', () => {
      let state;
      const storyFn = () => {
        [state] = useState(() => 'foo');
      };
      run(storyFn);
      expect(state).toBe('foo');
    });
    it('performs synchronous state updates', () => {
      let state;
      let setState;
      const storyFn = vi.fn(() => {
        [state, setState] = useState('foo');
        if (state === 'foo') {
          setState('bar');
        }
      });
      run(storyFn);
      expect(storyFn).toHaveBeenCalledTimes(2);
      expect(state).toBe('bar');
    });
    it('triggers only the last effect when updating state synchronously', () => {
      const effects = [vi.fn(), vi.fn()];
      const storyFn = vi.fn(() => {
        const [effectIndex, setEffectIndex] = useState(0);
        useEffect(effects[effectIndex], [effectIndex]);
        if (effectIndex === 0) {
          setEffectIndex(1);
        }
      });
      run(storyFn);
      expect(effects[0]).not.toHaveBeenCalled();
      expect(effects[1]).toHaveBeenCalledTimes(1);
    });
    it('performs synchronous state updates with updater function', () => {
      let state;
      let setState;
      const storyFn = vi.fn(() => {
        [state, setState] = useState(0);
        if (state < 3) {
          setState((prevState) => prevState + 1);
        }
      });
      run(storyFn);
      expect(storyFn).toHaveBeenCalledTimes(4);
      expect(state).toBe(3);
    });
    it('performs asynchronous state updates', () => {
      let state;
      let setState: any;
      const storyFn = vi.fn(() => {
        [state, setState] = useState('foo');
      });
      run(storyFn);
      setState('bar');
      expect(mockChannel.emit).toHaveBeenCalledWith(FORCE_RE_RENDER);
      run(storyFn);
      expect(state).toBe('bar');
    });
  });
  describe('useReducer', () => {
    it('sets initial state', () => {
      let state;
      const storyFn = () => {
        [state] = useReducer(() => 'bar', 'foo');
      };
      run(storyFn);
      expect(state).toBe('foo');
    });
    it('calculates initial state', () => {
      let state;
      const storyFn = () => {
        [state] = useReducer(
          () => 'bar',
          'foo',
          (arg) => arg
        );
      };
      run(storyFn);
      expect(state).toBe('foo');
    });
    it('performs synchronous state updates', () => {
      let state;
      let dispatch;
      const storyFn = vi.fn(() => {
        [state, dispatch] = useReducer((prevState, action) => {
          switch (action) {
            case 'INCREMENT':
              return prevState + 1;
            default:
              return prevState;
          }
        }, 0);
        if (state < 3) {
          dispatch('INCREMENT');
        }
      });
      run(storyFn);
      expect(storyFn).toHaveBeenCalledTimes(4);
      expect(state).toBe(3);
    });
    it('performs asynchronous state updates', () => {
      let state: any;
      let dispatch: any;
      const storyFn = vi.fn(() => {
        [state, dispatch] = useReducer((prevState, action) => {
          switch (action) {
            case 'INCREMENT':
              return prevState + 1;
            default:
              return prevState;
          }
        }, 0);
      });
      run(storyFn);
      dispatch('INCREMENT');
      expect(mockChannel.emit).toHaveBeenCalledWith(FORCE_RE_RENDER);
      run(storyFn);
      expect(state).toBe(1);
    });
  });
  describe('useArgs', () => {
    it('will pull args from context', () => {
      run(
        () => {},
        [
          (storyFn) => {
            expect(useArgs()[0]).toEqual({ a: 'b' });
            return storyFn();
          },
        ],
        { args: { a: 'b' } }
      );
    });
    it('will emit UPDATE_STORY_ARGS when called', () => {
      run(
        () => {},
        [
          (storyFn) => {
            useArgs()[1]({ a: 'b' });
            expect(mockChannel.emit).toHaveBeenCalledWith(UPDATE_STORY_ARGS, {
              storyId: '1',
              updatedArgs: { a: 'b' },
            });
            return storyFn();
          },
        ],
        { id: '1', args: {} }
      );
    });
    it('will emit RESET_STORY_ARGS when called', () => {
      run(
        () => {},
        [
          (storyFn) => {
            useArgs()[2](['a']);
            expect(mockChannel.emit).toHaveBeenCalledWith(RESET_STORY_ARGS, {
              storyId: '1',
              argNames: ['a'],
            });
            useArgs()[2]();
            expect(mockChannel.emit).toHaveBeenCalledWith(RESET_STORY_ARGS, {
              storyId: '1',
            });
            return storyFn();
          },
        ],
        { id: '1', args: {} }
      );
    });
  });

  describe('useGlobals', () => {
    it('will pull globals from context', () => {
      run(
        () => {},
        [
          (storyFn) => {
            expect(useGlobals()[0]).toEqual({ a: 'b' });
            return storyFn();
          },
        ],
        { globals: { a: 'b' } }
      );
    });
    it('will emit UPDATE_GLOBALS when called', () => {
      run(
        () => {},
        [
          (storyFn) => {
            useGlobals()[1]({ a: 'b' });
            expect(mockChannel.emit).toHaveBeenCalledWith(UPDATE_GLOBALS, { globals: { a: 'b' } });
            return storyFn();
          },
        ],
        { globals: {} }
      );
    });
  });
});
