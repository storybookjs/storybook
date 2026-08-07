export class SubscriptionLike {
  closed = false;
}

export const subscribe = (): SubscriptionLike => new SubscriptionLike();
