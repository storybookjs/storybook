import { global } from '@storybook/global';

import type { AxeResults, Result } from 'axe-core';

import { PANEL_ID } from './constants';
import type { EnhancedResults } from './types';

const { document } = global;

// Augment axe results with debuggable links
export const withLinkPaths = (results: AxeResults, storyId: string) => {
  const pathname = document.location.pathname.replace(/iframe\.html$/, '');

  // Make a copy of the original results
  const enhancedResults = { ...results };

  // Enhance specific keys
  const propertiesToAugment = ['incomplete', 'passes', 'violations'] as const;

  propertiesToAugment.forEach((key) => {
    if (Array.isArray(results[key])) {
      enhancedResults[key] = results[key].map((result: Result) => ({
        ...result,
        nodes: result.nodes.map((node, index) => {
          const id = `${key}.${result.id}.${index + 1}`;
          const linkPath = `${pathname}?path=/story/${storyId}&addonPanel=${PANEL_ID}&a11ySelection=${id}`;
          return { id, ...node, linkPath };
        }),
      }));
    }
  });

  return enhancedResults as EnhancedResults;
};
