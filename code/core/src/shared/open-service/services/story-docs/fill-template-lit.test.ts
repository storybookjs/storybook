import { describe, expect, it } from 'vitest';

import { fillTemplate } from './fill-template-by-syntax.ts';
import { fillLitTemplate } from './fill-template-lit.ts';

describe('fillLitTemplate', () => {
  it('expands the args spread into attributes', () => {
    expect(
      fillLitTemplate('<my-button ${args}></my-button>', {
        label: 'Click',
        primary: true,
        disabled: false,
        size: undefined,
        count: 3,
        items: [1, 2],
        onClick: () => {},
      })
    ).toBe('<my-button label="Click" primary count="3" .items=${[1, 2]}></my-button>');
  });

  it('fills attribute holes, quoted or not, and drops unset ones', () => {
    expect(
      fillLitTemplate(
        '<my-button label=${args.label} size="${args.size}" title=${args.title}></my-button>',
        {
          label: 'Say "hi"',
          size: 'large',
        }
      )
    ).toBe('<my-button label="Say &quot;hi&quot;" size="large"></my-button>');
  });

  it('fills boolean and property bindings and keeps listeners as written', () => {
    expect(
      fillLitTemplate(
        '<my-el ?primary=${args.primary} ?disabled=${args.disabled} .user=${args.user} @click=${args.onClick}></my-el>',
        { primary: true, disabled: false, user: { name: 'Ada' }, onClick: () => {} }
      )
    ).toBe('<my-el primary .user=${{ name: "Ada" }} @click=${args.onClick}></my-el>');
  });

  it('fills text holes and leaves other expressions alone', () => {
    expect(
      fillLitTemplate('<p class=${classMap({ a: true })}>${args.label} ${args.missing}</p>', {
        label: 'a < b',
      })
    ).toBe('<p class=${classMap({ a: true })}>a &lt; b </p>');
  });

  it('is registered for the lit syntax', () => {
    expect(fillTemplate('<x-el label=${args.label}></x-el>', { label: 'Hi' }, 'lit')).toBe(
      '<x-el label="Hi"></x-el>'
    );
  });
});
