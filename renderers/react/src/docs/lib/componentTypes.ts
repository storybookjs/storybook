export const isMemo = (component: any) => component.$$typeof === Symbol.for('react.memo');
export const isForwardRef = (component: any) =>
  component.$$typeof === Symbol.for('react.forward_ref');
