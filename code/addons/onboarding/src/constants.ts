export const ADDON_ID = 'storybook/onboarding';
export const ADDON_ONBOARDING_CHANNEL = `${ADDON_ID}/channel`;

// ! please keep this in sync with core/src/controls/constants.ts
export const ADDON_CONTROLS_ID = 'addon-controls' as const;
export const STORYBOOK_ADDON_ONBOARDING_STEPS = [
  '1:Intro',
  '2:Controls',
  '3:SaveFromControls',
  '4:CreateStory',
  '5:StoryCreated',
  '6:IntentSurvey',
  '7:FinishedOnboarding',
] as const;
