import type { ActionOptions } from './ActionOptions.ts';

export interface ActionDisplay {
  id: string;
  data: {
    name: string;
    args: any[];
  };
  count: number;
  options: ActionOptions;
}
