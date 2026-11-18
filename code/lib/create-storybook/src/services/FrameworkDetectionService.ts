import { type JsPackageManager, getProjectRoot } from 'storybook/internal/common';
import { prompt } from 'storybook/internal/node-logger';
import type { SupportedRenderer } from 'storybook/internal/types';
import { SupportedBuilder, SupportedFramework } from 'storybook/internal/types';

import * as find from 'empathic/find';
import { dedent } from 'ts-dedent';

import { createPromptCancelOptions } from '../prompt-cancel.ts';
import { TelemetryService } from './TelemetryService.ts';

const viteConfigFiles = ['vite.config.ts', 'vite.config.js', 'vite.config.mjs'];
const webpackConfigFiles = ['webpack.config.js'];
const rsbuildConfigFiles = ['rsbuild.config.ts', 'rsbuild.config.js', 'rsbuild.config.mjs'];

export class FrameworkDetectionService {
  constructor(
    private jsPackageManager: JsPackageManager,
    private telemetryService = new TelemetryService()
  ) {}

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

  private hasFramework(renderer: SupportedRenderer, builder: SupportedBuilder) {
    try {
      this.detectFramework(renderer, builder);
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Pass `renderer` when the framework is derived from the renderer and builder, so only builders
   * with a matching framework are detected or offered.
   */
  async detectBuilder(renderer?: SupportedRenderer) {
    const viteConfig = find.any(viteConfigFiles, { last: getProjectRoot() });
    const webpackConfig = find.any(webpackConfigFiles, { last: getProjectRoot() });
    const rsbuildConfig = find.any(rsbuildConfigFiles, { last: getProjectRoot() });
    const dependencies = this.jsPackageManager.getAllDependencies();

    // Detect which builders are present
    const hasVite = viteConfig || !!dependencies.vite;
    const hasWebpack = webpackConfig || !!dependencies.webpack;
    const hasRsbuild = rsbuildConfig || !!dependencies['@rsbuild/core'];

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

    // Only consider builders that have a framework for the renderer
    const supportedBuilders = Object.values(SupportedBuilder).filter(
      (builder) => !renderer || this.hasFramework(renderer, builder)
    );
    const usableBuilders = detectedBuilders.filter((builder) =>
      supportedBuilders.includes(builder)
    );

    // If exactly one builder is detected, return it
    if (usableBuilders.length === 1) {
      return usableBuilders[0];
    }

    // If the renderer only works with one builder, there is nothing to choose
    if (supportedBuilders.length === 1) {
      return supportedBuilders[0];
    }

    // If multiple builders are detected or none are detected, prompt the user
    const options = [
      { label: 'Vite', value: SupportedBuilder.VITE },
      { label: 'Webpack 5', value: SupportedBuilder.WEBPACK5 },
      { label: 'Rsbuild', value: SupportedBuilder.RSBUILD },
    ].filter((option) => supportedBuilders.includes(option.value));

    return prompt.select(
      {
        message: dedent`
      ${
        usableBuilders.length > 1
          ? 'Multiple builders were detected in your project. Please select one:'
          : 'We were not able to detect the right builder for your project. Please select one:'
      }
      `,
        options,
      },
      createPromptCancelOptions(this.telemetryService, 'builder-selection')
    );
  }
}
