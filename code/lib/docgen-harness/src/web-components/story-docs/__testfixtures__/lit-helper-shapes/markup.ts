import { html } from './base.ts';
import type { TemplateResult } from 'lit';

export interface CardArgs {
  label?: string;
  count?: number;
  disabled?: boolean;
  heading?: string;
}

export const Card = (
  { label = 'Untitled', count = 1, disabled = false, heading }: CardArgs,
  content?: TemplateResult
) =>
  html`<lit-template-shapes label=${label} count=${count} ?disabled=${disabled} .heading=${heading}
    >${content}</lit-template-shapes
  >`;

export function Row(props: CardArgs) {
  return html`<li>${props.label}: ${props.count}</li>`;
}
