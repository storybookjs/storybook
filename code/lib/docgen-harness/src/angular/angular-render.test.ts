// @vitest-environment happy-dom

// Angular test environment is set up inside this file only: a package-level setupFiles
// entry would zone-patch the Vue tests too.
import '@angular/compiler';
import 'zone.js';
import 'zone.js/testing';

import { readdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { TestBed, getTestBed } from '@angular/core/testing';
import {
  BrowserDynamicTestingModule,
  platformBrowserDynamicTesting,
} from '@angular/platform-browser-dynamic/testing';
import { BehaviorSubject } from 'rxjs';
import { afterEach, describe, expect, it } from 'vitest';

import { getApplication } from '../../../../frameworks/angular-vite/src/client/renderer/StorybookModule.ts';
import { storyPropsProvider } from '../../../../frameworks/angular-vite/src/client/renderer/StorybookProvider.ts';
import { PropertyExtractor } from '../../../../frameworks/angular-vite/src/client/renderer/utils/PropertyExtractor.ts';
import type { ICollection } from '../../../../frameworks/angular-vite/src/client/types.ts';

getTestBed().initTestEnvironment(BrowserDynamicTestingModule, platformBrowserDynamicTesting());

afterEach(() => {
  TestBed.resetTestingModule();
});

const fixturesDir = join(dirname(fileURLToPath(import.meta.url)), '__testfixtures__');

// Signal fixtures cannot render under JIT: their ɵcmp input/output maps stay empty, so
// bindings are dropped and required signals throw NG0950 at change detection; the OSA
// path they feed is static and never mounts components either.
const SIGNAL_FIXTURES = new Set(['signal-io', 'signal-model']);

const fixtureCases = readdirSync(fixturesDir, { withFileTypes: true })
  .filter((entry) => entry.isDirectory() && !SIGNAL_FIXTURES.has(entry.name))
  .map((entry) => entry.name)
  .sort();

describe('angular fixtures render (JIT TestBed smoke)', () => {
  it.each(fixtureCases)('%s', async (fixtureCase) => {
    const storiesModule = await import(`./__testfixtures__/${fixtureCase}/input.stories.ts`);
    const { default: meta, ...stories } = storiesModule;
    const component = meta.component;

    expect(Object.keys(stories).length).toBeGreaterThan(0);

    for (const [storyName, story] of Object.entries<{ args?: Record<string, unknown> }>(stories)) {
      const props: ICollection = { ...meta.args, ...story.args };

      const analyzedMetadata = new PropertyExtractor({}, component);
      await analyzedMetadata.init();

      const application = getApplication({
        storyFnAngular: { props },
        component,
        targetSelector: 'sb-harness-target',
        analyzedMetadata,
      });

      await TestBed.configureTestingModule({
        imports: [application],
        providers: [storyPropsProvider(new BehaviorSubject<ICollection>(props))],
      }).compileComponents();

      const fixture = TestBed.createComponent(application);
      fixture.detectChanges();

      expect(fixture.nativeElement.firstElementChild, `${fixtureCase}/${storyName}`).not.toBeNull();
      TestBed.resetTestingModule();
    }
  });
});
