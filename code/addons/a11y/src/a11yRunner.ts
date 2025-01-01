import { addons } from 'storybook/internal/preview-api';

import { global } from '@storybook/global';

import type { AxeResults } from 'axe-core';

import { EVENTS } from './constants';
import type { A11yParameters } from './params';

const { document } = global;

const channel = addons.getChannel();

const defaultParameters = { config: {}, options: {} };

const disabledRules = [
  // In component testing, landmarks are not always present
  // and the rule check can cause false positives
  'region',
];

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

export const run = async (input: A11yParameters = defaultParameters) => {
  const { default: axe } = await import('axe-core');

  const { element = '#storybook-root', config = {}, options = {} } = input;
  const htmlElement = document.querySelector(element as string) ?? document.body;

  if (!htmlElement) {
    return;
  }

  axe.reset();

  const configWithDefault = {
    ...config,
    rules: [...disabledRules.map((id) => ({ id, enabled: false })), ...(config?.rules ?? [])],
  };

  axe.configure(configWithDefault);

  return new Promise<AxeResults>((resolve, reject) => {
    const task = async () => {
      try {
        const result = await axe.run(htmlElement, options);
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

channel.on(EVENTS.MANUAL, async (storyId: string, input: A11yParameters = defaultParameters) => {
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
