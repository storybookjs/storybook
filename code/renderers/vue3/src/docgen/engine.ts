export interface VueDocgenEngine {
  componentMeta: () => Promise<{
    collectComponentMetaSources: typeof import('./component-docgen/component-meta/component-meta.ts').collectComponentMetaSources;
    createVueComponentMetaChecker: typeof import('./component-docgen/component-meta/component-meta.ts').createVueComponentMetaChecker;
  }>;
  vueDocgenApi: () => Promise<{
    parse: typeof import('./vue-docgen-api.ts').parse;
  }>;
}

export const experimental_vueDocgenEngine = async (): Promise<VueDocgenEngine> => ({
  componentMeta: () => import('./component-docgen/component-meta/component-meta.ts'),
  vueDocgenApi: () => import('./vue-docgen-api.ts'),
});
