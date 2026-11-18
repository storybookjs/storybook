/// <reference types="vitest/globals" />
// Load the Angular compiler before bootstrapping so JIT compilation works for
// libraries the Angular Linker didn't process (e.g. @angular/common's PlatformLocation).
import '@angular/compiler';
import '@analogjs/vite-plugin-angular/setup-vitest';
import { getTestBed, ɵgetCleanupHook as getCleanupHook } from '@angular/core/testing';
import {
  BrowserDynamicTestingModule,
  platformBrowserDynamicTesting,
} from '@angular/platform-browser-dynamic/testing';

// Angular registers these TestBed cleanup hooks itself, but only when `@angular/core/testing` is
// first evaluated, which a reused worker does for its first test file alone. The global hooks,
// unlike Vitest's exports, run in the zone that `setup-vitest` gives tests.
beforeEach(getCleanupHook(false));
afterEach(getCleanupHook(true));

// Runs once per test file, but a reused worker keeps the environment from the previous file.
if (!getTestBed().platform) {
  getTestBed().initTestEnvironment(BrowserDynamicTestingModule, platformBrowserDynamicTesting());
}
