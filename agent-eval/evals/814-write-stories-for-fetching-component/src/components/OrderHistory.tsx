import { useEffect, useState } from 'react';
import { Alert, Loader, Text, View } from 'reshaped';

type Order = {
  id: string;
  placedAt: string;
  total: number;
};

type State = { status: 'loading' } | { status: 'error' } | { status: 'loaded'; orders: Order[] };

export default function OrderHistory() {
  const [state, setState] = useState<State>({ status: 'loading' });

  useEffect(() => {
    fetch('/api/orders')
      .then((response) => {
        if (!response.ok) throw new Error(`Request failed with ${response.status}`);
        return response.json() as Promise<Order[]>;
      })
      .then((orders) => setState({ status: 'loaded', orders }))
      .catch(() => setState({ status: 'error' }));
  }, []);

  if (state.status === 'loading') return <Loader ariaLabel="Loading orders" />;

  if (state.status === 'error') {
    return (
      <Alert color="critical" title="Could not load your orders">
        Try again in a few minutes.
      </Alert>
    );
  }

  if (state.orders.length === 0) return <Text>You have not placed any orders yet.</Text>;

  return (
    <View gap={2} as="ul">
      {state.orders.map((order) => (
        <View key={order.id} as="li" direction="row" justify="space-between">
          <Text>
            Order {order.id} · {new Date(order.placedAt).toLocaleDateString('en-US')}
          </Text>
          <Text weight="medium">${order.total.toFixed(2)}</Text>
        </View>
      ))}
    </View>
  );
}
