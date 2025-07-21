import './globals';
import { TestBed } from '@angular/core/testing';

export { render, renderToCanvas } from './render';
export { decorateStory as applyDecorators } from './decorateStory';

import { enhanceArgTypes } from 'storybook/internal/docs-tools';
import type { ArgTypesEnhancer, Parameters } from 'storybook/internal/types';

import { extractArgTypes, extractComponentDescription } from './compodoc';
import { destroyPlatform, getPlatform } from '@angular/core';

export const parameters: Parameters = {
  renderer: 'angular',
  docs: {
    story: { inline: true },
    extractArgTypes,
    extractComponentDescription,
  },
};

export const argTypesEnhancers: ArgTypesEnhancer[] = [enhanceArgTypes];

export const beforeEach = () => {
  return () => {
    if (getPlatform()) destroyPlatform();
    TestBed.resetTestingModule().resetTestEnvironment();
  };
};
