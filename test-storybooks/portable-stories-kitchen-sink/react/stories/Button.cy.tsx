/// <reference types="cypress" />
import * as stories from './Button.stories';
import { composeStories } from '@storybook/react';

const { CSF3Primary, WithLoader, Modal } = composeStories(stories);

describe('<Button />', () => {
  it('renders with loaders and play function', () => {
    cy.then(async () => {
      await WithLoader.load();
    });

    cy.mount(<WithLoader />);

    cy.then(async () => {
      cy.get('[data-testid="loaded-data"]').should('contain.text', 'loaded data');
      cy.get('[data-testid="mock-data"]').should('contain.text', 'mockFn return value');
    });
  });

  it('renders primary button', async () => {
    cy.mount(<CSF3Primary />);
    cy.get('[data-decorator]').should('exist');
  });

  it('renders primary button with custom args', async () => {
    cy.mount(<CSF3Primary>bar</CSF3Primary>);
    cy.get('button').should('contain.text', 'bar');
  });
});
