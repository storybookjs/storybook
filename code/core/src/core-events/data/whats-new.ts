export interface WhatsNewCache {
  lastDismissedPost?: string;
  lastReadPost?: string;
}

export type WhatsNewData =
  | {
      status: 'SUCCESS';
      title: string;
      url: string;
      blogUrl?: string;
      publishedAt: string;
      excerpt: string;
      postIsRead: boolean;
      showNotification: boolean;
      disableWhatsNewNotifications: boolean;
    }
  | {
      status: 'ERROR';
    };
