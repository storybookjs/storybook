/**
 * Client entry — loaded by the devtools-spike Vite plugin in serve mode only
 * (virtual:sb-devtools-client). Wires the panel island to the inspector.
 */

import { createInspector } from './inspector.ts';
import { mountPanel } from './panel.ts';

const panel = mountPanel();
createInspector(panel);
