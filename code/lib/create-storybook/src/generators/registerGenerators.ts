import { ProjectType } from 'storybook/internal/cli';

import angularGenerator from './ANGULAR';
import emberGenerator from './EMBER';
import { generatorRegistry } from './GeneratorRegistry';
import htmlGenerator from './HTML';
import nextjsGenerator from './NEXTJS';
import nuxtGenerator from './NUXT';
import preactGenerator from './PREACT';
import qwikGenerator from './QWIK';
import reactGenerator from './REACT';
import reactNativeGenerator from './REACT_NATIVE';
import reactNativeWebGenerator from './REACT_NATIVE_WEB';
import reactScriptsGenerator from './REACT_SCRIPTS';
import serverGenerator from './SERVER';
import solidGenerator from './SOLID';
import svelteGenerator from './SVELTE';
import svelteKitGenerator from './SVELTEKIT';
import vue3Generator from './VUE3';
import webComponentsGenerator from './WEB-COMPONENTS';
import webpackReactGenerator from './WEBPACK_REACT';

/** Register all framework generators with the central registry */
export function registerAllGenerators(): void {
  // React-based frameworks
  generatorRegistry.register({ projectType: ProjectType.REACT }, reactGenerator);
  generatorRegistry.register({ projectType: ProjectType.REACT_SCRIPTS }, reactScriptsGenerator);
  generatorRegistry.register({ projectType: ProjectType.REACT_PROJECT }, reactGenerator);
  generatorRegistry.register({ projectType: ProjectType.WEBPACK_REACT }, webpackReactGenerator);
  generatorRegistry.register({ projectType: ProjectType.REACT_NATIVE }, reactNativeGenerator);
  generatorRegistry.register(
    { projectType: ProjectType.REACT_NATIVE_WEB },
    reactNativeWebGenerator
  );

  // Other frameworks
  generatorRegistry.register({ projectType: ProjectType.VUE3 }, vue3Generator);
  generatorRegistry.register({ projectType: ProjectType.NUXT }, nuxtGenerator);
  generatorRegistry.register({ projectType: ProjectType.ANGULAR }, angularGenerator);
  generatorRegistry.register({ projectType: ProjectType.NEXTJS }, nextjsGenerator);
  generatorRegistry.register({ projectType: ProjectType.SVELTE }, svelteGenerator);
  generatorRegistry.register({ projectType: ProjectType.SVELTEKIT }, svelteKitGenerator);
  generatorRegistry.register({ projectType: ProjectType.EMBER }, emberGenerator);
  generatorRegistry.register({ projectType: ProjectType.HTML }, htmlGenerator);
  generatorRegistry.register({ projectType: ProjectType.WEB_COMPONENTS }, webComponentsGenerator);
  generatorRegistry.register({ projectType: ProjectType.PREACT }, preactGenerator);
  generatorRegistry.register({ projectType: ProjectType.SOLID }, solidGenerator);
  generatorRegistry.register({ projectType: ProjectType.SERVER }, serverGenerator);
  generatorRegistry.register({ projectType: ProjectType.QWIK }, qwikGenerator);
}
