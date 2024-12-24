import { ApplicationRef } from '@angular/core';

const queue: Array<() => Promise<void>> = [];
let isProcessing = false;

/**
 * Reset compiled components because we often want to compile the same component with more than one
 * NgModule.
 */
const resetCompiledComponents = async () => {
  try {
    // Clear global Angular component cache in order to be able to re-render the same component across multiple stories
    //
    // References:
    // https://github.com/angular/angular-cli/blob/master/packages/angular_devkit/build_angular/src/webpack/plugins/hmr/hmr-accept.ts#L50
    // https://github.com/angular/angular/blob/2ebe2bcb2fe19bf672316b05f15241fd7fd40803/packages/core/src/render3/jit/module.ts#L377-L384
    const { ɵresetCompiledComponents } = await import('@angular/core');
    ɵresetCompiledComponents();
  } catch (e) {
    /** Noop catch This means angular removed or modified ɵresetCompiledComponents */
  }
};

/**
 * Queue bootstrapping, so that only one application can be bootstrapped at a time.
 *
 * Bootstrapping multiple applications at once can cause Angular to throw an error that a component
 * is declared in multiple modules. This avoids two stories confusing the Angular compiler, by
 * bootstrapping more that one application at a time.
 *
 * @param fn Callback that should complete the bootstrap process
 * @returns ApplicationRef from the completed bootstrap process
 */
export const queueBootstrapping = (fn: () => Promise<ApplicationRef>): Promise<ApplicationRef> => {
  return new Promise<ApplicationRef>((resolve, reject) => {
    queue.push(() => fn().then(resolve).catch(reject));

    if (!isProcessing) {
      processQueue();
    }
  });
};

const processQueue = async () => {
  isProcessing = true;

  while (queue.length > 0) {
    const bootstrappingFn = queue.shift();
    if (bootstrappingFn) {
      await bootstrappingFn();
      await resetCompiledComponents();
    }
  }

  isProcessing = false;
};
