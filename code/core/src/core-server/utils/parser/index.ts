import type { SupportedRenderers } from '@storybook/core/types';

import { GenericParser } from './generic-parser';
import type { Parser } from './types';

/**
 * Get the parser for a given renderer
 *
 * @param renderer The renderer to get the parser for
 * @returns The parser for the renderer
 */
export function getParser(renderer: SupportedRenderers | null): Parser {
  switch (renderer) {
    default:
      return new GenericParser();
  }
}
