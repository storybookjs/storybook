import * as fs from 'node:fs';

import { describe, expect, it } from 'vitest';

import svelteDoc from 'sveltedoc-parser';

import { createArgTypes } from './extractArgTypes';

const content = fs.readFileSync(`${__dirname}/sample/MockButton.svelte`, 'utf-8');
describe('Extracting Arguments', () => {
  it('should be svelte', () => {
    expect(content).toMatchInlineSnapshot(`
      "<script>
        import { createEventDispatcher, afterUpdate } from 'svelte';
        export let text = '';
        export let rounded = true;

        const dispatch = createEventDispatcher();

        function onClick(event) {
          rounded = !rounded;

          /**
           * Click Event 
           */
          dispatch('click', event);
        }

        afterUpdate(() => {
          /**
           * After Update
           */
          dispatch('afterUpdate');
        });
      </script>

      <style>
        .rounded {
          border-radius: 35px;
        }

        .button {
          border: 3px solid;
          padding: 10px 20px;
          background-color: white;
          outline: none;
        }
      </style>

      <svelte:options accessors={true} />
      <button class="button" class:rounded on:click={onClick}>
        <strong>{rounded ? 'Round' : 'Square'} corners</strong>
        <br />
        {text}
        <!-- Default Slot -->
        <slot {rounded}/>
      </button>
      "
    `);
  });

  it('should generate ArgTypes', async () => {
    const doc = await svelteDoc.parse({ fileContent: content, version: 3 });

    const results = createArgTypes(doc);

    expect(results).toMatchInlineSnapshot(`
      {
        "event_afterUpdate": {
          "action": "afterUpdate",
          "control": false,
          "description": "After Update",
          "name": "afterUpdate",
          "table": {
            "category": "events",
          },
        },
        "event_click": {
          "action": "click",
          "control": false,
          "description": "Click Event",
          "name": "click",
          "table": {
            "category": "events",
          },
        },
        "rounded": {
          "control": {
            "type": "boolean",
          },
          "description": undefined,
          "name": "rounded",
          "table": {
            "category": "properties",
            "defaultValue": {
              "summary": true,
            },
            "type": {
              "summary": "boolean",
            },
          },
          "type": {
            "name": "boolean",
            "required": false,
          },
        },
        "slot_default": {
          "control": false,
          "description": "Default Slot

      \`{rounded}\`",
          "name": "default",
          "table": {
            "category": "slots",
          },
        },
        "text": {
          "control": {
            "type": "text",
          },
          "description": undefined,
          "name": "text",
          "table": {
            "category": "properties",
            "defaultValue": {
              "summary": "",
            },
            "type": {
              "summary": "string",
            },
          },
          "type": {
            "name": "string",
            "required": false,
          },
        },
      }
    `);
  });
});
