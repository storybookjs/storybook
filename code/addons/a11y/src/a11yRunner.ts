import { deprecate } from 'storybook/internal/client-logger';
import { ElementA11yParameterError } from 'storybook/internal/preview-errors';

import { global } from '@storybook/global';

import type { AxeResults, ContextProp, ContextSpec, Selector, SelectorList } from 'axe-core';
import { addons } from 'storybook/preview-api';

import { EVENTS } from './constants';
import type { A11yParameters, SelectorWithoutNode } from './params';

const { document } = global;

const channel = addons.getChannel();

const DEFAULT_PARAMETERS = { config: {}, options: {} } as const;

const DISABLED_RULES = [
  // In component testing, landmarks are not always present
  // and the rule check can cause false positives
  'region',
] as const;

// A simple queue to run axe-core in sequence
// This is necessary because axe-core is not designed to run in parallel
const queue: (() => Promise<void>)[] = [];
let isRunning = false;

const runNext = async () => {
  if (queue.length === 0) {
    isRunning = false;
    return;
  }

  isRunning = true;
  const next = queue.shift();
  if (next) {
    await next();
  }
  runNext();
};

export const run = async (input: A11yParameters = DEFAULT_PARAMETERS) => {
  const { default: axe } = await import('axe-core');

  const { config = {}, options = {} } = input;

  // @ts-expect-error - the whole point of this is to error if 'element' is passed
  if (input.element) {
    throw new ElementA11yParameterError();
  }

  const context: ContextSpec = {
    include: document?.body,
    exclude: ['.sb-wrapper', '#storybook-docs'], // Internal Storybook elements that are always in the document
  };

  if (input.context) {
    // 1. if context exists, but it's not an object with include or exclude, it's an implicit include to be used directly
    if (
      !(
        typeof input.context === 'object' &&
        ('include' in input.context || 'exclude' in input.context)
      )
    ) {
      context.include = input.context as ContextProp;
    } else if (typeof input.context === 'object' && 'include' in input.context) {
      // 2. if context.include exists, use it
      context.include = input.context.include as ContextProp;
    }

    // 3. if context.exclude exists, merge it with the default exclude
    if (
      typeof input.context === 'object' &&
      'exclude' in input.context &&
      input.context.exclude !== undefined
    ) {
      context.exclude = (DEFAULT_CONTEXT.exclude as any).concat(input.context.exclude);
    }
  }

  axe.reset();

  const configWithDefault = {
    ...config,
    rules: [...DISABLED_RULES.map((id) => ({ id, enabled: false })), ...(config?.rules ?? [])],
  };

  axe.configure(configWithDefault);

  return new Promise<AxeResults>((resolve, reject) => {
    const task = async () => {
      try {
        const result = await axe.run(context, options);
        resolve(result);
      } catch (error) {
        reject(error);
      }
    };

    queue.push(task);

    if (!isRunning) {
      runNext();
    }
  });
};

channel.on(EVENTS.MANUAL, async (storyId: string, input: A11yParameters = DEFAULT_PARAMETERS) => {
  try {
    const result = await run(input);
    // Axe result contains class instances, which telejson deserializes in a
    // way that violates:
    //  Content Security Policy directive: "script-src 'self' 'unsafe-inline'".
    const resultJson = JSON.parse(JSON.stringify(result));
    channel.emit(EVENTS.RESULT, resultJson, storyId);
  } catch (error) {
    channel.emit(EVENTS.ERROR, error);
  }
});
