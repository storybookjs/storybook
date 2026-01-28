import { SupportedBuilder, SupportedFramework, SupportedRenderer } from 'storybook/internal/types';

export const frameworkToRenderer: Record<
  SupportedFramework | SupportedRenderer,
  SupportedRenderer
> = {
  // frameworks
  [SupportedFramework.ANGULAR]: SupportedRenderer.ANGULAR,
  [SupportedFramework.EMBER]: SupportedRenderer.EMBER,
  [SupportedFramework.HTML_VITE]: SupportedRenderer.HTML,
  [SupportedFramework.NEXTJS]: SupportedRenderer.REACT,
  [SupportedFramework.NEXTJS_VITE]: SupportedRenderer.REACT,
  [SupportedFramework.PREACT_VITE]: SupportedRenderer.PREACT,
  [SupportedFramework.QWIK]: SupportedRenderer.QWIK,
  [SupportedFramework.REACT_VITE]: SupportedRenderer.REACT,
  [SupportedFramework.REACT_WEBPACK5]: SupportedRenderer.REACT,
  [SupportedFramework.SERVER_WEBPACK5]: SupportedRenderer.SERVER,
  [SupportedFramework.SOLID]: SupportedRenderer.SOLID,
  [SupportedFramework.SVELTE_VITE]: SupportedRenderer.SVELTE,
  [SupportedFramework.SVELTEKIT]: SupportedRenderer.SVELTE,
  [SupportedFramework.VUE3_VITE]: SupportedRenderer.VUE3,
  [SupportedFramework.WEB_COMPONENTS_VITE]: SupportedRenderer.WEB_COMPONENTS,
  [SupportedFramework.REACT_RSBUILD]: SupportedRenderer.REACT,
  [SupportedFramework.VUE3_RSBUILD]: SupportedRenderer.VUE3,
  [SupportedFramework.HTML_RSBUILD]: SupportedRenderer.HTML,
  [SupportedFramework.WEB_COMPONENTS_RSBUILD]: SupportedRenderer.WEB_COMPONENTS,
  [SupportedFramework.REACT_NATIVE_WEB_VITE]: SupportedRenderer.REACT,
  [SupportedFramework.NUXT]: SupportedRenderer.VUE3,

  // renderers
  [SupportedRenderer.HTML]: SupportedRenderer.HTML,
  [SupportedRenderer.PREACT]: SupportedRenderer.PREACT,
  [SupportedRenderer.REACT_NATIVE]: SupportedRenderer.REACT_NATIVE,
  [SupportedRenderer.REACT]: SupportedRenderer.REACT,
  [SupportedRenderer.SERVER]: SupportedRenderer.SERVER,
  [SupportedRenderer.SVELTE]: SupportedRenderer.SVELTE,
  [SupportedRenderer.VUE3]: SupportedRenderer.VUE3,
  [SupportedRenderer.WEB_COMPONENTS]: SupportedRenderer.WEB_COMPONENTS,
  [SupportedRenderer.STENCIL]: SupportedRenderer.STENCIL,
};

export const frameworkToBuilder: Record<SupportedFramework, SupportedBuilder> = {
  // frameworks
  [SupportedFramework.ANGULAR]: SupportedBuilder.WEBPACK5,
  [SupportedFramework.EMBER]: SupportedBuilder.WEBPACK5,
  [SupportedFramework.HTML_VITE]: SupportedBuilder.VITE,
  [SupportedFramework.NEXTJS]: SupportedBuilder.WEBPACK5,
  [SupportedFramework.NEXTJS_VITE]: SupportedBuilder.VITE,
  [SupportedFramework.PREACT_VITE]: SupportedBuilder.VITE,
  [SupportedFramework.REACT_NATIVE_WEB_VITE]: SupportedBuilder.VITE,
  [SupportedFramework.REACT_VITE]: SupportedBuilder.VITE,
  [SupportedFramework.REACT_WEBPACK5]: SupportedBuilder.WEBPACK5,
  [SupportedFramework.SERVER_WEBPACK5]: SupportedBuilder.WEBPACK5,
  [SupportedFramework.SVELTE_VITE]: SupportedBuilder.VITE,
  [SupportedFramework.SVELTEKIT]: SupportedBuilder.VITE,
  [SupportedFramework.VUE3_VITE]: SupportedBuilder.VITE,
  [SupportedFramework.WEB_COMPONENTS_VITE]: SupportedBuilder.VITE,
  [SupportedFramework.QWIK]: SupportedBuilder.VITE,
  [SupportedFramework.SOLID]: SupportedBuilder.VITE,
  [SupportedFramework.NUXT]: SupportedBuilder.VITE,
  [SupportedFramework.REACT_RSBUILD]: SupportedBuilder.RSBUILD,
  [SupportedFramework.VUE3_RSBUILD]: SupportedBuilder.RSBUILD,
  [SupportedFramework.HTML_RSBUILD]: SupportedBuilder.RSBUILD,
  [SupportedFramework.WEB_COMPONENTS_RSBUILD]: SupportedBuilder.RSBUILD,
  [SupportedFramework.STENCIL]: SupportedBuilder.VITE,
};
