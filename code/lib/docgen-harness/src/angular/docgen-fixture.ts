// Stands in for the `core/docgen` service the story-docs provider queries in production, by running
// the real `buildDocgenPayload` against a per-suite analyzer manager. Free of the client renderer,
// so renderer-free suites can use it without loading `@angular/core`.
import ts from 'typescript';

import type { IndexEntry } from 'storybook/internal/types';

import { AngularComponentMetaManager } from '@storybook/angular-cm';
import type { AngularDocgenPayload } from '../../../../frameworks/angular-vite/src/docgen/build-docgen.ts';
import { buildDocgenPayload } from '../../../../frameworks/angular-vite/src/docgen/build-docgen.ts';

const noopLogger = { warn: () => {}, debug: () => {} };

export function createFixtureDocgen() {
  const manager = new AngularComponentMetaManager(ts);
  return {
    getDocgenPayload: (entry: IndexEntry) => async (): Promise<AngularDocgenPayload | undefined> =>
      buildDocgenPayload(
        { entry },
        {
          manager,
          options: { propsTable: 'api' },
          logger: noopLogger,
          resolvePath: (path) => path,
        }
      ),
    dispose: () => manager.dispose(),
  };
}
