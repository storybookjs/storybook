import { describe, expect, it } from 'vitest';

import { dedent } from 'ts-dedent';

import { analyzeStoryTemplate } from './story-docs-template-analysis.ts';

describe('analyzeStoryTemplate', () => {
  it('finds component references through control flow and object literals', () => {
    expect(
      analyzeStoryTemplate(dedent`
        <section title="plain text">
          @if ({ value: label }.value) {
            {{ message }}
          }
        </section>
      `)
    ).toMatchInlineSnapshot(`
      {
        "boundOutputs": [],
        "kind": "resolved",
        "markup": "<section title="plain text">
        @if ({ value: label }.value) {
          {{ message }}
        }
      </section>",
        "referencedNames": [
          "label",
          "message",
        ],
      }
    `);
  });

  it('excludes template locals, references, and event-local values', () => {
    expect(
      analyzeStoryTemplate(dedent`
        @let display = label;
        <button #trigger (pressed)="select(display, $event)">{{ display }}</button>
        @defer (when ready; on interaction(trigger)) {
          {{ detail }}
        }
      `)
    ).toMatchInlineSnapshot(`
      {
        "boundOutputs": [
          "pressed",
        ],
        "kind": "resolved",
        "markup": "@let display = label;
      <button #trigger (pressed)="select(display, $event)">{{ display }}</button>
      @defer (when ready; on interaction(trigger)) {
        {{ detail }}
      }",
        "referencedNames": [
          "label",
          "select",
          "ready",
          "detail",
        ],
      }
    `);
  });

  it('excludes for-loop locals while traversing safe property reads', () => {
    expect(
      analyzeStoryTemplate(dedent`
        @for (item of items; track item.id; let row = $index) {
          <span [title]="item.owner?.name">{{ row }} {{ suffix }}</span>
        }
        <span [title]="account?.profile?.name"></span>
      `)
    ).toMatchInlineSnapshot(`
      {
        "boundOutputs": [],
        "kind": "resolved",
        "markup": "@for (item of items; track item.id; let row = $index) {
        <span [title]="item.owner?.name">{{ row }} {{ suffix }}</span>
      }
      <span [title]="account?.profile?.name"></span>",
        "referencedNames": [
          "items",
          "suffix",
          "account",
        ],
      }
    `);
  });

  it('recognizes explicit this and statically keyed component reads', () => {
    expect(analyzeStoryTemplate(`<span>{{ this.label }} {{ this['detail'] }}</span>`))
      .toMatchInlineSnapshot(`
        {
          "boundOutputs": [],
          "kind": "resolved",
          "markup": "<span>{{ this.label }} {{ this['detail'] }}</span>",
          "referencedNames": [
            "label",
            "detail",
          ],
        }
      `);
  });

  it('excludes the Angular $any builtin without hiding an explicit component member', () => {
    expect(analyzeStoryTemplate(`<span>{{ $any(label) }} {{ this.$any(detail) }}</span>`))
      .toMatchInlineSnapshot(`
        {
          "boundOutputs": [],
          "kind": "resolved",
          "markup": "<span>{{ $any(label) }} {{ this.$any(detail) }}</span>",
          "referencedNames": [
            "label",
            "$any",
            "detail",
          ],
        }
      `);
  });

  it('reports a component-root keyed read whose property cannot be known statically', () => {
    expect(analyzeStoryTemplate(`<span>{{ this[key] }}</span>`)).toMatchInlineSnapshot(`
      {
        "errors": [
          "A component-root keyed read has a dynamic key.",
        ],
        "kind": "unresolvable",
        "markup": "<span>{{ this[key] }}</span>",
      }
    `);
  });

  it('returns event binding names without treating attributes or literals as references', () => {
    expect(
      analyzeStoryTemplate(dedent`
        <sb-button
          label="static"
          [description]="'literal'"
          (pressed)="onPressed($event)"
          (valueChange)="value = $event"
        ></sb-button>
      `)
    ).toMatchInlineSnapshot(`
      {
        "boundOutputs": [
          "pressed",
          "valueChange",
        ],
        "kind": "resolved",
        "markup": "<sb-button
        label="static"
        [description]="'literal'"
        (pressed)="onPressed($event)"
        (valueChange)="value = $event"
      ></sb-button>",
        "referencedNames": [
          "onPressed",
          "value",
        ],
      }
    `);
  });

  it('materializes each argsToTemplate site against only its own element outputs', () => {
    expect(
      analyzeStoryTemplate(
        '<div (pressed)="outer($event)" data-storybook-args-to-template-0></div>' +
          '<sb-button data-storybook-args-to-template-1></sb-button>',
        [
          {
            marker: 'data-storybook-args-to-template-0',
            inputAttributes: ['[label]="\'Save\'"'],
            outputAttributes: [{ name: 'pressed', markup: '(pressed)="pressed($event)"' }],
          },
          {
            marker: 'data-storybook-args-to-template-1',
            inputAttributes: [],
            outputAttributes: [{ name: 'pressed', markup: '(pressed)="pressed($event)"' }],
          },
        ]
      )
    ).toMatchInlineSnapshot(`
      {
        "boundOutputs": [
          "pressed",
        ],
        "kind": "resolved",
        "markup": "<div (pressed)="outer($event)" [label]="'Save'"></div><sb-button (pressed)="pressed($event)"></sb-button>",
        "referencedNames": [
          "outer",
        ],
      }
    `);
  });

  it('uses parsed attributes instead of output-shaped text when materializing an expansion', () => {
    expect(
      analyzeStoryTemplate(
        '<sb-button title="> (pressed)=" data-storybook-args-to-template-0 ' +
          '(pressed)="manual($event)"></sb-button>',
        [
          {
            marker: 'data-storybook-args-to-template-0',
            inputAttributes: [],
            outputAttributes: [{ name: 'pressed', markup: '(pressed)="pressed($event)"' }],
          },
        ]
      )
    ).toMatchInlineSnapshot(`
      {
        "boundOutputs": [
          "pressed",
        ],
        "kind": "resolved",
        "markup": "<sb-button title="> (pressed)=" (pressed)="manual($event)"></sb-button>",
        "referencedNames": [
          "manual",
        ],
      }
    `);
  });

  it('recognizes a two-way binding as its change output at the expansion site', () => {
    expect(
      analyzeStoryTemplate('<input [(value)]="value" data-storybook-args-to-template-0>', [
        {
          marker: 'data-storybook-args-to-template-0',
          inputAttributes: [],
          outputAttributes: [
            { name: 'valueChange', markup: '(valueChange)="valueChange($event)"' },
          ],
        },
      ])
    ).toMatchInlineSnapshot(`
      {
        "boundOutputs": [
          "valueChange",
        ],
        "kind": "resolved",
        "markup": "<input [(value)]="value">",
        "referencedNames": [
          "value",
        ],
      }
    `);
  });

  it('materializes a marker exposed by structural directive desugaring only once', () => {
    expect(
      analyzeStoryTemplate(
        '<button *ngIf="ready" data-storybook-args-to-template-0 (pressed)="manual($event)"></button>',
        [
          {
            marker: 'data-storybook-args-to-template-0',
            inputAttributes: ['[label]="\'Save\'"'],
            outputAttributes: [{ name: 'pressed', markup: '(pressed)="pressed($event)"' }],
          },
        ]
      )
    ).toMatchInlineSnapshot(`
      {
        "boundOutputs": [
          "pressed",
        ],
        "kind": "resolved",
        "markup": "<button *ngIf="ready" [label]="'Save'" (pressed)="manual($event)"></button>",
        "referencedNames": [
          "manual",
          "ready",
        ],
      }
    `);
  });

  it('reports an argsToTemplate marker outside an element start tag', () => {
    expect(
      analyzeStoryTemplate('<sb-button></sb-button>data-storybook-args-to-template-0', [
        {
          marker: 'data-storybook-args-to-template-0',
          inputAttributes: ['[label]="\'Save\'"'],
          outputAttributes: [],
        },
      ])
    ).toMatchInlineSnapshot(`
      {
        "errors": [
          "An argsToTemplate expression is not inside an element start tag.",
        ],
        "kind": "unresolvable",
        "markup": "<sb-button></sb-button>[label]="'Save'"",
      }
    `);
  });

  it('does not rescan materialized arg text while replacing a missing marker', () => {
    expect(
      analyzeStoryTemplate(
        '<sb-button data-storybook-args-to-template-0></sb-button>' +
          'data-storybook-args-to-template-1',
        [
          {
            marker: 'data-storybook-args-to-template-0',
            inputAttributes: ['[label]="\'data-storybook-args-to-template-1\'"'],
            outputAttributes: [],
          },
          {
            marker: 'data-storybook-args-to-template-1',
            inputAttributes: ['[count]="1"'],
            outputAttributes: [],
          },
        ]
      )
    ).toMatchInlineSnapshot(`
      {
        "errors": [
          "An argsToTemplate expression is not inside an element start tag.",
        ],
        "kind": "unresolvable",
        "markup": "<sb-button [label]="'data-storybook-args-to-template-1'"></sb-button>[count]="1"",
      }
    `);
  });

  it('reports parse failures instead of returning partial analysis', () => {
    expect(analyzeStoryTemplate('<div>{{ value + }}</div>')).toMatchInlineSnapshot(`
      {
        "errors": [
          "Parser Error: Unexpected end of expression:  value +  at the end of the expression [ value + ] in storybook-template.html@0:5 ("<div>[ERROR ->]{{ value + }}</div>"): storybook-template.html@0:5",
        ],
        "kind": "unresolvable",
        "markup": "<div>{{ value + }}</div>",
      }
    `);
  });
});
