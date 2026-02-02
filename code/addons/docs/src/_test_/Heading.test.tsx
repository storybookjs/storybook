import React from 'react';
import { render, screen } from '@testing-library/react';
import { Heading } from '../Heading';

describe('Heading component', () => {
  it('renders an accessible anchor for keyboard navigation', () => {
    render(<Heading>My Heading</Heading>);
    
    const anchor = screen.getByRole('link', { name: /link to heading my heading/i });
    
    expect(anchor).toHaveAttribute('tabindex', '0');
    expect(anchor).toHaveAttribute('aria-label', 'Link to heading My Heading');
  });
});
