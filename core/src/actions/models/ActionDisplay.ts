import type { ActionOptions } from './ActionOptions';

export interface ActionDisplay {
  id: string;
  data: {
    name: string;
    args: any[];
  };
  count: number;
  options: ActionOptions;
}
