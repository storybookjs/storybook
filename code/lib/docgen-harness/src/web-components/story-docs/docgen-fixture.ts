import type { IndexEntry } from 'storybook/internal/types';

import { join } from 'node:path';

import type { WebComponentsDocgenPayload } from '../../../../../renderers/web-components/src/docgen/component-docgen/build-docgen.ts';
import { buildDocgenPayload } from '../../../../../renderers/web-components/src/docgen/component-docgen/build-docgen.ts';
import { DEFAULT_TYPE_PROPERTY } from '../../../../../renderers/web-components/src/docgen/component-docgen/arg-types/alt-type.ts';
import { CemManager } from '../../../../../renderers/web-components/src/docgen/component-docgen/manifest/cem-manager.ts';

export function createFixtureDocgen(testDir: string): {
  getDocgenPayload: (entry: IndexEntry) => () => Promise<WebComponentsDocgenPayload | undefined>;
} {
  const manager = new CemManager([join(testDir, 'custom-elements.json')]);
  return {
    getDocgenPayload: (entry) => async (): Promise<WebComponentsDocgenPayload | undefined> =>
      buildDocgenPayload(
        { entry },
        { cem: await manager.refresh(), typeProperty: DEFAULT_TYPE_PROPERTY }
      ),
  };
}
