import { expect, fn, within } from '@storybook/test';

import Hrefs from './Hrefs.svelte';

export default {
  title: 'stories/sveltekit/modules/hrefs',
  component: Hrefs,
  tags: ['autodocs'],
};

export const DefaultActions = {
  async play({ canvasElement }) {
    const canvas = within(canvasElement);

    const initialUrl = window.location.toString();

    const basicHref = canvas.getByText('/basic-href');
    basicHref.click();

    const complexHref = canvas.getByText(
      '/deep/nested/link?with=true&multiple-params=200#and-an-id'
    );
    complexHref.click();

    const finalUrl = window.location.toString();
    expect(finalUrl).toBe(initialUrl);
  },
};

const basicStringMatch = fn();
const noMatch = fn();
const exactStringMatch = fn();
const regexMatch = fn();

export const Callbacks = {
  parameters: {
    sveltekit_experimental: {
      hrefs: {
        '/basic-href': basicStringMatch,
        '/basic': noMatch,
        '/deep/nested/link?with=true&multiple-params=200#and-an-id': exactStringMatch,
        'nested/link\\?with': { callback: regexMatch, asRegex: true },
      },
    },
  },
  play: async (ctx) => {
    await DefaultActions.play(ctx);
    expect(basicStringMatch).toHaveBeenCalledTimes(1);
    expect(noMatch).not.toHaveBeenCalled();
    expect(exactStringMatch).toHaveBeenCalledTimes(1);
    expect(regexMatch).toHaveBeenCalledTimes(1);
  },
};
