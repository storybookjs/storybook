import { TestBed } from '@angular/core/testing';
import {
  BrowserDynamicTestingModule,
  platformBrowserDynamicTesting,
} from '@angular/platform-browser-dynamic/testing';
import { ApplicationRef, Provider, Type } from '@angular/core';
import { PropertyExtractor } from './PropertyExtractor';

export const initTestBed = () => {
  TestBed.initTestEnvironment(BrowserDynamicTestingModule, platformBrowserDynamicTesting());
};

export const resetTestBed = () => {
  TestBed.resetTestingModule();
  TestBed.resetTestEnvironment();
};

export const buildComponent = async (
  analyzedMetadata: PropertyExtractor,
  storyComponent: Type<unknown> | undefined
) => {
  const { imports, declarations, providers } = analyzedMetadata;
  await TestBed.configureTestingModule({
    imports: [imports],
    declarations: declarations,
    providers: providers,
  })
    .overrideComponent(storyComponent, {
      // set: {
      //   providers: providers,
      // },
    })
    .compileComponents();
  return TestBed.createComponent(storyComponent);
};

export const getApplicationRef = () => {
  return TestBed.inject(ApplicationRef);
};
