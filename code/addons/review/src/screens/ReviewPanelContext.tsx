import React, { createContext, useContext, type FC, type ReactNode } from 'react';

interface ReviewPanelContextValue {
  isPanelShown: boolean;
  showPanel: (forceFocus?: boolean) => void;
  hidePanel: () => void;
}

const ReviewPanelContext = createContext<ReviewPanelContextValue | null>(null);

export const ReviewPanelProvider: FC<{
  value: ReviewPanelContextValue;
  children: ReactNode;
}> = ({ value, children }) => (
  <ReviewPanelContext.Provider value={value}>{children}</ReviewPanelContext.Provider>
);

export const useReviewPanelContext = (): ReviewPanelContextValue => {
  const context = useContext(ReviewPanelContext);
  if (!context) {
    throw new Error('useReviewPanelContext must be used within ReviewPanelProvider');
  }
  return context;
};
