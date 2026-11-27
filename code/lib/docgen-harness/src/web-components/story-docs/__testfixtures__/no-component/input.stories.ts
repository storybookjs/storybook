import { html } from 'lit';

/** A page assembled from a template function, with no custom element behind the meta. */
const meta = {
  title: 'WebComponentsStoryDocs/NoComponent',
  render: (args: { heading: string }) => html`<h1>${args.heading}</h1>`,
};
export default meta;

export const Default = { args: { heading: 'Hello' } };
export const Authored = {
  args: { heading: 'Authored' },
  parameters: { docs: { source: { code: '<h1>Authored</h1>' } } },
};
