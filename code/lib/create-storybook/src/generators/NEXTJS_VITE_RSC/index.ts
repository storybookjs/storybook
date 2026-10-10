import { ProjectType } from 'storybook/internal/cli';
import { SupportedBuilder, SupportedFramework, SupportedRenderer } from 'storybook/internal/types';

import semver from 'semver';

import { defineGeneratorModule } from '../modules/GeneratorModule.ts';

// Never detected: a Next.js project gets `@storybook/nextjs-vite`, unless `--type nextjs_vite_rsc`
// asks for this experimental framework.
export default defineGeneratorModule({
  metadata: {
    projectType: ProjectType.NEXTJS_VITE_RSC,
    renderer: SupportedRenderer.NEXTJS_VITE_RSC,
    framework: SupportedFramework.NEXTJS_VITE_RSC,
    builderOverride: SupportedBuilder.VITE,
  },
  configure: async (packageManager) => {
    // The framework resolves the route of a request with @next/routing, at the version of next
    const asRange = (specifier: string | null | undefined) =>
      specifier && semver.validRange(specifier) ? specifier : null;
    const next =
      (await packageManager.getInstalledVersion('next')) ??
      asRange(packageManager.getDependencyVersion('next'));
    return {
      extraPackages: ['vite', next ? `@next/routing@${next}` : '@next/routing'],
    };
  },
});
