import type { StoreState } from '.';

export const initialState = {
  items: {
    accessibilityTests: { status: 'open' },
    autodocs: { status: 'open' },
    ciTests: { status: 'open' },
    controls: { status: 'open' },
    coverage: { status: 'open' },
    guidedTour: { status: 'open' },
    installA11y: { status: 'open' },
    installChromatic: { status: 'open' },
    installDocs: { status: 'open' },
    installVitest: { status: 'open' },
    mdxDocs: { status: 'open' },
    moreComponents: { status: 'open' },
    moreStories: { status: 'open' },
    onboardingSurvey: { status: 'open' },
    organizeStories: { status: 'open' },
    publishStorybook: { status: 'open' },
    renderComponent: { status: 'open' },
    runTests: { status: 'open' },
    viewports: { status: 'open' },
    visualTests: { status: 'open' },
    whatsNewStorybook10: { status: 'open' },
    writeInteractions: { status: 'open' },
  },
  widget: {},
} as const satisfies StoreState;
