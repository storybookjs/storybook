/* eslint-disable no-param-reassign, no-underscore-dangle */
/// <reference types="node" />
import { addons } from '@storybook/preview-api';
import { global } from '@storybook/global';
import { FORCE_REMOUNT, STORY_RENDER_PHASE_CHANGED } from '@storybook/core-events';
import type {
  Renderer,
  ArgsEnhancer,
  PlayFunction,
  PlayFunctionContext,
  StepLabel,
  Args,
} from '@storybook/types';
import { instrument } from '@storybook/instrumenter';
import { ModuleMocker } from 'jest-mock';

const JestMock = new ModuleMocker(global);
const fn = JestMock.fn.bind(JestMock);

// Aliasing `fn` to `action` here, so we get a more descriptive label in the UI.
const { action } = instrument({ action: fn }, { retain: true });
const channel = addons.getChannel();
const seen = new Set<any>();
const spies: any[] = [];

channel.on(FORCE_REMOUNT, () => spies.forEach((mock) => mock?.mockClear?.()));
channel.on(STORY_RENDER_PHASE_CHANGED, ({ newPhase }) => {
  if (newPhase === 'loading') spies.forEach((mock) => mock?.mockClear?.());
});

const addSpies = (id: string, val: any, key?: string): any => {
  if (seen.has(val)) return val;
  seen.add(val);
  try {
    if (Object.prototype.toString.call(val) === '[object Object]') {
      // We have to mutate the original object for this to survive HMR.
      // eslint-disable-next-line no-restricted-syntax
      for (const [k, v] of Object.entries(val)) val[k] = addSpies(id, v, k);
      return val;
    }
    if (Array.isArray(val)) {
      return val.map((item, index) => addSpies(id, item, `${key}[${index}]`));
    }
    if (typeof val === 'function' && val.isAction && !val._isMockFunction) {
      Object.defineProperty(val, 'name', { value: key, writable: false });
      Object.defineProperty(val, '__storyId__', { value: id, writable: false });
      const spy = action(val);
      spies.push(spy);
      return spy;
    }
  } catch (e) {
    // ignore
  }
  return val;
};

const addActionsFromArgTypes: ArgsEnhancer<Renderer> = ({ id, initialArgs }) =>
  addSpies(id, initialArgs);

const instrumentSpies: ArgsEnhancer = ({ initialArgs }) => {
  const argTypesWithAction = Object.entries(initialArgs).filter(
    ([, value]) =>
      typeof value === 'function' &&
      '_isMockFunction' in value &&
      value._isMockFunction &&
      !value._instrumented
  );

  return argTypesWithAction.reduce((acc, [key, value]) => {
    const instrumented = instrument({ [key]: () => value }, { retain: true })[key];
    acc[key] = instrumented();
    // this enhancer is being called multiple times
    value._instrumented = true;
    return acc;
  }, {} as Args);
};

export const argsEnhancers = [addActionsFromArgTypes, instrumentSpies];

export const { step: runStep } = instrument(
  {
    step: (label: StepLabel, play: PlayFunction, context: PlayFunctionContext<any>) =>
      play(context),
  },
  { intercept: true }
);

export const parameters = {
  throwPlayFunctionExceptions: false,
};
