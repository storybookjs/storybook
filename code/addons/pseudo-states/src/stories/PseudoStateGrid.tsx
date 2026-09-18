import React, { type ReactNode } from 'react';

interface PseudoStateGridProps {
  render: (label: string) => ReactNode;
}

export const PseudoStateGrid = ({ render }: PseudoStateGridProps) => (
  <div className="story-grid">
    <div>{render('Normal')}</div>
    <div className="pseudo-hover-all">{render('Hover')}</div>
    <div className="pseudo-focus-all">{render('Focus')}</div>
    <div className="pseudo-active-all">{render('Active')}</div>
    <div className="pseudo-hover-all pseudo-focus-all">{render('Hover Focus')}</div>
    <div className="pseudo-hover-all pseudo-active-all">{render('Hover Active')}</div>
    <div className="pseudo-focus-all pseudo-active-all">{render('Focus Active')}</div>
    <div className="pseudo-hover-all pseudo-focus-all pseudo-active-all">
      {render('Hover Focus Active')}
    </div>
  </div>
);
