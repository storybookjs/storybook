import { describe, expect, it } from 'vitest';

import { dedent } from 'ts-dedent';

import { getStorySortParameter } from './getStorySortParameter';

describe('getStorySortParameter', () => {
  describe('named exports', () => {
    describe('supported', () => {
      it('no parameters', () => {
        expect(
          getStorySortParameter(dedent`
          export const decorators = [];
        `)
        ).toBeUndefined();
      });

      it('no storySort parameter', () => {
        expect(
          getStorySortParameter(dedent`
          export const parameters = {
            layout: 'fullscreen',
          };
        `)
        ).toBeUndefined();
      });

      it('with wildcards', () => {
        expect(
          getStorySortParameter(dedent`
          export const parameters = {
            options: {
              storySort: [
                "Intro",
                "Pages",
                ["Home", "Login", "Admin"],
                "Components",
                "*",
                "WIP",    
              ]
            }
          };
        `)
        ).toMatchInlineSnapshot(`
          [
            "Intro",
            "Pages",
            [
              "Home",
              "Login",
              "Admin",
            ],
            "Components",
            "*",
            "WIP",
          ]
        `);
      });

      it('arrow function', () => {
        expect(
          getStorySortParameter(dedent`
          export const parameters = {
            options: {
              storySort: (a, b) =>
                a[1].kind === b[1].kind
                  ? 0
                  : a[1].id.localeCompare(b[1].id, undefined, { numeric: true }),
            },
          };
        `)
        ).toMatchInlineSnapshot(`[Function]`);
      });

      it('function', () => {
        expect(
          getStorySortParameter(dedent`
          export const parameters = {
            options: {
              storySort: function sortStories(a, b) {
                return a[1].kind === b[1].kind
                  ? 0
                  : a[1].id.localeCompare(b[1].id, undefined, { numeric: true });
              },
            },
          };
        `)
        ).toMatchInlineSnapshot(`[Function]`);
      });

      it('empty sort', () => {
        expect(
          getStorySortParameter(dedent`
          export const parameters = {
            options: {
              storySort: {
                method: "",
                order: [],
                locales: "",
              },
            },
          };
        `)
        ).toMatchInlineSnapshot(`
          {
            "locales": "",
            "method": "",
            "order": [],
          }
        `);
      });

      it('with weights', () => {
        expect(
          getStorySortParameter(dedent`
          export const parameters = {
            options: {
              storySort: {
                weights: {
                  Intro: -1,
                  WIP: 1,
                },
              },
            },
          };
        `)
        ).toMatchInlineSnapshot(`
          {
            "weights": {
              "Intro": -1,
              "WIP": 1,
            },
          }
        `);
      });

      it('parameters typescript', () => {
        expect(
          getStorySortParameter(dedent`
          export const parameters = {
            options: {
              storySort: {
                method: "",
                order: [],
                locales: "",
              },
            },
          } as Parameters;
        `)
        ).toMatchInlineSnapshot(`
          {
            "locales": "",
            "method": "",
            "order": [],
          }
        `);
      });

      it('parameters typescript satisfies', () => {
        expect(
          getStorySortParameter(dedent`
          export const parameters = {
            options: {
              storySort: {
                method: "",
                order: [],
                locales: "",
              },
            },
          } satisfies Parameters;
        `)
        ).toMatchInlineSnapshot(`
          {
            "locales": "",
            "method": "",
            "order": [],
          }
        `);
      });
    });

    describe('unsupported', () => {
      it('invalid parameters', () => {
        expect(
          getStorySortParameter(dedent`
          export const parameters = [];
        `)
        ).toBeUndefined();
      });

      it('parameters var', () => {
        expect(
          getStorySortParameter(dedent`
          const parameters = {
            options: {
              storySort: {
                method: "",
                order: [],
                locales: "",
              },
            },
          };
          export { parameters };
      `)
        ).toBeUndefined();
      });

      it('options var', () => {
        expect(() =>
          getStorySortParameter(dedent`
          const options = {
            storySort: {
              method: "",
              order: [],
              locales: "",
            },
          };
          export const parameters = {
            options,
          };
      `)
        ).toThrowErrorMatchingInlineSnapshot(`
          [Error: Unexpected 'options'. Parameter 'options.storySort' should be defined inline e.g.:

export default {
  parameters: {
    options: {
      storySort: <array | object | function>
    },
  },
};]
`);
      });

      it('storySort var', () => {
        expect(() =>
          getStorySortParameter(dedent`
          const storySort = {
            method: "",
            order: [],
            locales: "",
          };
          export const parameters = {
            options: {
              storySort,
            },
          };
      `)
        ).toThrowErrorMatchingInlineSnapshot(`
          [Error: Unexpected 'storySort'. Parameter 'options.storySort' should be defined inline e.g.:

export default {
  parameters: {
    options: {
      storySort: <array | object | function>
    },
  },
};]
        `);
      });

      it('order var', () => {
        expect(() =>
          getStorySortParameter(dedent`
          const order = [];
          export const parameters = {
            options: {
              storySort: {
                method: "",
                order,
                locales: "",
              }
            },
          };
      `)
        ).toThrowErrorMatchingInlineSnapshot(`
          [Error: Unexpected 'order'. Parameter 'options.storySort' should be defined inline e.g.:

export default {
  parameters: {
    options: {
      storySort: <array | object | function>
    },
  },
};]
`);
      });

      it('weights var', () => {
        expect(() =>
          getStorySortParameter(dedent`
          const weights = {};
          export const parameters = {
            options: {
              storySort: {
                method: "",
                weights,
                locales: "",
              }
            },
          };
      `)
        ).toThrowErrorMatchingInlineSnapshot(`
          [Error: Unexpected 'weights'. Parameter 'options.storySort' should be defined inline e.g.:

export default {
  parameters: {
    options: {
      storySort: <array | object | function>
    },
  },
};]
`);
      });
    });
  });

  describe('default export', () => {
    describe('supported', () => {
      it('inline', () => {
        expect(
          getStorySortParameter(dedent`
          export default {
            parameters: {
              options: {
                storySort: [
                  "Intro",
                  "*",
                  "WIP",    
                ]
              }
            }
          };
        `)
        ).toMatchInlineSnapshot(`
          [
            "Intro",
            "*",
            "WIP",
          ]
        `);
      });

      it('no storysort', () => {
        expect(
          getStorySortParameter(dedent`
          const config = {
            controls: {
              matchers: {
                color: /(background|color)$/i,
                date: /Date$/,
              },
            },
          }
          
          export default config
        `)
        ).toBeUndefined();
      });

      it('variable parameters without storysort', () => {
        expect(
          getStorySortParameter(dedent`
          const parameters = {
            controls: {
              matchers: {
                color: /(background|color)$/i,
                date: /Date$/,
              },
            },
          };

          const preview = {
            parameters,
          };
          export default preview;
        `)
        ).toBeUndefined();
      });

      it('variable parameters with storysort', () => {
        expect(
          getStorySortParameter(dedent`
          const parameters = {
            options: {
              storySort: [
                "Intro",
                "*",
                "WIP",    
              ]
            }
          };

          const preview = {
            parameters,
          };
          export default preview;
        `)
        ).toMatchInlineSnapshot(`
          [
            "Intro",
            "*",
            "WIP",
          ]
        `);
      });

      it('inline typescript', () => {
        expect(
          getStorySortParameter(dedent`
          export default {
            parameters: {
              options: {
                storySort: [
                  "Intro",
                  "*",
                  "WIP",    
                ]
              }
            }
          } satisfies Preview;
        `)
        ).toMatchInlineSnapshot(`
          [
            "Intro",
            "*",
            "WIP",
          ]
        `);
      });

      it('variable', () => {
        expect(
          getStorySortParameter(dedent`
          const preview = {
            parameters: {
              options: {
                storySort: [
                  "Intro",
                  "*",
                  "WIP",    
                ]
              }
            }
          };
          export default preview;
        `)
        ).toMatchInlineSnapshot(`
          [
            "Intro",
            "*",
            "WIP",
          ]
        `);
      });

      it('typescript var', () => {
        expect(
          getStorySortParameter(dedent`
          const preview: Preview = {
            parameters: {
              options: {
                storySort: [
                  "Intro",
                  "*",
                  "WIP",    
                ]
              }
            }
          };
          export default preview;
        `)
        ).toMatchInlineSnapshot(`
          [
            "Intro",
            "*",
            "WIP",
          ]
        `);
      });

      it('typescript satisfies var', () => {
        expect(
          getStorySortParameter(dedent`
          const preview = {
            parameters: {
              options: {
                storySort: [
                  "Intro",
                  "*",
                  "WIP",    
                ]
              }
            }
          } satisfies Preview;
          export default preview;
        `)
        ).toMatchInlineSnapshot(`
          [
            "Intro",
            "*",
            "WIP",
          ]
        `);
      });

      it('storysort satisfies inline', () => {
        expect(
          getStorySortParameter(dedent`
          enum ComponentGroups {
            General = 'General'
          }
          export default {
            parameters: {
              options: {
                storySort: {
                  order: ['General'] satisfies ComponentGroups[]
                }
              }
            }
          };
        `)
        ).toMatchInlineSnapshot(`
          {
            "order": [
              "General",
            ],
          }
        `);
      });
    });
    describe('unsupported', () => {
      it('bad default export', () => {
        expect(
          getStorySortParameter(dedent`
          export default 'foo';
        `)
        ).toBeUndefined();
      });
    });
  });
});
