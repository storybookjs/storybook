import { createContext as ReactCreateContext } from 'react';
import type { Combo } from './root';

export const createContext = ({ api, state }: Combo) => ReactCreateContext({ api, state });
