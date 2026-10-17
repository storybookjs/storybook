import { noChange } from 'lit';
import { Directive, directive, type ElementPart } from 'lit/directive.js';

class SpreadProps extends Directive {
  render(_props: Record<string, unknown>) {
    return noChange;
  }

  override update(part: ElementPart, [props]: [Record<string, unknown>]) {
    Object.assign(part.element, props);
    return noChange;
  }
}

export const spreadProps = directive(SpreadProps);
