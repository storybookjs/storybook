import { SupportedBuilder, SupportedFramework, SupportedRenderer } from 'storybook/internal/types';

/**
 * The one place that names each renderer's package. Keyed by every `SupportedRenderer`, so adding
 * a renderer without an entry fails to compile.
 */
export const rendererRegistry: Record<
  SupportedRenderer,
  {
    /** Absent when the renderer has no package of its own */
    packageName?: string;
    /**
     * UI framework runtime packages whose installed versions telemetry reports. Keyed off the
     * detected renderer, so a hoisted sibling such as `vue` in a React project is not reported.
     */
    runtimePackages: string[];
  }
> = {
  [SupportedRenderer.REACT]: {
    packageName: '@storybook/react',
    runtimePackages: ['react', 'react-dom'],
  },
  [SupportedRenderer.REACT_NATIVE]: {
    packageName: '@storybook/react-native',
    runtimePackages: ['react-native', 'react'],
  },
  [SupportedRenderer.VUE3]: { packageName: '@storybook/vue3', runtimePackages: ['vue'] },
  [SupportedRenderer.ANGULAR]: {
    packageName: '@storybook/angular',
    runtimePackages: ['@angular/core', '@angular-devkit/build-angular'],
  },
  [SupportedRenderer.EMBER]: { packageName: '@storybook/ember', runtimePackages: ['ember-source'] },
  [SupportedRenderer.PREACT]: { packageName: '@storybook/preact', runtimePackages: ['preact'] },
  [SupportedRenderer.SVELTE]: { packageName: '@storybook/svelte', runtimePackages: ['svelte'] },
  [SupportedRenderer.HTML]: { packageName: '@storybook/html', runtimePackages: [] },
  [SupportedRenderer.WEB_COMPONENTS]: {
    packageName: '@storybook/web-components',
    runtimePackages: ['lit'],
  },
  [SupportedRenderer.SERVER]: { packageName: '@storybook/server', runtimePackages: [] },
  [SupportedRenderer.NUXT]: { runtimePackages: [] },
  // community (outside of monorepo)
  [SupportedRenderer.QWIK]: {
    packageName: 'storybook-framework-qwik',
    runtimePackages: ['@builder.io/qwik'],
  },
  [SupportedRenderer.SOLID]: {
    packageName: 'storybook-solidjs-vite',
    runtimePackages: ['solid-js'],
  },
  [SupportedRenderer.ASTRO]: {
    packageName: '@storybook-astro/renderer',
    runtimePackages: ['astro'],
  },
};

/** The one place that names each builder's package. Keyed by every `SupportedBuilder`. */
export const builderRegistry: Record<SupportedBuilder, { packageName: string }> = {
  [SupportedBuilder.WEBPACK5]: { packageName: '@storybook/builder-webpack5' },
  [SupportedBuilder.VITE]: { packageName: '@storybook/builder-vite' },
  // community (outside of monorepo)
  [SupportedBuilder.RSBUILD]: { packageName: 'storybook-builder-rsbuild' },
};

/**
 * The one place that names each framework's package, renderer and builder. Keyed by every
 * `SupportedFramework`, so adding a framework to the generated enum without an entry fails to
 * compile.
 */
export const frameworkRegistry: Record<
  SupportedFramework,
  { packageName: string; renderer: SupportedRenderer; builder: SupportedBuilder }
> = {
  [SupportedFramework.ANGULAR]: {
    packageName: '@storybook/angular',
    renderer: SupportedRenderer.ANGULAR,
    builder: SupportedBuilder.WEBPACK5,
  },
  [SupportedFramework.ANGULAR_VITE]: {
    packageName: '@storybook/angular-vite',
    renderer: SupportedRenderer.ANGULAR,
    builder: SupportedBuilder.VITE,
  },
  [SupportedFramework.EMBER]: {
    packageName: '@storybook/ember',
    renderer: SupportedRenderer.EMBER,
    builder: SupportedBuilder.WEBPACK5,
  },
  [SupportedFramework.HTML_VITE]: {
    packageName: '@storybook/html-vite',
    renderer: SupportedRenderer.HTML,
    builder: SupportedBuilder.VITE,
  },
  [SupportedFramework.NEXTJS]: {
    packageName: '@storybook/nextjs',
    renderer: SupportedRenderer.REACT,
    builder: SupportedBuilder.WEBPACK5,
  },
  [SupportedFramework.PREACT_VITE]: {
    packageName: '@storybook/preact-vite',
    renderer: SupportedRenderer.PREACT,
    builder: SupportedBuilder.VITE,
  },
  [SupportedFramework.REACT_VITE]: {
    packageName: '@storybook/react-vite',
    renderer: SupportedRenderer.REACT,
    builder: SupportedBuilder.VITE,
  },
  [SupportedFramework.REACT_WEBPACK5]: {
    packageName: '@storybook/react-webpack5',
    renderer: SupportedRenderer.REACT,
    builder: SupportedBuilder.WEBPACK5,
  },
  [SupportedFramework.SERVER_WEBPACK5]: {
    packageName: '@storybook/server-webpack5',
    renderer: SupportedRenderer.SERVER,
    builder: SupportedBuilder.WEBPACK5,
  },
  [SupportedFramework.SVELTE_VITE]: {
    packageName: '@storybook/svelte-vite',
    renderer: SupportedRenderer.SVELTE,
    builder: SupportedBuilder.VITE,
  },
  [SupportedFramework.SVELTEKIT]: {
    packageName: '@storybook/sveltekit',
    renderer: SupportedRenderer.SVELTE,
    builder: SupportedBuilder.VITE,
  },
  [SupportedFramework.VUE3_VITE]: {
    packageName: '@storybook/vue3-vite',
    renderer: SupportedRenderer.VUE3,
    builder: SupportedBuilder.VITE,
  },
  [SupportedFramework.NEXTJS_VITE]: {
    packageName: '@storybook/nextjs-vite',
    renderer: SupportedRenderer.REACT,
    builder: SupportedBuilder.VITE,
  },
  [SupportedFramework.REACT_NATIVE_WEB_VITE]: {
    packageName: '@storybook/react-native-web-vite',
    renderer: SupportedRenderer.REACT,
    builder: SupportedBuilder.VITE,
  },
  [SupportedFramework.WEB_COMPONENTS_VITE]: {
    packageName: '@storybook/web-components-vite',
    renderer: SupportedRenderer.WEB_COMPONENTS,
    builder: SupportedBuilder.VITE,
  },
  [SupportedFramework.TANSTACK_REACT]: {
    packageName: '@storybook/tanstack-react',
    renderer: SupportedRenderer.REACT,
    builder: SupportedBuilder.VITE,
  },
  // community (outside of monorepo)
  [SupportedFramework.QWIK]: {
    packageName: 'storybook-framework-qwik',
    renderer: SupportedRenderer.QWIK,
    builder: SupportedBuilder.VITE,
  },
  [SupportedFramework.SOLID]: {
    packageName: 'storybook-solidjs-vite',
    renderer: SupportedRenderer.SOLID,
    builder: SupportedBuilder.VITE,
  },
  [SupportedFramework.REACT_RSBUILD]: {
    packageName: 'storybook-react-rsbuild',
    renderer: SupportedRenderer.REACT,
    builder: SupportedBuilder.RSBUILD,
  },
  [SupportedFramework.VUE3_RSBUILD]: {
    packageName: 'storybook-vue3-rsbuild',
    renderer: SupportedRenderer.VUE3,
    builder: SupportedBuilder.RSBUILD,
  },
  [SupportedFramework.WEB_COMPONENTS_RSBUILD]: {
    packageName: 'storybook-web-components-rsbuild',
    renderer: SupportedRenderer.WEB_COMPONENTS,
    builder: SupportedBuilder.RSBUILD,
  },
  [SupportedFramework.HTML_RSBUILD]: {
    packageName: 'storybook-html-rsbuild',
    renderer: SupportedRenderer.HTML,
    builder: SupportedBuilder.RSBUILD,
  },
  [SupportedFramework.NUXT]: {
    packageName: '@storybook-vue/nuxt',
    renderer: SupportedRenderer.VUE3,
    builder: SupportedBuilder.VITE,
  },
  [SupportedFramework.ASTRO]: {
    packageName: '@storybook-astro/framework',
    renderer: SupportedRenderer.ASTRO,
    builder: SupportedBuilder.VITE,
  },
  [SupportedFramework.ANALOG]: {
    packageName: '@analogjs/storybook-angular',
    renderer: SupportedRenderer.ANGULAR,
    builder: SupportedBuilder.VITE,
  },
};

const entriesOf = <K extends string, V>(record: Record<K, V>) => Object.entries(record) as [K, V][];

/** Maps a framework, or a renderer standing in as its own framework, to its renderer */
export const frameworkToRenderer: Record<
  SupportedFramework | SupportedRenderer,
  SupportedRenderer
> = {
  ...(Object.fromEntries(
    Object.values(SupportedRenderer).map((renderer) => [renderer, renderer])
  ) as Record<SupportedRenderer, SupportedRenderer>),
  // A framework wins over a renderer of the same name, e.g. `nuxt` renders with Vue 3
  ...(Object.fromEntries(
    entriesOf(frameworkRegistry).map(([framework, { renderer }]) => [framework, renderer])
  ) as Record<SupportedFramework, SupportedRenderer>),
};

export const frameworkToBuilder = Object.fromEntries(
  entriesOf(frameworkRegistry).map(([framework, { builder }]) => [framework, builder])
) as Record<SupportedFramework, SupportedBuilder>;

export const frameworkPackages: Record<string, SupportedFramework> = Object.fromEntries(
  entriesOf(frameworkRegistry).map(([framework, { packageName }]) => [packageName, framework])
);

export const rendererPackages: Record<string, SupportedRenderer> = Object.fromEntries(
  entriesOf(rendererRegistry).flatMap(([renderer, { packageName }]) =>
    packageName ? [[packageName, renderer]] : []
  )
);

export const builderPackages: Record<string, SupportedBuilder> = Object.fromEntries(
  entriesOf(builderRegistry).map(([builder, { packageName }]) => [packageName, builder])
);
