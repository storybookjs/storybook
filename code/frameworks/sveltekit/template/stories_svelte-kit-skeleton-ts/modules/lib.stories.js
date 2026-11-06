import { expect, within } from 'storybook/test';

import Lib from './Lib.svelte';

export default {
  title: 'stories/frameworks/sveltekit/modules/lib',
  component: Lib,
};

export const SubpathImport = {
  async play({ canvasElement }) {
    const canvas = within(canvasElement);
    await expect(canvas.getByAltText('Svelte logo').getAttribute('src')).toMatch(/svg/);
  },
};
