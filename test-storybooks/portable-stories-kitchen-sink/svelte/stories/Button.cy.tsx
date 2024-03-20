/// <reference types="cypress"/>
import * as stories from './Button.stories';
import { composeStories, composeStory } from '@storybook/svelte';

// const { CSF3Primary, WithLoader, CSF3InputFieldFilled } = composeStories(stories)

describe('<Button()', () => {
  it('renders primary button', async () => {
    // TODO figure out the following issue ReferenceError: $state is not defined
    // at createSvelte5Props (http://localhost:5173/__cypress/src/@fs/storybook/code/renderers/svelte/dist/createSvelte5Props.svelte.js:11:17)
    const Primary = composeStory(stories.CSF3Primary, stories.default);
    cy.mount(CSF3Primary)
    cy.get('button').should('contain.text', 'foo');
    // cy.get('[data-decorator]').should('exist');
  })

  // it('renders primary button with custom args', async () => {
  //   cy.mount(CSF3Primary({ label: 'bar' }))
  //   cy.get('button').should('contain.text', 'bar');
  // })

  // it.skip('renders with loaders and play function', () => {
  //   cy.then(async() => {
  //     await WithLoader.load();
  //   });

  //   cy.mount(WithLoader);

  //   cy.then(async() => {
  //     await WithLoader.play!({ canvasElement: document.querySelector('[data-cy-root]') as HTMLElement });
  //   });

  //   cy.get('[data-testid="loaded-data"]').should('contain.text', 'bar');
  //   cy.get('[data-testid="mock-data"]').should('contain.text', 'mockFn return value');
  // })

  // it.skip('renders with play function', () => {
  //   cy.mount(CSF3InputFieldFilled);

  //   cy.then(async() => {
  //     await CSF3InputFieldFilled.play!({ canvasElement: document.querySelector('[data-cy-root]') as HTMLElement });
  //     cy.get('[data-testid="input"]').should('contain.value', 'Hello world!');
  //   });
  // })
})
