/** Docgen extraction engines, keyed by plugin. Each loads lazily so a project only pays for the one it uses. */
export const experimental_vueDocgenEngine = async () => ({
  componentMeta: () => import('./component-docgen/component-meta/component-meta.ts'),
  vueDocgenApi: () => import('./vue-docgen-api.ts'),
});
