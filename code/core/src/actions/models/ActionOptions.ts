import type { Options as TelejsonOptions } from 'telejson';

interface Options {
  depth: number; // backwards compatibility, remove in 7.0
  clearOnStoryChange: boolean;
  limit: number;
  implicit: boolean;
  id: string;
}

export type ActionOptions = Partial<Options> & Partial<TelejsonOptions>;
