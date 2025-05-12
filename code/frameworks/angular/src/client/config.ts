import './globals';
import { TestBed } from '@angular/core/testing';

export { render, renderToCanvas } from './render';
export { decorateStory as applyDecorators } from './decorateStory';

export const parameters = { renderer: 'angular' as const };

export const beforeEach = () => {
  return () => {
    TestBed.resetTestingModule().resetTestEnvironment();
  };
};
