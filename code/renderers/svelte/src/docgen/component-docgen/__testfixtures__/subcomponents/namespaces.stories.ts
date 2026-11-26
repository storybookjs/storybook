import Button from './Button.svelte';
import { Kit } from './kit';
import * as Parts from './parts';

export default { component: Button, subcomponents: { Barrel: Kit.Icon, Namespace: Parts.Icon } };
export const Primary = {};
