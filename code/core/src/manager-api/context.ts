import { createContext as ReactCreateContext } from 'react';

import type { Combo } from './root.tsx';

export const createContext = ({ api, state }: Combo) => ReactCreateContext({ api, state });
// bench s1100 focus1 1794132069228304000
// bench s1100 focus2 1794133549611493000
