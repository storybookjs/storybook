import { Component, Event, type EventEmitter, Method, Prop, State, h } from '@stencil/core';

/**
 * A Stencil rating control.
 */
@Component({ tag: 'stencil-props', shadow: true })
export class StencilProps {
  /** Current rating. */
  @Prop({ mutable: true, reflect: true })
  value = 0;

  /** Maximum number of stars. */
  @Prop()
  max = 5;

  /** Visual variant. */
  @Prop()
  variant: 'compact' | 'full' = 'full';

  /** Attribute name differs from the field. */
  @Prop({ attribute: 'aria-label-text' })
  labelText?: string;

  /** Complex prop, kept as an object. */
  @Prop()
  labels: Record<number, string> = {};

  /** Internal hover state. */
  @State()
  hovered = -1;

  /** Emitted when the rating changes. */
  @Event()
  ratingChange!: EventEmitter<number>;

  /** Emitted under a custom event name. */
  @Event({ eventName: 'stencil-reset' })
  reset!: EventEmitter<void>;

  /** Resets the rating to zero. */
  @Method()
  async clear(): Promise<void> {
    this.value = 0;
    this.reset.emit();
  }

  componentDidLoad(): void {}

  render() {
    return (
      <div class={this.variant}>
        {this.value}/{this.max}
      </div>
    );
  }
}
