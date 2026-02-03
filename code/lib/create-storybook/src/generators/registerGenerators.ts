import angularGenerator from './ANGULAR';
import emberGenerator from './EMBER';
import { generatorRegistry } from './GeneratorRegistry';
import htmlGenerator from './HTML';
import nextjsGenerator from './NEXTJS';
import nuxtGenerator from './NUXT';
import preactGenerator from './PREACT';
import qwikGenerator from './QWIK';
import reactGenerator from './REACT';
import tanstackGenerator from './TANSTACK';
import reactNativeGenerator from './REACT_NATIVE';
import reactNativeAndRNWGenerator from './REACT_NATIVE_AND_RNW';
import reactNativeWebGenerator from './REACT_NATIVE_WEB';
import reactScriptsGenerator from './REACT_SCRIPTS';
import serverGenerator from './SERVER';
import solidGenerator from './SOLID';
import svelteGenerator from './SVELTE';
import svelteKitGenerator from './SVELTEKIT';
import vue3Generator from './VUE3';
import webComponentsGenerator from './WEB-COMPONENTS';
import type { GeneratorModule } from './types';

const setOfGenerators = new Set<GeneratorModule>([
  reactGenerator,
  reactScriptsGenerator,
  reactNativeGenerator,
  reactNativeWebGenerator,
  reactNativeAndRNWGenerator,
  vue3Generator,
  nuxtGenerator,
  angularGenerator,
  nextjsGenerator,
  svelteGenerator,
  svelteKitGenerator,
  emberGenerator,
  htmlGenerator,
  webComponentsGenerator,
  preactGenerator,
  solidGenerator,
  serverGenerator,
  qwikGenerator,
  tanstackGenerator,
]);

/** Register all framework generators with the central registry */
export function registerAllGenerators(): void {
  setOfGenerators.forEach((generator) => {
    generatorRegistry.register(generator);
  });
}
