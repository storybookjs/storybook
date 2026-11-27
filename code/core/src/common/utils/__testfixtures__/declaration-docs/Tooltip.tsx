/** A tooltip that replaces the title attribute. */
export const RTooltip = wrap((props: { text: string }) => props.text);

declare function wrap<T>(component: T): T;
