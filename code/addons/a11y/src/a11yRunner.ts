import { ElementA11yParameterError } from 'storybook/internal/preview-errors';

import { global } from '@storybook/global';

import type { AxeResults, ContextProp, ContextSpec } from 'axe-core';
import { addons, waitForAnimations } from 'storybook/preview-api';

import { withLinkPaths } from './a11yRunnerUtils';
import { EVENTS } from './constants';
import type { A11yParameters } from './params';

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

export const run = async (input: A11yParameters = DEFAULT_PARAMETERS, storyId: string) => {
  const axeCore = await import('axe-core');
  // We do this workaround when Vite projects can't optimize deps in pnpm projects
  // as axe-core is UMD and therefore won't resolve.
  // In that case, we just use the global axe (which will be there as a side effect of UMD import).
  const axe = axeCore?.default || (globalThis as any).axe;

  const { config = {}, options = {} } = input;

  // @ts-expect-error - the whole point of this is to error if 'element' is passed
  if (input.element) {
    throw new ElementA11yParameterError();
  }

  const context: ContextSpec = {
    include: document?.body,
    exclude: ['.sb-wrapper', '#storybook-docs', '#storybook-highlights-root'], // Internal Storybook elements that are always in the document
  };

  if (input.context) {
    const hasInclude =
      typeof input.context === 'object' &&
      'include' in input.context &&
      input.context.include !== undefined;
    const hasExclude =
      typeof input.context === 'object' &&
      'exclude' in input.context &&
      input.context.exclude !== undefined;

    // 1. if context.include exists, use it
    if (hasInclude) {
      context.include = (input.context as any).include as ContextProp;
    } else if (!hasInclude && !hasExclude) {
      // 2. if context exists, but it's not an object with include or exclude, it's an implicit include to be used directly
      context.include = input.context as ContextProp;
    }

    // 3. if context.exclude exists, merge it with the default exclude
    if (hasExclude) {
      context.exclude = (context.exclude as any).concat((input.context as any).exclude);
    }
  }

  axe.reset();

  const configWithDefault = {
    ...config,
    rules: [...DISABLED_RULES.map((id) => ({ id, enabled: false })), ...(config?.rules ?? [])],
  };

  axe.configure(configWithDefault);

  return new Promise<AxeResults>((resolve, reject) => {
    const highlightsRoot = document?.getElementById('storybook-highlights-root');
    if (highlightsRoot) {
      highlightsRoot.style.display = 'none';
    }

    const task = async () => {
      try {
        const result = await axe.run(context, options);
        const resultWithLinks = withLinkPaths(result, storyId);
        resolve(resultWithLinks);
      } catch (error) {
        reject(error);
      }
    };

    queue.push(task);

    if (!isRunning) {
      runNext();
    }

    if (highlightsRoot) {
      highlightsRoot.style.display = '';
    }
  });
};

channel.on(EVENTS.MANUAL, async (storyId: string, input: A11yParameters = DEFAULT_PARAMETERS) => {
  try {
    await waitForAnimations();
    const result = await run(input, storyId);
    // Axe result contains class instances, which telejson deserializes in a
    // way that violates:
    //  Content Security Policy directive: "script-src 'self' 'unsafe-inline'".
    const resultJson = JSON.parse(JSON.stringify(result));
    channel.emit(EVENTS.RESULT, resultJson, storyId);
  } catch (error) {
    channel.emit(EVENTS.ERROR, error);
  }
});
