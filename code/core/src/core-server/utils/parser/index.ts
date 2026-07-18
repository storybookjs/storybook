import type { SupportedRenderer } from 'storybook/internal/types';

import { GenericParser } from './generic-parser.ts';
import type { Parser } from './types.ts';

/**
 * Get the parser for a given renderer
 *
 * @param renderer The renderer to get the parser for
 * @returns The parser for the renderer
 */
export function getParser(renderer: SupportedRenderer | null): Parser {
  switch (renderer) {
    default:
      return new GenericParser();
  }
}
