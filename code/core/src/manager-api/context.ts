import { createContext as ReactCreateContext } from 'react';

import type { Combo } from './root.tsx';

export const createContext = ({ api, state }: Combo) => ReactCreateContext({ api, state });
// bench s1320 core-head 1794140435700688000
