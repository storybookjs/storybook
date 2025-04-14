import type { Framework } from '../../bin/modernInputs';

export type State = Omit<
  {
    features: string[];
    framework: Framework;
  },
  'width' | 'height'
> & {
  directory: string;
  version: 'latest' | 'outdated' | undefined;
};
