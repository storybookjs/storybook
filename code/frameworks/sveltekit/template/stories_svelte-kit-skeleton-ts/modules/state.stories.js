import { navigating, page, updated } from '$app/state';
import { expect } from 'storybook/test';

import State from './State.svelte';

export default {
  title: 'stories/frameworks/sveltekit/modules/state',
  component: State,
  beforeEach() {
    // necessary to make the rendered output deterministic in CH snapshots
    page.url = new URL('https://storybook.js.org');
  },
};

export const Default = {};

export const Page = {
  beforeEach() {
    page.data = { test: 'passed' };
    page.form = { framework: 'SvelteKit', rating: 5 };
    page.params = { referrer: 'storybook' };
    page.route = { id: '/framework/sveltekit' };
    page.status = 200;
    page.url = new URL('https://svelte.dev/docs/kit/');
  },
  async play({ canvas }) {
    await expect(canvas.getByTestId('page')).toHaveTextContent('"test": "passed"');
  },
};

export const PageUpdatedInPlay = {
  async play({ canvas }) {
    await expect(canvas.getByTestId('page')).not.toHaveTextContent('"test": "passed"');
    page.data = { test: 'passed' };
    await expect(await canvas.findByText(/"test": "passed"/)).toBeInTheDocument();
  },
};

export const Navigating = {
  beforeEach() {
    navigating.from = {
      params: { framework: 'SvelteKit' },
      route: { id: '/framework/sveltekit' },
      url: new URL('https://svelte.dev'),
    };
    navigating.to = {
      params: {},
      route: { id: '/storybook' },
      url: new URL('https://storybook.js.org'),
    };
    navigating.type = 'link';
    navigating.willUnload = true;
    navigating.delta = 3;
    navigating.complete = Promise.resolve();
  },
};

export const Updated = {
  beforeEach() {
    updated.current = true;
  },
  async play({ canvas }) {
    await expect(updated.check).toHaveBeenCalled();
    await expect(canvas.getByTestId('updated')).toHaveTextContent('"current": true');
  },
};
