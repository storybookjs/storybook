import { sourceDecorator } from './docs/sourceDecorator.ts';

const { docgen } = globalThis.FRAMEWORK_OPTIONS ?? {};
const useStaticServiceSnippets =
  globalThis.FEATURES?.experimentalDocgenServer === true &&
  (docgen === 'vue-component-meta' ||
    (typeof docgen === 'object' && docgen?.plugin === 'vue-component-meta'));

export const decorators = useStaticServiceSnippets ? [] : [sourceDecorator];
