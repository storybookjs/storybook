// Benchmark of the NX DTE pipeline (#37221): a core change, on #37181 for comparison. Not for merging.
import { createContext as ReactCreateContext } from 'react';

import type { Combo } from './root.tsx';

export const createContext = ({ api, state }: Combo) => ReactCreateContext({ api, state });
