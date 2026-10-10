export { applyDecorators, render, renderToCanvas } from './render.tsx';

export const parameters = {
  renderer: 'nextjs-vite-rsc',
  // The plugin runs one app per document, and a story renders a page of it
  docs: { story: { inline: false, iframeHeight: '320px' } },
};
