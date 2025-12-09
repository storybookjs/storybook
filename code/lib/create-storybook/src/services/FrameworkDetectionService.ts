import { type JsPackageManager, getProjectRoot } from 'storybook/internal/common';
import { prompt } from 'storybook/internal/node-logger';
import type { SupportedRenderer } from 'storybook/internal/types';
import { SupportedBuilder, SupportedFramework } from 'storybook/internal/types';

import * as find from 'empathic/find';
import { dedent } from 'ts-dedent';

const viteConfigFiles = ['vite.config.ts', 'vite.config.js', 'vite.config.mjs'];
const webpackConfigFiles = ['webpack.config.js'];
const rsbuildConfigFiles = ['rsbuild.config.ts', 'rsbuild.config.js', 'rsbuild.config.mjs'];
const stencilConfigFiles = ['stencil.config.ts'];

export class FrameworkDetectionService {
  constructor(private jsPackageManager: JsPackageManager) {}

  detectFramework(renderer: SupportedRenderer, builder: SupportedBuilder): SupportedFramework {
    if (Object.values(SupportedFramework).includes(renderer as any)) {
      return renderer as any as SupportedFramework;
    }

    const maybeFramework = `${renderer}-${builder}`;

    if (Object.values(SupportedFramework).includes(maybeFramework as SupportedFramework)) {
      return maybeFramework as SupportedFramework;
    }

    throw new Error(`Could not find framework for renderer: ${renderer} and builder: ${builder}`);
  }

  async detectBuilder() {
    const viteConfig = find.any(viteConfigFiles, { last: getProjectRoot() });
    const webpackConfig = find.any(webpackConfigFiles, { last: getProjectRoot() });
    const rsbuildConfig = find.any(rsbuildConfigFiles, { last: getProjectRoot() });
    const stencilConfig = find.any(stencilConfigFiles, { last: getProjectRoot() });
    const dependencies = this.jsPackageManager.getAllDependencies();

    // Detect which builders are present
    const hasVite = viteConfig || !!dependencies.vite;
    const hasWebpack = webpackConfig || !!dependencies.webpack;
    const hasRsbuild = rsbuildConfig || !!dependencies['@rsbuild/core'];
    const hasStencil = stencilConfig || !!dependencies['@stencil/core'];

    const detectedBuilders: SupportedBuilder[] = [];

    if (hasVite) {
      detectedBuilders.push(SupportedBuilder.VITE);
    }

    if (hasWebpack) {
      detectedBuilders.push(SupportedBuilder.WEBPACK5);
    }

    if (hasRsbuild) {
      detectedBuilders.push(SupportedBuilder.RSBUILD);
    }

    if (hasStencil) {
      detectedBuilders.push(SupportedBuilder.STENCIL);
    }

    // If exactly one builder is detected, return it
    if (detectedBuilders.length === 1) {
      return detectedBuilders[0];
    }

    // If multiple builders are detected or none are detected, prompt the user
    const options = [
      { label: 'Vite', value: SupportedBuilder.VITE },
      { label: 'Webpack 5', value: SupportedBuilder.WEBPACK5 },
      { label: 'Rsbuild', value: SupportedBuilder.RSBUILD },
      { label: 'Stencil', value: SupportedBuilder.STENCIL },
    ];

    return prompt.select({
      message: dedent`
      ${
        detectedBuilders.length > 1
          ? 'Multiple builders were detected in your project. Please select one:'
          : 'We were not able to detect the right builder for your project. Please select one:'
      }
      `,
      options,
    });
  }
}
