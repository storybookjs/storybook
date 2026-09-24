import { expect, within } from 'storybook/test';

import filteredOutMeta, { Base, sharedObject } from './filtered-out.stories';

export default {
  component: filteredOutMeta.component,
};

export const ReusesFilteredOutStory = {
  ...Base,
  args: { object: { ...sharedObject, consumer: 'imports-filtered-out' } },
  play: async ({ canvasElement }) => {
    const pre = within(canvasElement).getByTestId('pre');
    await expect(pre).toHaveTextContent('"source": "filtered-out"');
    await expect(pre).toHaveTextContent('"consumer": "imports-filtered-out"');
  },
};
