import { loadComponentDocgen } from './docgen-render/component-docgen.ts';

export { render, renderToCanvas } from './render.ts';

export const beforeEach = [loadComponentDocgen];

export const parameters = {
  renderer: 'web-components',
};
