import './globals';

export { render, renderToCanvas } from './render';
export { decorateStory as applyDecorators } from './decorateStory';

export const parameters = { renderer: 'angular' as const };
