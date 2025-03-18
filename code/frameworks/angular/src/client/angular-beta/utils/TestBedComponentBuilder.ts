import { ComponentFixture, TestBed } from '@angular/core/testing';
import {
  BrowserDynamicTestingModule,
  platformBrowserDynamicTesting,
} from '@angular/platform-browser-dynamic/testing';
import { ApplicationRef, Provider, Type } from '@angular/core';
import { PropertyExtractor } from './PropertyExtractor';

export const initTestBed = () => {
  if (TestBed.platform == null) {
    TestBed.initTestEnvironment(BrowserDynamicTestingModule, platformBrowserDynamicTesting());
  } else {
    resetTestBed();
  }
};

export const resetTestBed = () => {
  try {
    TestBed.resetTestingModule().resetTestEnvironment();
  } catch (e) {
    console.log('Failed to reset', e);
  }
};

export const buildComponent = async (
  analyzedMetadata: PropertyExtractor,
  storyComponent: Type<unknown> | undefined,
  selector: string
) => {
  const { imports, declarations, providers } = analyzedMetadata;
  await TestBed.configureTestingModule({
    imports: imports,
    declarations: declarations,
    providers: providers,
  })
    .overrideComponent(storyComponent, {
      set: {
        providers: providers,
        selector: selector,
      },
    })
    .compileComponents();

  return TestBed.createComponent(storyComponent);
};

export const getApplicationRef = () => {
  return TestBed.inject(ApplicationRef);
};
