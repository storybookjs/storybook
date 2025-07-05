import React from 'react';

import {
  REQUEST_WHATS_NEW_DATA,
  RESULT_WHATS_NEW_DATA,
  SET_WHATS_NEW_CACHE,
  TOGGLE_WHATS_NEW_NOTIFICATIONS,
} from 'storybook/internal/core-events';
import type { WhatsNewCache, WhatsNewData } from 'storybook/internal/core-events';

import { global } from '@storybook/global';

import type { ModuleFn } from '../lib/types';

export type SubState = {
  whatsNewData?: WhatsNewData;
};

export type SubAPI = {
  isWhatsNewUnread(): boolean;
  whatsNewHasBeenRead(): void;
  toggleWhatsNewNotifications(): void;
};

const WHATS_NEW_NOTIFICATION_ID = 'whats-new';

/*
Copied from https://github.com/storybookjs/icons/blob/main/src/icons/StorybookIcon.tsx
because:
A. if we import the icon from @storybook/icons, the CJS output can't tree-shake the package, so it increases the bundle size with +200KB
B. we can't rely on the globalization by the manager, because react native also uses this manager-api and doesn't do the globalization

TODO: turn this into an import again when we go ESM-only in Storybook 10, as the ESM output tree-shakes fine
*/
const StorybookIcon = ({ color = 'currentColor', size = 14 }) => {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 14 14"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
    >
      <path
        fillRule="evenodd"
        clipRule="evenodd"
        d="M2.042.616a.704.704 0 00-.66.729L1.816 12.9c.014.367.306.66.672.677l9.395.422h.032a.704.704 0 00.704-.703V.704c0-.015 0-.03-.002-.044a.704.704 0 00-.746-.659l-.773.049.057 1.615a.105.105 0 01-.17.086l-.52-.41-.617.468a.105.105 0 01-.168-.088L9.746.134 2.042.616zm8.003 4.747c-.247.192-2.092.324-2.092.05.04-1.045-.429-1.091-.689-1.091-.247 0-.662.075-.662.634 0 .57.607.893 1.32 1.27 1.014.538 2.24 1.188 2.24 2.823 0 1.568-1.273 2.433-2.898 2.433-1.676 0-3.141-.678-2.976-3.03.065-.275 2.197-.21 2.197 0-.026.971.195 1.256.753 1.256.43 0 .624-.236.624-.634 0-.602-.633-.958-1.361-1.367-.987-.554-2.148-1.205-2.148-2.7 0-1.494 1.027-2.489 2.86-2.489 1.832 0 2.832.98 2.832 2.845z"
        fill={color}
      />
    </svg>
  );
};

export const init: ModuleFn = ({ fullAPI, store, provider }) => {
  const state: SubState = {
    whatsNewData: undefined,
  };

  function setWhatsNewState(newState: WhatsNewData) {
    store.setState({ whatsNewData: newState });
    state.whatsNewData = newState;
  }

  const api: SubAPI = {
    isWhatsNewUnread() {
      return state.whatsNewData?.status === 'SUCCESS' && !state.whatsNewData.postIsRead;
    },
    whatsNewHasBeenRead() {
      if (state.whatsNewData?.status === 'SUCCESS') {
        setWhatsNewCache({ lastReadPost: state.whatsNewData.url });
        setWhatsNewState({ ...state.whatsNewData, postIsRead: true });
        fullAPI.clearNotification(WHATS_NEW_NOTIFICATION_ID);
      }
    },
    toggleWhatsNewNotifications() {
      if (state.whatsNewData?.status === 'SUCCESS') {
        setWhatsNewState({
          ...state.whatsNewData,
          disableWhatsNewNotifications: !state.whatsNewData.disableWhatsNewNotifications,
        });
        provider.channel?.emit(TOGGLE_WHATS_NEW_NOTIFICATIONS, {
          disableWhatsNewNotifications: state.whatsNewData.disableWhatsNewNotifications,
        });
      }
    },
  };

  function getLatestWhatsNewPost(): Promise<WhatsNewData> {
    provider.channel?.emit(REQUEST_WHATS_NEW_DATA);

    return new Promise((resolve) =>
      provider.channel?.once(RESULT_WHATS_NEW_DATA, ({ data }: { data: WhatsNewData }) =>
        resolve(data)
      )
    );
  }

  function setWhatsNewCache(cache: WhatsNewCache): void {
    provider.channel?.emit(SET_WHATS_NEW_CACHE, cache);
  }

  const initModule = async () => {
    // The server channel doesn't exist in production, and we don't want to show what's new in production storybooks.
    if (global.CONFIG_TYPE !== 'DEVELOPMENT') {
      return;
    }

    const whatsNewData = await getLatestWhatsNewPost();
    setWhatsNewState(whatsNewData);

    const urlState = fullAPI.getUrlState();
    const isOnboardingView =
      urlState?.path === '/onboarding' || urlState.queryParams?.onboarding === 'true';

    if (
      !isOnboardingView &&
      whatsNewData.status === 'SUCCESS' &&
      !whatsNewData.disableWhatsNewNotifications &&
      whatsNewData.showNotification
    ) {
      fullAPI.addNotification({
        id: WHATS_NEW_NOTIFICATION_ID,
        link: '/settings/whats-new',
        content: {
          headline: whatsNewData.title,
          subHeadline: "Learn what's new in Storybook",
        },
        icon: <StorybookIcon />,
        onClear({ dismissed }: any) {
          if (dismissed) {
            setWhatsNewCache({ lastDismissedPost: whatsNewData.url });
          }
        },
      });
    }
  };

  return { init: initModule, state, api };
};
