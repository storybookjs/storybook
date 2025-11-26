import { describe, expect, it } from 'vitest';

import { withoutVitePlugins } from './without-vite-plugins';

describe('withoutVitePlugins', () => {
  describe('should remove', () => {
    it('plugin in root', async () => {
      const plugins = [{ name: 'vite-plugin-root-to-remove' }, { name: 'vite-plugin-root-keep' }];
      const names = ['vite-plugin-root-to-remove'];

      expect(await withoutVitePlugins(plugins, names)).toMatchInlineSnapshot(`
        [
          {
            "name": "vite-plugin-root-keep",
          },
        ]
      `);
    });

    it('plugin in nested array', async () => {
      const plugins = [
        [{ name: 'vite-plugin-nested-to-remove' }, { name: 'vite-plugin-nested-keep' }],
        { name: 'vite-plugin-root-keep' },
      ];
      const names = ['vite-plugin-nested-to-remove'];

      expect(await withoutVitePlugins(plugins, names)).toMatchInlineSnapshot(`
        [
          [
            {
              "name": "vite-plugin-nested-keep",
            },
          ],
          {
            "name": "vite-plugin-root-keep",
          },
        ]
      `);
    });

    it('plugin in nested async array', async () => {
      const plugins = [
        Promise.resolve([
          { name: 'vite-plugin-nested-async-to-remove' },
          { name: 'vite-plugin-nested-async-keep' },
        ]),
      ];
      const names = ['vite-plugin-nested-async-to-remove'];

      expect(await withoutVitePlugins(plugins, names)).toMatchInlineSnapshot(`
        [
          [
            {
              "name": "vite-plugin-nested-async-keep",
            },
          ],
        ]
      `);
    });

    it('async plugin in root', async () => {
      const plugins = [
        Promise.resolve({ name: 'vite-plugin-async-root-to-remove' }),
        Promise.resolve({ name: 'vite-plugin-async-root-keep' }),
      ];
      const names = ['vite-plugin-async-root-to-remove'];

      expect(await withoutVitePlugins(plugins, names)).toMatchInlineSnapshot(`
        [
          {
            "name": "vite-plugin-async-root-keep",
          },
        ]
      `);
    });

    it('async plugin in nested array', async () => {
      const plugins = [
        [
          Promise.resolve({ name: 'vite-plugin-async-nested-to-remove' }),
          Promise.resolve({ name: 'vite-plugin-async-nested-keep' }),
        ],
        Promise.resolve({ name: 'vite-plugin-async-root-keep' }),
      ];
      const names = ['vite-plugin-async-nested-to-remove'];

      expect(await withoutVitePlugins(plugins, names)).toMatchInlineSnapshot(`
        [
          [
            {
              "name": "vite-plugin-async-nested-keep",
            },
          ],
          {
            "name": "vite-plugin-async-root-keep",
          },
        ]
      `);
    });
    it('async plugin in nested async array', async () => {
      const plugins = [
        Promise.resolve([
          Promise.resolve({ name: 'vite-plugin-async-nested-async-to-remove' }),
          Promise.resolve({ name: 'vite-plugin-async-nested-async-keep' }),
        ]),
      ];
      const names = ['vite-plugin-async-nested-async-to-remove'];

      expect(await withoutVitePlugins(plugins, names)).toMatchInlineSnapshot(`
        [
          [
            {
              "name": "vite-plugin-async-nested-async-keep",
            },
          ],
        ]
      `);
    });

    it('multiple plugins in root', async () => {
      const plugins = [
        { name: 'vite-plugin-root-first-to-remove' },
        { name: 'vite-plugin-root-keep' },
        { name: 'vite-plugin-root-second-to-remove' },
      ];
      const names = ['vite-plugin-root-first-to-remove', 'vite-plugin-root-second-to-remove'];

      expect(await withoutVitePlugins(plugins, names)).toMatchInlineSnapshot(`
        [
          {
            "name": "vite-plugin-root-keep",
          },
        ]
      `);
    });

    it('multiple plugins in all cases', async () => {
      const plugins = [
        { name: 'vite-plugin-root-to-remove' },
        Promise.resolve({ name: 'vite-plugin-async-root-to-remove' }),
        [{ name: 'vite-plugin-nested-to-remove' }],
        Promise.resolve([{ name: 'vite-plugin-async-nested-to-remove' }]),
        [Promise.resolve({ name: 'vite-plugin-nested-async-to-remove' })],
        Promise.resolve([Promise.resolve({ name: 'vite-plugin-async-nested-async-to-remove' })]),
      ];
      const names = [
        'vite-plugin-root-to-remove',
        'vite-plugin-async-root-to-remove',
        'vite-plugin-nested-to-remove',
        'vite-plugin-async-nested-to-remove',
        'vite-plugin-nested-async-to-remove',
        'vite-plugin-async-nested-async-to-remove',
      ];

      expect(await withoutVitePlugins(plugins, names)).toMatchInlineSnapshot(`
        [
          [],
          [],
          [],
          [],
        ]
      `);
    });
  });

  it('should no-op if plugins are not found', async () => {
    const plugins = [
      { name: 'vite-plugin-root' },
      [{ name: 'vite-plugin-in-nested-array' }],
      Promise.resolve({ name: 'vite-plugin-async-root' }),
      Promise.resolve([{ name: 'vite-plugin-in-nested-async-array' }]),
      Promise.resolve([Promise.resolve({ name: 'vite-plugin-async-in-nested-async-array' })]),
    ];
    const names = ['vite-plugin-to-remove-first', 'vite-plugin-to-remove-second'];

    expect(await withoutVitePlugins(plugins, names)).toMatchInlineSnapshot(`
      [
        {
          "name": "vite-plugin-root",
        },
        [
          {
            "name": "vite-plugin-in-nested-array",
          },
        ],
        {
          "name": "vite-plugin-async-root",
        },
        [
          {
            "name": "vite-plugin-in-nested-async-array",
          },
        ],
        [
          {
            "name": "vite-plugin-async-in-nested-async-array",
          },
        ],
      ]
    `);
  });
});
