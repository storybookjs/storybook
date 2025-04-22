/**
 * @file Interactions should be awaited
 * @author Yann Braga
 */
//------------------------------------------------------------------------------
// Requirements
//------------------------------------------------------------------------------
import { dedent } from 'ts-dedent';

import rule from '../rules/await-interactions';
import ruleTester from '../test-utils';

//------------------------------------------------------------------------------
// Tests
//------------------------------------------------------------------------------
ruleTester.run('await-interactions', rule, {
  valid: [
    dedent`
      Basic.play = async () => {
        await userEvent.click(button)
      }
    `,
    dedent`
      WithModalOpen.play = ({ canvasElement }) => {
        const MyButton = canvas.getByRole('button')
      }
    `,
    dedent`
      WithModalOpen.play = async ({ canvasElement }) => {
        const MyButton = await canvas.findByRole('button')
      }
    `,
    dedent`
      WithModalOpen.play = async ({ canvasElement }) => {
        const element: HTMLButtonElement = await within(canvasElement).findByText(/Hello/i)
        await userEvent.click(element, undefined, { clickCount: 2 })
        await userEvent.click(await within(canvasElement).findByText(/Hello/i), undefined, {
          clickCount: 2,
        })
      }
    `,
    dedent`
      export const WithModalOpen = {
        play: async ({ canvasElement }) => {
          const element: HTMLButtonElement = await within(canvasElement).findByText(/Hello/i)
          await userEvent.click(element, undefined, { clickCount: 2 })
          await userEvent.click(await within(canvasElement).findByText(/Hello/i), undefined, {
            clickCount: 2,
          })
        }
      }
    `,
    'await expect(foo).toBe(bar)',
    dedent`
      Basic.play = async () => {
        await waitForElementToBeRemoved(() => canvas.findByText('Loading...'))
        await waitForElementToBeRemoved(() => userEvent.hover(canvas.getByTestId('password-error-info')))
      }
    `,
    dedent`
      import { userEvent } from '../utils'
      import { within } from '@storybook/testing-library'

      Basic.play = async (context) => {
        const canvas = within(context)
        userEvent.click(canvas.getByRole('button'))
      }
    `,
    dedent`
      Basic.play = async () => {
        const userEvent = { test: () => {} }
        // should not complain
        userEvent.test()
      }
    `,
    // // @TODO: https://github.com/storybookjs/eslint-plugin-storybook/issues/28
    // dedent`
    //   Block.parameters = {
    //     async puppeteerTest(page) {
    //       const element = await page.$('[data-test-block]');
    //       await element.hover();
    //       const textContent = await element.getProperty('textContent');
    //       const text = await textContent.jsonValue();
    //       expect(text).toBe('I am hovered');
    //     },
    //   };
    // `,
    'Basic.play = async () => userEvent.click(button)',
    'Basic.play = async () => { return userEvent.click(button) }',
    dedent`
      export const SecondStory = {
        play: async (context) => {
          await FirstStory.play(context)
        }
      }
    `,
    dedent`
      export const SecondStory = {
        play: async (context) => {
          await FirstStory.play?.(context)
        }
      }
    `,
    dedent`
      export const SecondStory = {
        play: async (context) => {
          await FirstStory.play!(context)
        }
      }
    `,
  ],
  invalid: [
    {
      code: dedent`
        import { expect } from '@storybook/jest'
        WithModalOpen.play = async ({ args }) => {
          // should complain
          expect(args.onClick).toHaveBeenCalled()
        }
      `,
      output: dedent`
        import { expect } from '@storybook/jest'
        WithModalOpen.play = async ({ args }) => {
          // should complain
          await expect(args.onClick).toHaveBeenCalled()
        }
      `,
      errors: [
        {
          messageId: 'interactionShouldBeAwaited',
          data: { method: 'toHaveBeenCalled' },
          suggestions: [
            {
              messageId: 'fixSuggestion',
              output: dedent`
                import { expect } from '@storybook/jest'
                WithModalOpen.play = async ({ args }) => {
                  // should complain
                  await expect(args.onClick).toHaveBeenCalled()
                }
              `,
            },
          ],
        },
      ],
    },
    {
      code: dedent`
        import { expect, findByText } from '@storybook/test'
        WithModalOpen.play = async ({ args }) => {
          // should complain
          expect(args.onClick).toHaveBeenCalled()
          const element = findByText(canvasElement, 'asdf')
        }
      `,
      output: dedent`
        import { expect, findByText } from '@storybook/test'
        WithModalOpen.play = async ({ args }) => {
          // should complain
          await expect(args.onClick).toHaveBeenCalled()
          const element = await findByText(canvasElement, 'asdf')
        }
      `,
      errors: [
        {
          messageId: 'interactionShouldBeAwaited',
          data: { method: 'toHaveBeenCalled' },
          suggestions: [
            {
              messageId: 'fixSuggestion',
              output: dedent`
                import { expect, findByText } from '@storybook/test'
                WithModalOpen.play = async ({ args }) => {
                  // should complain
                  await expect(args.onClick).toHaveBeenCalled()
                  const element = findByText(canvasElement, 'asdf')
                }
              `,
            },
          ],
        },
        {
          messageId: 'interactionShouldBeAwaited',
          data: { method: 'findByText' },
          suggestions: [
            {
              messageId: 'fixSuggestion',
              output: dedent`
                import { expect, findByText } from '@storybook/test'
                WithModalOpen.play = async ({ args }) => {
                  // should complain
                  expect(args.onClick).toHaveBeenCalled()
                  const element = await findByText(canvasElement, 'asdf')
                }
              `,
            },
          ],
        },
      ],
    },
    {
      code: dedent`
        WithModalOpen.play = ({ canvasElement }) => {
          const canvas = within(canvasElement)

          const foodItem = canvas.findByText(/Cheeseburger/i)
        }
      `,
      output: dedent`
        WithModalOpen.play = async ({ canvasElement }) => {
          const canvas = within(canvasElement)

          const foodItem = await canvas.findByText(/Cheeseburger/i)
        }
      `,
      errors: [
        {
          messageId: 'interactionShouldBeAwaited',
          data: { method: 'findByText' },
          suggestions: [
            {
              messageId: 'fixSuggestion',
              output: dedent`
                WithModalOpen.play = async ({ canvasElement }) => {
                  const canvas = within(canvasElement)

                  const foodItem = await canvas.findByText(/Cheeseburger/i)
                }
              `,
            },
          ],
        },
      ],
    },
    {
      code: dedent`
        WithModalOpen.play = async ({ canvasElement }) => {
          const canvas = within(canvasElement)
          const foodItem = canvas.findByText(/Cheeseburger/i)
          userEvent.click(foodItem)
          const modalButton = canvas.findByLabelText('increase quantity by one')
          userEvent.click(modalButton)
        }
      `,
      output: dedent`
        WithModalOpen.play = async ({ canvasElement }) => {
          const canvas = within(canvasElement)
          const foodItem = await canvas.findByText(/Cheeseburger/i)
          await userEvent.click(foodItem)
          const modalButton = await canvas.findByLabelText('increase quantity by one')
          await userEvent.click(modalButton)
        }
      `,
      errors: [
        {
          messageId: 'interactionShouldBeAwaited',
          data: { method: 'findByText' },
          suggestions: [
            {
              messageId: 'fixSuggestion',
              output: dedent`
                WithModalOpen.play = async ({ canvasElement }) => {
                  const canvas = within(canvasElement)
                  const foodItem = await canvas.findByText(/Cheeseburger/i)
                  userEvent.click(foodItem)
                  const modalButton = canvas.findByLabelText('increase quantity by one')
                  userEvent.click(modalButton)
                }
            `,
            },
          ],
        },
        {
          messageId: 'interactionShouldBeAwaited',
          data: { method: 'userEvent' },
          suggestions: [
            {
              messageId: 'fixSuggestion',
              output: dedent`
                WithModalOpen.play = async ({ canvasElement }) => {
                  const canvas = within(canvasElement)
                  const foodItem = canvas.findByText(/Cheeseburger/i)
                  await userEvent.click(foodItem)
                  const modalButton = canvas.findByLabelText('increase quantity by one')
                  userEvent.click(modalButton)
                }
               `,
            },
          ],
        },
        {
          messageId: 'interactionShouldBeAwaited',
          data: { method: 'findByLabelText' },
          suggestions: [
            {
              messageId: 'fixSuggestion',
              output: dedent`
                WithModalOpen.play = async ({ canvasElement }) => {
                  const canvas = within(canvasElement)
                  const foodItem = canvas.findByText(/Cheeseburger/i)
                  userEvent.click(foodItem)
                  const modalButton = await canvas.findByLabelText('increase quantity by one')
                  userEvent.click(modalButton)
                }
               `,
            },
          ],
        },
        {
          messageId: 'interactionShouldBeAwaited',
          data: { method: 'userEvent' },
          suggestions: [
            {
              messageId: 'fixSuggestion',
              output: dedent`
                WithModalOpen.play = async ({ canvasElement }) => {
                  const canvas = within(canvasElement)
                  const foodItem = canvas.findByText(/Cheeseburger/i)
                  userEvent.click(foodItem)
                  const modalButton = canvas.findByLabelText('increase quantity by one')
                  await userEvent.click(modalButton)
                }
               `,
            },
          ],
        },
      ],
    },
    {
      code: dedent`
          WithModalOpen.play = async ({ canvasElement }) => {
            const element: HTMLButtonElement = within(canvasElement).findByText(/Hello/i)
            userEvent.click(element, undefined, { clickCount: 2 })
            userEvent.click(within(canvasElement).findByText(/Hello/i), undefined, {
              clickCount: 2,
            })
          }
        `,
      output: dedent`
        WithModalOpen.play = async ({ canvasElement }) => {
          const element: HTMLButtonElement = await within(canvasElement).findByText(/Hello/i)
          await userEvent.click(element, undefined, { clickCount: 2 })
          await userEvent.click(await within(canvasElement).findByText(/Hello/i), undefined, {
            clickCount: 2,
          })
        }
      `,
      errors: [
        {
          messageId: 'interactionShouldBeAwaited',
          data: { method: 'findByText' },
          suggestions: [
            {
              messageId: 'fixSuggestion',
              output: dedent`
                WithModalOpen.play = async ({ canvasElement }) => {
                  const element: HTMLButtonElement = await within(canvasElement).findByText(/Hello/i)
                  userEvent.click(element, undefined, { clickCount: 2 })
                  userEvent.click(within(canvasElement).findByText(/Hello/i), undefined, {
                    clickCount: 2,
                  })
                }
              `,
            },
          ],
        },
        {
          messageId: 'interactionShouldBeAwaited',
          data: { method: 'userEvent' },
          suggestions: [
            {
              messageId: 'fixSuggestion',
              output: dedent`
                WithModalOpen.play = async ({ canvasElement }) => {
                  const element: HTMLButtonElement = within(canvasElement).findByText(/Hello/i)
                  await userEvent.click(element, undefined, { clickCount: 2 })
                  userEvent.click(within(canvasElement).findByText(/Hello/i), undefined, {
                    clickCount: 2,
                  })
                }
              `,
            },
          ],
        },
        {
          messageId: 'interactionShouldBeAwaited',
          data: { method: 'userEvent' },
          suggestions: [
            {
              messageId: 'fixSuggestion',
              output: dedent`
                WithModalOpen.play = async ({ canvasElement }) => {
                  const element: HTMLButtonElement = within(canvasElement).findByText(/Hello/i)
                  userEvent.click(element, undefined, { clickCount: 2 })
                  await userEvent.click(within(canvasElement).findByText(/Hello/i), undefined, {
                    clickCount: 2,
                  })
                }
              `,
            },
          ],
        },
        {
          messageId: 'interactionShouldBeAwaited',
          data: { method: 'findByText' },
          suggestions: [
            {
              messageId: 'fixSuggestion',
              output: dedent`
                WithModalOpen.play = async ({ canvasElement }) => {
                  const element: HTMLButtonElement = within(canvasElement).findByText(/Hello/i)
                  userEvent.click(element, undefined, { clickCount: 2 })
                  userEvent.click(await within(canvasElement).findByText(/Hello/i), undefined, {
                    clickCount: 2,
                  })
                }
              `,
            },
          ],
        },
      ],
    },
    {
      code: dedent`
        export const WithModalOpen = {
          play: async ({ canvasElement, args }) => {
            const element: HTMLButtonElement = within(canvasElement).findByText(/Hello/i)
            userEvent.click(element, undefined, { clickCount: 2 })
            userEvent.click(within(canvasElement).findByText(/Hello/i), undefined, {
              clickCount: 2,
            })
            expect(args.onSubmit).toHaveBeenCalled()
          }
        }
      `,
      output: dedent`
        export const WithModalOpen = {
          play: async ({ canvasElement, args }) => {
            const element: HTMLButtonElement = await within(canvasElement).findByText(/Hello/i)
            await userEvent.click(element, undefined, { clickCount: 2 })
            await userEvent.click(await within(canvasElement).findByText(/Hello/i), undefined, {
              clickCount: 2,
            })
            await expect(args.onSubmit).toHaveBeenCalled()
          }
        }
      `,
      errors: [
        {
          messageId: 'interactionShouldBeAwaited',
          data: { method: 'findByText' },
          suggestions: [
            {
              messageId: 'fixSuggestion',
              output: dedent`
              export const WithModalOpen = {
                play: async ({ canvasElement, args }) => {
                  const element: HTMLButtonElement = await within(canvasElement).findByText(/Hello/i)
                  userEvent.click(element, undefined, { clickCount: 2 })
                  userEvent.click(within(canvasElement).findByText(/Hello/i), undefined, {
                    clickCount: 2,
                  })
                  expect(args.onSubmit).toHaveBeenCalled()
                }
              }
            `,
            },
          ],
        },
        {
          messageId: 'interactionShouldBeAwaited',
          data: { method: 'userEvent' },
          suggestions: [
            {
              messageId: 'fixSuggestion',
              output: dedent`
              export const WithModalOpen = {
                play: async ({ canvasElement, args }) => {
                  const element: HTMLButtonElement = within(canvasElement).findByText(/Hello/i)
                  await userEvent.click(element, undefined, { clickCount: 2 })
                  userEvent.click(within(canvasElement).findByText(/Hello/i), undefined, {
                    clickCount: 2,
                  })
                  expect(args.onSubmit).toHaveBeenCalled()
                }
              }
            `,
            },
          ],
        },
        {
          messageId: 'interactionShouldBeAwaited',
          data: { method: 'userEvent' },
          suggestions: [
            {
              messageId: 'fixSuggestion',
              output: dedent`
              export const WithModalOpen = {
                play: async ({ canvasElement, args }) => {
                  const element: HTMLButtonElement = within(canvasElement).findByText(/Hello/i)
                  userEvent.click(element, undefined, { clickCount: 2 })
                  await userEvent.click(within(canvasElement).findByText(/Hello/i), undefined, {
                    clickCount: 2,
                  })
                  expect(args.onSubmit).toHaveBeenCalled()
                }
              }
            `,
            },
          ],
        },
        {
          messageId: 'interactionShouldBeAwaited',
          data: { method: 'findByText' },
          suggestions: [
            {
              messageId: 'fixSuggestion',
              output: dedent`
              export const WithModalOpen = {
                play: async ({ canvasElement, args }) => {
                  const element: HTMLButtonElement = within(canvasElement).findByText(/Hello/i)
                  userEvent.click(element, undefined, { clickCount: 2 })
                  userEvent.click(await within(canvasElement).findByText(/Hello/i), undefined, {
                    clickCount: 2,
                  })
                  expect(args.onSubmit).toHaveBeenCalled()
                }
              }
            `,
            },
          ],
        },
        {
          messageId: 'interactionShouldBeAwaited',
          data: { method: 'toHaveBeenCalled' },
          suggestions: [
            {
              messageId: 'fixSuggestion',
              output: dedent`
              export const WithModalOpen = {
                play: async ({ canvasElement, args }) => {
                  const element: HTMLButtonElement = within(canvasElement).findByText(/Hello/i)
                  userEvent.click(element, undefined, { clickCount: 2 })
                  userEvent.click(within(canvasElement).findByText(/Hello/i), undefined, {
                    clickCount: 2,
                  })
                  await expect(args.onSubmit).toHaveBeenCalled()
                }
              }
            `,
            },
          ],
        },
      ],
    },
    {
      code: dedent`
        export const AfterLoadingState = {
          play: async ({ canvasElement, args }) => {
            const canvas = within(canvasElement)
            waitForElementToBeRemoved(async () => {
              canvas.findByText('Loading...')
            }, { timeout: 2000 })
            const button = canvas.findByText('Loaded!')
            userEvent.click(button)
            waitFor(async () => {
              expect(args.onSubmit).toHaveBeenCalled()
            })
          }
        }
      `,
      output: dedent`
        export const AfterLoadingState = {
          play: async ({ canvasElement, args }) => {
            const canvas = within(canvasElement)
            await waitForElementToBeRemoved(async () => {
              await canvas.findByText('Loading...')
            }, { timeout: 2000 })
            const button = await canvas.findByText('Loaded!')
            await userEvent.click(button)
            await waitFor(async () => {
              await expect(args.onSubmit).toHaveBeenCalled()
            })
          }
        }
      `,
      errors: [
        {
          messageId: 'interactionShouldBeAwaited',
          data: { method: 'waitForElementToBeRemoved' },
          suggestions: [
            {
              messageId: 'fixSuggestion',
              output: dedent`
              export const AfterLoadingState = {
                play: async ({ canvasElement, args }) => {
                  const canvas = within(canvasElement)
                  await waitForElementToBeRemoved(async () => {
                    canvas.findByText('Loading...')
                  }, { timeout: 2000 })
                  const button = canvas.findByText('Loaded!')
                  userEvent.click(button)
                  waitFor(async () => {
                    expect(args.onSubmit).toHaveBeenCalled()
                  })
                }
              }
            `,
            },
          ],
        },
        {
          messageId: 'interactionShouldBeAwaited',
          data: { method: 'findByText' },
          suggestions: [
            {
              messageId: 'fixSuggestion',
              output: dedent`
              export const AfterLoadingState = {
                play: async ({ canvasElement, args }) => {
                  const canvas = within(canvasElement)
                  waitForElementToBeRemoved(async () => {
                    await canvas.findByText('Loading...')
                  }, { timeout: 2000 })
                  const button = canvas.findByText('Loaded!')
                  userEvent.click(button)
                  waitFor(async () => {
                    expect(args.onSubmit).toHaveBeenCalled()
                  })
                }
              }
            `,
            },
          ],
        },
        {
          messageId: 'interactionShouldBeAwaited',
          data: { method: 'findByText' },
          suggestions: [
            {
              messageId: 'fixSuggestion',
              output: dedent`
              export const AfterLoadingState = {
                play: async ({ canvasElement, args }) => {
                  const canvas = within(canvasElement)
                  waitForElementToBeRemoved(async () => {
                    canvas.findByText('Loading...')
                  }, { timeout: 2000 })
                  const button = await canvas.findByText('Loaded!')
                  userEvent.click(button)
                  waitFor(async () => {
                    expect(args.onSubmit).toHaveBeenCalled()
                  })
                }
              }
            `,
            },
          ],
        },
        {
          messageId: 'interactionShouldBeAwaited',
          data: { method: 'userEvent' },
          suggestions: [
            {
              messageId: 'fixSuggestion',
              output: dedent`
              export const AfterLoadingState = {
                play: async ({ canvasElement, args }) => {
                  const canvas = within(canvasElement)
                  waitForElementToBeRemoved(async () => {
                    canvas.findByText('Loading...')
                  }, { timeout: 2000 })
                  const button = canvas.findByText('Loaded!')
                  await userEvent.click(button)
                  waitFor(async () => {
                    expect(args.onSubmit).toHaveBeenCalled()
                  })
                }
              }
            `,
            },
          ],
        },
        {
          messageId: 'interactionShouldBeAwaited',
          data: { method: 'waitFor' },
          suggestions: [
            {
              messageId: 'fixSuggestion',
              output: dedent`
              export const AfterLoadingState = {
                play: async ({ canvasElement, args }) => {
                  const canvas = within(canvasElement)
                  waitForElementToBeRemoved(async () => {
                    canvas.findByText('Loading...')
                  }, { timeout: 2000 })
                  const button = canvas.findByText('Loaded!')
                  userEvent.click(button)
                  await waitFor(async () => {
                    expect(args.onSubmit).toHaveBeenCalled()
                  })
                }
              }
            `,
            },
          ],
        },
        {
          messageId: 'interactionShouldBeAwaited',
          data: { method: 'toHaveBeenCalled' },
          suggestions: [
            {
              messageId: 'fixSuggestion',
              output: dedent`
              export const AfterLoadingState = {
                play: async ({ canvasElement, args }) => {
                  const canvas = within(canvasElement)
                  waitForElementToBeRemoved(async () => {
                    canvas.findByText('Loading...')
                  }, { timeout: 2000 })
                  const button = canvas.findByText('Loaded!')
                  userEvent.click(button)
                  waitFor(async () => {
                    await expect(args.onSubmit).toHaveBeenCalled()
                  })
                }
              }
            `,
            },
          ],
        },
      ],
    },
    {
      code: dedent`
        export const FourthStory = {
          play: async (context) => {
            FirstStory.play(context)
            SecondStory.play!(context)
            ThirdStory.play?.(context)
          }
        }
      `,
      output: dedent`
        export const FourthStory = {
          play: async (context) => {
            await FirstStory.play(context)
            await SecondStory.play!(context)
            await ThirdStory.play?.(context)
          }
        }
      `,
      errors: [
        {
          messageId: 'interactionShouldBeAwaited',
          data: { method: 'play' },
          suggestions: [
            {
              messageId: 'fixSuggestion',
              output: dedent`
                export const FourthStory = {
                  play: async (context) => {
                    await FirstStory.play(context)
                    SecondStory.play!(context)
                    ThirdStory.play?.(context)
                  }
                }
              `,
            },
          ],
        },
        {
          messageId: 'interactionShouldBeAwaited',
          data: { method: 'play' },
          suggestions: [
            {
              messageId: 'fixSuggestion',
              output: dedent`
                export const FourthStory = {
                  play: async (context) => {
                    FirstStory.play(context)
                    await SecondStory.play!(context)
                    ThirdStory.play?.(context)
                  }
                }
              `,
            },
          ],
        },
        {
          messageId: 'interactionShouldBeAwaited',
          data: { method: 'play' },
          suggestions: [
            {
              messageId: 'fixSuggestion',
              output: dedent`
                export const FourthStory = {
                  play: async (context) => {
                    FirstStory.play(context)
                    SecondStory.play!(context)
                    await ThirdStory.play?.(context)
                  }
                }
              `,
            },
          ],
        },
      ],
    },
  ],
});
