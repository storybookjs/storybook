import { createContext as ReactCreateContext } from 'react';

import type { Combo } from './root.tsx';

export const createContext = ({ api, state }: Combo) => ReactCreateContext({ api, state });
// bench s1402 windows1 1794142966204912000
// bench s1402 windows2 1794144509075275000
