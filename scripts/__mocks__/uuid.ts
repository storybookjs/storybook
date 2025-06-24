import { v5 } from 'uuid';

let seed = 0;

export const v4 = () => {
  seed += 1;
  return v5(seed.toString(), '6c7fda6d-f92f-4bd2-9d4d-da26a59196a6');
};
