import { page } from '$app/state';
import { link } from '@storybook/sveltekit/navigation.mock';
import { expect, userEvent } from 'storybook/test';

import Hrefs from './Hrefs.svelte';

export default {
  title: 'stories/frameworks/sveltekit/modules/hrefs',
  component: Hrefs,
  beforeEach() {
    // necessary to make the rendered output deterministic in CH snapshots
    page.url = new URL('https://storybook.js.org');
  },
};

export const Links = {
  async play({ canvas }) {
    const initialUrl = window.location.toString();

    await userEvent.click(canvas.getByText('/basic-href'));
    await expect(link).toHaveBeenCalledWith('/basic-href', expect.any(MouseEvent));

    await userEvent.click(
      canvas.getByText('/deep/nested/link?with=true&multiple-params=200#and-an-id')
    );
    await expect(link).toHaveBeenCalledWith(
      '/deep/nested/link?with=true&multiple-params=200#and-an-id',
      expect.any(MouseEvent)
    );

    await userEvent.click(canvas.getByText('https://svelte.dev'));
    await expect(link).toHaveBeenCalledWith('https://svelte.dev', expect.any(MouseEvent));

    await expect(window.location.toString()).toBe(initialUrl);
  },
};

export const LinkImplementation = {
  beforeEach() {
    link.mockImplementation((href) => {
      page.url = new URL(href, 'https://storybook.js.org');
    });
  },
  async play({ canvas }) {
    await userEvent.click(canvas.getByText('/basic-href'));
    await expect(canvas.getByTestId('current-url')).toHaveTextContent(
      'https://storybook.js.org/basic-href'
    );
  },
};

export const NewWindowLinks = {
  async play({ canvas }) {
    const newWindowLink = canvas.getByText('Opens in a new window');
    // Stops the browser from opening the window. The listener on `window` runs after the framework's
    // listener on `document`, so the framework sees the click as it is
    window.addEventListener('click', (event) => event.preventDefault(), { once: true });
    await userEvent.click(newWindowLink);
    await expect(link).not.toHaveBeenCalled();
  },
};
