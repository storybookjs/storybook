import { logger } from '@storybook/core/client-logger';

import { deepDiff, DEEPLY_EQUAL } from './args';
import { getValuesFromArgTypes } from './csf/getValuesFromArgTypes';
import type { Globals, GlobalTypes } from '@storybook/core/types';

export class GlobalsStore {
  // We use ! here because TS doesn't analyse the .set() function to see if it actually get set
  allowedGlobalNames!: Set<string>;

  initialGlobals!: Globals;

  globals!: Globals;

  constructor({
    globals = {},
    globalTypes = {},
  }: {
    globals?: Globals;
    globalTypes?: GlobalTypes;
  }) {
    this.set({ globals, globalTypes });
  }

  set({ globals = {}, globalTypes = {} }: { globals?: Globals; globalTypes?: GlobalTypes }) {
    const delta = this.initialGlobals && deepDiff(this.initialGlobals, this.globals);

    this.allowedGlobalNames = new Set([...Object.keys(globals), ...Object.keys(globalTypes)]);

    const defaultGlobals: Globals = getValuesFromArgTypes(globalTypes);
    this.initialGlobals = { ...defaultGlobals, ...globals };

    this.globals = this.initialGlobals;
    if (delta && delta !== DEEPLY_EQUAL) {
      this.updateFromPersisted(delta);
    }
  }

  filterAllowedGlobals(globals: Globals) {
    return Object.entries(globals).reduce((acc, [key, value]) => {
      if (this.allowedGlobalNames.has(key)) {
        acc[key] = value;
      } else {
        logger.warn(
          `Attempted to set a global (${key}) that is not defined in initial globals or globalTypes`
        );
      }
      return acc;
    }, {} as Globals);
  }

  updateFromPersisted(persisted: Globals) {
    const allowedUrlGlobals = this.filterAllowedGlobals(persisted);
    // Note that unlike args, we do not have the same type information for globals to allow us
    // to type check them here, so we just set them naively
    this.globals = { ...this.globals, ...allowedUrlGlobals };
  }

  get() {
    return this.globals;
  }

  update(newGlobals: Globals) {
    this.globals = { ...this.globals, ...this.filterAllowedGlobals(newGlobals) };
  }
}
