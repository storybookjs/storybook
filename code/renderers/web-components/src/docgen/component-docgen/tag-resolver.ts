import type { DocgenError } from 'storybook/internal/types';

import type { CemTag } from './manifest/cem-manager.ts';

export interface TagLookup {
  storyFilePath: string;
}

export interface TagResolver {
  find(tag: string, lookup: TagLookup): Promise<CemTag | DocgenError>;
}

/** Try resolvers in order; when all miss, the last one's error is reported. */
export function firstMatch([first, ...rest]: [TagResolver, ...TagResolver[]]): TagResolver {
  return {
    async find(tag, lookup) {
      let result = await first.find(tag, lookup);
      for (const resolver of rest) {
        if ('declaration' in result) {
          break;
        }
        result = await resolver.find(tag, lookup);
      }
      return result;
    },
  };
}
