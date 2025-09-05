import { expect, test } from 'vitest';

import { buildFlightRouterState } from './flight-router-state';

test('parse route and url to route true', () => {
  expect(buildFlightRouterState('/note/[id]/[slug]', '/note/someid/someslug', '?a=1'))
    .toMatchInlineSnapshot(`
    [
      "",
      {
        "children": [
          "note",
          {
            "children": [
              [
                "id",
                "someid",
                "d",
              ],
              {
                "children": [
                  [
                    "slug",
                    "someslug",
                    "d",
                  ],
                  {
                    "children": [
                      "__PAGE__?{"a":"1"}",
                      {},
                      "/note/someid/someslug",
                      "refresh",
                    ],
                  },
                ],
              },
            ],
          },
        ],
      },
      undefined,
      undefined,
      true,
    ]
  `);
});
