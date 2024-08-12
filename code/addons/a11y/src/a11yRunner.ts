import { addons } from 'storybook/internal/preview-api';

import { global } from '@storybook/global';

import { EVENTS } from './constants';
import type { A11yParameters } from './params';

const { document } = global;

const channel = addons.getChannel();
// Holds axe core running state
let active = false;
// Holds latest story we requested a run
let activeStoryId: string | undefined;

const defaultParameters = { config: {}, options: {} };

/**
 * Handle A11yContext events.
 * Because the event are sent without manual check, we split calls
 */
const handleRequest = async (storyId: string, input: A11yParameters | null) => {
  if (!input?.manual) {
    await run(storyId, input ?? defaultParameters);
  }
};

const run = async (storyId: string, input: A11yParameters = defaultParameters) => {
  activeStoryId = storyId;
  try {
    if (!active) {
      active = true;
      channel.emit(EVENTS.RUNNING);
      const { default: axe } = await import('axe-core');

      const { element = '#storybook-root', config, options = {} } = input;
      const htmlElement = document.querySelector(element as string);

      if (!htmlElement) {
        return;
      }

      axe.reset();
      if (config) {
        axe.configure(config);
      }

      const result = await axe.run(htmlElement, options);

      // Axe result contains class instances, which telejson deserializes in a
      // way that violates:
      //  Content Security Policy directive: "script-src 'self' 'unsafe-inline'".
      const resultJson = JSON.parse(JSON.stringify(result));

      // It's possible that we requested a new run on a different story.
      // Unfortunately, axe doesn't support a cancel method to abort current run.
      // We check if the story we run against is still the current one,
      // if not, trigger a new run using the current story
      if (activeStoryId === storyId) {
        channel.emit(EVENTS.RESULT, resultJson);
      } else {
        active = false;
        run(activeStoryId);
      }
    }
  } catch (error) {
    channel.emit(EVENTS.ERROR, error);
  } finally {
    active = false;
  }
};

channel.on(EVENTS.REQUEST, handleRequest);
channel.on(EVENTS.MANUAL, run);
