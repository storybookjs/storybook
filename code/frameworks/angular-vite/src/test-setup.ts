// Load the Angular compiler before bootstrapping so JIT compilation works for
// libraries the Angular Linker didn't process (e.g. @angular/common's PlatformLocation).
import '@angular/compiler';
import '@analogjs/vite-plugin-angular/setup-vitest';
import { getTestBed } from '@angular/core/testing';
import {
  BrowserDynamicTestingModule,
  platformBrowserDynamicTesting,
} from '@angular/platform-browser-dynamic/testing';

getTestBed().initTestEnvironment(BrowserDynamicTestingModule, platformBrowserDynamicTesting());
