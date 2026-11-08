import { createContext as ReactCreateContext } from 'react';

import type { Combo } from './root.tsx';

export const createContext = ({ api, state }: Combo) => ReactCreateContext({ api, state });
// bench s0047 cifocus1 1794095233879140000
// bench s0047 cifocus2 1794098111814105000
