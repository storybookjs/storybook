import angularGenerator from './ANGULAR/index.ts';
import emberGenerator from './EMBER/index.ts';
import { generatorRegistry } from './GeneratorRegistry.ts';
import htmlGenerator from './HTML/index.ts';
import nextjsGenerator from './NEXTJS/index.ts';
import nuxtGenerator from './NUXT/index.ts';
import preactGenerator from './PREACT/index.ts';
import qwikGenerator from './QWIK/index.ts';
import reactGenerator from './REACT/index.ts';
import reactNativeGenerator from './REACT_NATIVE/index.ts';
import reactNativeAndRNWGenerator from './REACT_NATIVE_AND_RNW/index.ts';
import reactNativeWebGenerator from './REACT_NATIVE_WEB/index.ts';
import reactScriptsGenerator from './REACT_SCRIPTS/index.ts';
import serverGenerator from './SERVER/index.ts';
import solidGenerator from './SOLID/index.ts';
import svelteGenerator from './SVELTE/index.ts';
import svelteKitGenerator from './SVELTEKIT/index.ts';
import tanstackGenerator from './TANSTACK/index.ts';
import vue3Generator from './VUE3/index.ts';
import webComponentsGenerator from './WEB-COMPONENTS/index.ts';
import type { GeneratorModule } from './types.ts';

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
