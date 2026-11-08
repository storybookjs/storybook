import { createContext as ReactCreateContext } from 'react';

import type { Combo } from './root.tsx';

export const createContext = ({ api, state }: Combo) => ReactCreateContext({ api, state });
// bench s1320 daily-head 1794140438440848000
